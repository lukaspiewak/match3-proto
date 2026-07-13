import { CellState, VOID, VisualConfig, COMBO_BONUS_SECONDS, type Cell } from '../Config';
import { BlockRegistry, type SpecialAction } from '../BlockDef';
import type { BoardLogic } from '../BoardLogic';
import { type MatchRule, type MatchGroup } from '../match/MatchRule';
import { LineMatchRule } from '../match/LineMatchRule';

export class MatchEngine {
    private board: BoardLogic;
    private matchRule: MatchRule;

    public currentCombo: number = 0;
    public bestCombo: number = 0;
    public comboTimer: number = 0;

    public currentCascadeDepth: number = 0;
    public lastMoveGroupSize: number = 0;
    public lastSwapTargetId: number = -1;

    constructor(board: BoardLogic, matchRule: MatchRule = new LineMatchRule()) {
        this.board = board;
        this.matchRule = matchRule;
    }

    public update(dt: number) {
        if (this.board.config.comboMode === 'TIME' && this.currentCombo > 0) {
            const isBoardBusy = !this.board.cells.every(c => c.state === CellState.IDLE);
            const shouldPause = (this.board.config.gameMode !== 'SOLO' && isBoardBusy);

            if (!shouldPause) {
                this.comboTimer -= dt; 
                if (this.comboTimer <= 0) {
                    this.comboTimer = 0;
                    this.currentCombo = 0; 
                }
            }
        }
    }

    public scanForMatches() {
        const cells = this.board.cells;

        // DETEKCJA delegowana do wymiennej reguły dopasowania.
        const groups = this.matchRule.findMatches(this.board);

        if (groups.length > 0) {
            const initialMatches = new Set<number>();
            for (const g of groups) for (const idx of g.cells) initialMatches.add(idx);
            const finalMatches = new Set(initialMatches);

            this.applyGroupActions(groups, finalMatches);

            this.currentCascadeDepth++;
            this.board.statsManager.recordCascade(this.currentCascadeDepth);
            
            if (this.currentCascadeDepth > 1) {
                console.log(`🌊 Cascade Depth: ${this.currentCascadeDepth}`);
            }

            this.updateStats(finalMatches);

            this.currentCombo++;
            if (this.board.config.comboMode === 'TIME') this.comboTimer += COMBO_BONUS_SECONDS;
            
            finalMatches.forEach(idx => {
                const cell = cells[idx];
                // Dopasowane = instakill; dodane przez akcje (obszar) = obrażenia.
                cell.hp = initialMatches.has(idx) ? 0 : cell.hp - 1;
                if (cell.hp <= 0) this.explodeCell(cell);
                else this.damageCell(cell);
            });

            // Blokery CC-style: uszkodzenie sąsiadów dopasowania (frosting/skrzynie/kłódki/bomby).
            this.applyAdjacentDamage(initialMatches, finalMatches);
        }
    }

    /**
     * Uszkadza blokery (damagedByAdjacent) sąsiadujące ortogonalnie z dopasowanymi
     * komórkami: hp--, a przy hp<=0 albo odsłania klocek (revealTypeId), albo niszczy.
     * Jedno uszkodzenie na dopasowanie (kaskada = kolejna warstwa).
     */
    private applyAdjacentDamage(initialMatches: Set<number>, finalMatches: Set<number>) {
        const cells = this.board.cells;
        const cols = this.board.cols, rows = this.board.rows;
        const hit = new Set<number>();

        initialMatches.forEach(idx => {
            const c = idx % cols, r = Math.floor(idx / cols);
            const neighbors: [number, number][] = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
            for (const [nc, nr] of neighbors) {
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                const nIdx = nc + nr * cols;
                if (hit.has(nIdx) || finalMatches.has(nIdx)) continue;
                const cell = cells[nIdx];
                if (cell.state !== CellState.IDLE) continue;
                const def = BlockRegistry.getById(cell.typeId);
                if (def && def.damagedByAdjacent) hit.add(nIdx);
            }
        });

        if (hit.size === 0) return;

        hit.forEach(nIdx => {
            const cell = cells[nIdx];
            cell.hp--;
            if (cell.hp > 0) { this.damageCell(cell); return; }

            const def = BlockRegistry.getById(cell.typeId);
            if (def && def.revealTypeId !== undefined) {
                // Kłódka → odsłonięty klocek (może potem spaść/matchować).
                const revealed = BlockRegistry.getById(def.revealTypeId);
                cell.typeId = def.revealTypeId;
                cell.state = CellState.IDLE;
                cell.hp = revealed ? revealed.initialHp : 1;
                cell.maxHp = cell.hp;
                cell.countdown = revealed ? revealed.initialCountdown : 0;
                this.board.emit('reveal', { id: cell.id, typeId: cell.typeId });
            } else {
                // Skrzynia/frosting/rozbrojona bomba → zniszczenie (luka → grawitacja).
                this.explodeCell(cell);
            }
        });

        this.board.needsMatchCheck = true;
    }

