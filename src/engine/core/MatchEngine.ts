import { CellState, VisualConfig, COMBO_BONUS_SECONDS } from '../Config';
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
                
                if (initialMatches.has(idx)) {
                    cell.hp = 0; // Instakill dla dopasowanych
                } else {
                    cell.hp--;   // Obrażenia obszarowe
                }

                if (cell.hp <= 0) {
                    if (cell.state !== CellState.EXPLODING) {
                        cell.state = CellState.EXPLODING;
                        cell.timer = VisualConfig.EXPLOSION_DURATION;
                        
                        this.board.emit('explode', { 
                            id: cell.id, 
                            typeId: cell.typeId, 
                            x: cell.x, 
                            y: cell.y 
                        });
                    }
                } else {
                    this.board.emit('damage', {
                        id: cell.id,
                        hp: cell.hp,
                        maxHp: cell.maxHp
                    });
                }
            });
        }
    }

    public checkMatchAt(idx: number): boolean {
        return this.matchRule.hasMatchAt(this.board, idx);
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