    public checkMatchAt(idx: number): boolean {
        return this.matchRule.hasMatchAt(this.board, idx);
    }

    // --- JEDNOLITY PIPELINE EFEKTÓW (wspólne prymitywy niszczenia/uszkadzania) ---

    /** Komórka zeszła do hp<=0 → stan EXPLODING + timer + zdarzenie 'explode'. */
    private explodeCell(cell: Cell) {
        if (cell.state !== CellState.EXPLODING) {
            cell.state = CellState.EXPLODING;
            cell.timer = VisualConfig.EXPLOSION_DURATION;
            this.board.emit('explode', { id: cell.id, typeId: cell.typeId, x: cell.x, y: cell.y });
        }
    }

    /** Komórka przeżyła (hp>0) → zdarzenie 'damage'. */
    private damageCell(cell: Cell) {
        this.board.emit('damage', { id: cell.id, hp: cell.hp, maxHp: cell.maxHp });
    }

    /**
     * Natychmiast wysadza wskazane komórki (instakill) i zgłasza to jako zdarzenia.
     * Reużywane przez aktywację/łączenie bloków specjalnych (poza pętlą dopasowań).
     * Pomija void i puste. Ustawia needsMatchCheck, by grawitacja/kaskady ruszyły.
     */
    public detonate(targetSet: Set<number>) {
        const cells = this.board.cells;
        targetSet.forEach(idx => {
            const cell = cells[idx];
            if (cell.typeId === VOID || cell.typeId === -1) return;
            cell.hp = 0;
            this.explodeCell(cell);
        });
        if (targetSet.size > 0) this.board.needsMatchCheck = true;
    }

    /**
     * Aplikuje akcje specjalne dla wykrytych grup. Grupy dostarcza MatchRule
     * (już scalone) — silnik nie zna sposobu ich wykrycia, tylko efekty.
     */
    private applyGroupActions(groups: MatchGroup[], finalMatches: Set<number>) {
        for (const group of groups) {
            const blockDef = BlockRegistry.getById(group.typeId);
            if (!blockDef) continue;

            // Wybór akcji wg ROZMIARU i KSZTAŁTU (np. L/T → wybuch obszarowy).
            const action: SpecialAction = blockDef.resolveAction(group.size, group.shape);

            if (action !== 'NONE') {
                if (action.startsWith('CREATE_')) {
                    // Akcje tworzenia uruchamiamy raz dla grupy, w miejscu ruchu gracza jeśli możliwe.
                    let targetIdx = group.cells[0];
                    if (this.lastSwapTargetId !== -1 && group.cells.includes(this.lastSwapTargetId)) {
                        targetIdx = this.lastSwapTargetId;
                    }
                    this.board.runAction(action, targetIdx, finalMatches);
                } else {
                    // Inne akcje (np. EXPLODE) uruchamiamy dla każdego klocka w grupie.
                    group.cells.forEach(gIdx => this.board.runAction(action, gIdx, finalMatches));
                }
            }
        }
    }

    private updateStats(finalMatches: Set<number>) {
        let groupSize = finalMatches.size; 
        if (groupSize > this.lastMoveGroupSize) this.lastMoveGroupSize = groupSize;

        finalMatches.forEach(idx => {
            const type = this.board.cells[idx].typeId;
            this.board.statsManager.recordMatch(type, groupSize);
        });
        
        if (this.board.statsEnabled && groupSize >= 5) {
            console.log(`✨ MASSIVE CLEAR (Size: ${groupSize})`);
        }
    }

    public reset() {
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.comboTimer = 0;
        this.currentCascadeDepth = 0;
        this.lastMoveGroupSize = 0;
        this.lastSwapTargetId = -1;
    }
}