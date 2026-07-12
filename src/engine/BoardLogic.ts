import { EventEmitter } from 'pixi.js';
import {
    CellState, EMPTY, VOID, type Cell,
    type GravityDir, type GameConfig,
    AppConfig
} from './Config';
import { BlockRegistry, BlockDefinition, type SpecialAction } from './BlockDef';
import { resolveSpecialCombo } from './match/SpecialCombos';
import { GridPhysics } from './core/GridPhysics';
import { MatchEngine } from './core/MatchEngine';
import { HintSystem } from './core/HintSystem';
import { ActionManager } from './actions/ActionManager';
import { StatsManager } from './core/StatsManager';
import { type MatchRule } from './match/MatchRule';

export interface MoveResult {
    success: boolean;
    causedMatch: boolean;
    maxGroupSize: number;
}

/** Logiczny stan pojedynczej komórki — bez danych wizualnych (x/y/velocity). */
export interface CellSnapshot {
    typeId: number;
    hp: number;
    maxHp: number;
}

/**
 * BoardState — czysty, serializowalny stan LOGICZNY planszy.
 *
 * Nie zawiera stanu wizualnego/animacji (pozycje, prędkości, timery), który
 * należy do warstwy renderu. Umożliwia zapis/odczyt pozycji oraz deterministyczną
 * symulację headless (fundament pod walidację i generowanie łamigłówek).
 */
export interface BoardState {
    cols: number;
    rows: number;
    cells: CellSnapshot[];
}

export class BoardLogic extends EventEmitter {
    public cells: Cell[];
    public readonly config: GameConfig;
    public statsManager: StatsManager;
    private physics: GridPhysics;
    private matchEngine: MatchEngine;
    private hintSystem: HintSystem;
    private actionManager: ActionManager;

    public needsMatchCheck: boolean = false;
    public onBadMove: (() => void) | null = null;
    private currentThinkingTime: number = 0;

    // Wymiary planszy pochodzą z konfiguracji instancji, nie z globalnych stałych.
    public get cols(): number { return this.config.cols; }
    public get rows(): number { return this.config.rows; }

    constructor(config: GameConfig = AppConfig, matchRule?: MatchRule) {
        super();
        this.config = config;
        this.cells = [];
        this.statsManager = new StatsManager();
        this.actionManager = new ActionManager();
        this.physics = new GridPhysics(this.cells, config);
        this.matchEngine = new MatchEngine(this, matchRule);
        this.hintSystem = new HintSystem(this, this.matchEngine);
        this.physics.onNeedsMatchCheck = () => { this.needsMatchCheck = true; };
        this.physics.onDropDown = (id) => {
            const def = BlockRegistry.getById(this.cells[id].typeId);
            if (def && def.triggers.onDropDown !== 'NONE') {
                this.runAction(def.triggers.onDropDown, id, new Set([id]));
                if (this.cells[id].state !== CellState.IDLE) this.needsMatchCheck = false;
            }
        };
        this.initBoard();
    }

    // ... (proxy properties bez zmian) ...
    public get currentCombo() { return this.matchEngine.currentCombo; }
    public set currentCombo(v) { this.matchEngine.currentCombo = v; }
    public get comboTimer() { return this.matchEngine.comboTimer; }
    public set comboTimer(v) { this.matchEngine.comboTimer = v; }
    public get bestCombo() { return this.matchEngine.bestCombo; }
    public get statsEnabled() { return this.statsManager.enabled; }
    public set statsEnabled(v: boolean) { this.statsManager.enabled = v; }
    public getLastMoveGroupSize() { return this.matchEngine.lastMoveGroupSize; }
    public setGravity(direction: GravityDir) { this.physics.setGravity(direction); }
    public findHint() { return this.hintSystem.findHint(); }
    public findDeadlockFix() { return this.hintSystem.findDeadlockFix(); }

    public update(delta: number) {
        // ... (bez zmian) ...
        const dt = delta / 60.0;
        this.matchEngine.update(dt);
        this.hintSystem.update(dt); 
        if (this.statsEnabled && !this.needsMatchCheck && this.cells.every(c => c.state === CellState.IDLE)) {
            this.currentThinkingTime += dt;
            this.statsManager.recordThinkingTime(dt);
        }
        this.updateTimers(delta);
        this.physics.update(delta);
        if (this.needsMatchCheck) {
            this.matchEngine.scanForMatches();
            this.needsMatchCheck = false;
        }
    }

    // --- STAN LOGICZNY (serializacja / symulacja headless) ---

    /** Czy plansza jest w stanie spoczynku (nic nie spada, nie wybucha, brak oczekujących dopasowań). */
    public isSettled(): boolean {
        return !this.needsMatchCheck && this.cells.every(c => c.state === CellState.IDLE);
    }

    /** Czy na planszy istnieje jakiekolwiek dopasowanie (używa prawdziwej detekcji silnika). */
    public hasAnyMatch(): boolean {
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i].typeId !== -1 && this.matchEngine.checkMatchAt(i)) return true;
        }
        return false;
    }

    /** Zrzut czystego stanu logicznego (bez danych wizualnych). */
    public getState(): BoardState {
        return {
            cols: this.cols,
            rows: this.rows,
            cells: this.cells.map(c => ({ typeId: c.typeId, hp: c.hp, maxHp: c.maxHp })),
        };
    }

    /**
     * Wczytuje stan logiczny i ustawia warstwę wizualną w pozycjach spoczynkowych
     * (bez animacji). Wymaga zgodnych wymiarów planszy.
     */
    public loadState(state: BoardState): void {
        if (state.cols !== this.cols || state.rows !== this.rows) {
            throw new Error(`loadState: niezgodne wymiary (${state.cols}x${state.rows} vs ${this.cols}x${this.rows})`);
        }
        this.matchEngine.reset();
        this.hintSystem.reset();
        for (let i = 0; i < this.cells.length; i++) {
            const c = this.cells[i];
            const s = state.cells[i];
            c.typeId = s.typeId; c.hp = s.hp; c.maxHp = s.maxHp;
            c.state = CellState.IDLE;
            const col = i % this.cols; const row = Math.floor(i / this.cols);
            c.x = col; c.y = row; c.targetX = col; c.targetY = row;
            c.velocity = 0; c.timer = 0;
        }
    }

    /**
     * Rozwiązuje planszę do stanu spoczynku BEZ animacji: kaskady dopasowań,
     * wybuchy, grawitacja i dolosowania wykonują się natychmiast.
     * Deterministyczne przy ustalonym ziarnie RNG — używane do walidacji łamigłówek.
     */
    public resolveInstant(maxIterations: number = 1000): number {
        const BIG_DELTA = 1000; // wymusza natychmiastowe lądowanie/wygaszenie w jednym kroku
        this.needsMatchCheck = true;
        let iterations = 0;
        while (iterations++ < maxIterations) {
            this.update(BIG_DELTA);
            if (this.isSettled()) break;
        }
        return iterations;
    }

    public initBoard(levelLayout?: number[][], availableBlockIds?: number[], spawners?: number[]) {
        const { cols, rows } = this;
        this.setGravity(this.config.gravityDir);
        this.cells.length = 0;
        this.matchEngine.reset();
        this.statsManager.reset();
        this.hintSystem.reset();
        this.currentThinkingTime = 0;

        // Wloty (spawnery). Puste = klasyczne zachowanie (cała krawędź generuje bloki).
        this.physics.setSpawners(spawners ?? []);

        // 1. Konfiguracja fizyki (jakie bloki mają spadać)
        if (availableBlockIds && availableBlockIds.length > 0) {
            this.physics.allowedBlockIds = availableBlockIds;
        } else {
            // Fallback: wszystkie kolory
            this.physics.allowedBlockIds = [];
            for(let i=0; i<this.config.blockTypes; i++) this.physics.allowedBlockIds.push(i);
        }

        for (let i = 0; i < cols * rows; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            let chosenType = EMPTY;

            // 2. Czy layout wymusza klocek? (EMPTY=-1 → losuj; VOID=-2 → dziura; >=0 → konkretny)
            if (levelLayout && levelLayout[row] && levelLayout[row][col] !== undefined) {
                const layoutValue = levelLayout[row][col];
                if (layoutValue !== EMPTY) {
                    chosenType = layoutValue;
                }
            }

            // 3. Void = trwała dziura: nie losujemy bloku.
            if (chosenType === VOID) {
                this.cells.push({
                    id: i, typeId: VOID, state: CellState.IDLE,
                    x: col, y: row, targetX: col, targetY: row,
                    velocity: 0, timer: 0, hp: 0, maxHp: 0,
                });
                continue;
            }

            // 4. Jeśli nie wymuszono, losujemy (z puli dozwolonych!)
            if (chosenType === EMPTY) {
                let forbiddenH = -1; let forbiddenV = -1;
                if (col >= 2) { if (this.cells[i-1].typeId === this.cells[i-2].typeId) forbiddenH = this.cells[i-1].typeId; }
                if (row >= 2) { if (this.cells[i-cols].typeId === this.cells[i-(cols*2)].typeId) forbiddenV = this.cells[i-cols].typeId; }

                do {
                    chosenType = BlockRegistry.getRandomBlockIdFromList(this.physics.allowedBlockIds);
                } while (chosenType === forbiddenH || chosenType === forbiddenV);
            }

            const blockDef = BlockRegistry.getById(chosenType);
            const finalHp = blockDef ? blockDef.initialHp : 1;

            this.cells.push({
                id: i, typeId: chosenType, state: CellState.IDLE,
                x: col, y: row, targetX: col, targetY: row,
                velocity: 0, timer: 0,
                hp: finalHp, maxHp: finalHp
            });
        }
    }

    public trySwap(idxA: number, dirX: number, dirY: number): MoveResult {
        const { cols, rows } = this;
        const result: MoveResult = { success: false, causedMatch: false, maxGroupSize: 0 };
        this.matchEngine.lastMoveGroupSize = 0;
        this.hintSystem.reset();

        const col = idxA % cols; const row = Math.floor(idxA / cols);
        const targetCol = col + dirX; const targetRow = row + dirY;
        if (targetCol < 0 || targetCol >= cols || targetRow < 0 || targetRow >= rows) return result;

        const idxB = targetCol + targetRow * cols;
        const cellA = this.cells[idxA]; const cellB = this.cells[idxB];
        
        if (cellA.state !== CellState.IDLE || cellB.state !== CellState.IDLE) return result;

        const defA = BlockRegistry.getById(cellA.typeId);
        const defB = BlockRegistry.getById(cellB.typeId);
        if (!defA || !defB || !defA.isSwappable || !defB.isSwappable) {
            if (this.onBadMove) this.onBadMove();
            return result;
        }
        
        if (this.statsEnabled) {
            this.statsManager.data.totalThinkingTime += this.currentThinkingTime;
        }
        this.currentThinkingTime = 0; 
        
        this.matchEngine.currentCascadeDepth = 0;
        if (AppConfig.comboMode === 'MOVE') this.matchEngine.currentCombo = 0;
        this.matchEngine.lastSwapTargetId = idxB;

        // --- AKTYWACJA / ŁĄCZENIE BLOKÓW SPECJALNYCH ---
        // Zamiana z udziałem specjalnego jest legalna nawet bez dopasowania kolorów.
        if (defA.isSpecial() || defB.isSpecial()) {
            const targetSet = new Set<number>();
            this.resolveSpecialSwap(idxA, defA, idxB, defB, targetSet);
            this.matchEngine.detonate(targetSet);
            this.statsManager.recordMove(true);
            result.success = true;
            result.causedMatch = true;
            return result;
        }

        const tempType = cellA.typeId; cellA.typeId = cellB.typeId; cellB.typeId = tempType;
        const tempX = cellA.x; const tempY = cellA.y;
        cellA.x = cellB.x; cellA.y = cellB.y; cellB.x = tempX; cellB.y = tempY;

        const tempHp = cellA.hp; cellA.hp = cellB.hp; cellB.hp = tempHp;
        const tempMaxHp = cellA.maxHp; cellA.maxHp = cellB.maxHp; cellB.maxHp = tempMaxHp;

        const matchA = this.matchEngine.checkMatchAt(idxA); 
        const matchB = this.matchEngine.checkMatchAt(idxB);
       
       if (matchA || matchB) {
            this.statsManager.recordMove(true);
            cellA.state = CellState.SWAPPING;
            cellB.state = CellState.SWAPPING;
            result.success = true;
            result.causedMatch = true;
        } else {
            this.statsManager.recordMove(false);
            cellB.typeId = cellA.typeId; cellA.typeId = tempType;
            cellB.hp = cellA.hp; cellA.hp = tempHp;
            cellB.maxHp = cellA.maxHp; cellA.maxHp = tempMaxHp;
            
            this.matchEngine.lastSwapTargetId = -1; 
            if (this.onBadMove) this.onBadMove();
            result.success = false;
        }
        return result;
    }

    /**
     * Rozstrzyga efekt zamiany z udziałem bloku(ów) specjalnego, dopisując cele do targetSet.
     * - dwa specjalne → combo z konfigurowalnej tablicy (fallback: każdy aktywuje własne onActivate),
     * - specjalny + zwykły → specjalny aktywuje się w miejscu ZWYKŁEGO (kolor/rząd/obszar sąsiada).
     */
    private resolveSpecialSwap(idxA: number, defA: BlockDefinition, idxB: number, defB: BlockDefinition, targetSet: Set<number>) {
        if (defA.isSpecial() && defB.isSpecial()) {
            const combo = resolveSpecialCombo(defA.id, defB.id);
            if (combo) {
                this.runAction(combo, idxA, targetSet);
                this.runAction(combo, idxB, targetSet);
            } else {
                this.runAction(defA.triggers.onActivate ?? 'NONE', idxA, targetSet);
                this.runAction(defB.triggers.onActivate ?? 'NONE', idxB, targetSet);
            }
        } else {
            const specialDef = defA.isSpecial() ? defA : defB;
            const specialIdx = defA.isSpecial() ? idxA : idxB;
            const normalIdx = defA.isSpecial() ? idxB : idxA;
            // Aktywacja w miejscu zwykłego bloku → CLEAR_COLOR czyści jego kolor,
            // LINE_CLEAR jego rząd, EXPLODE jego okolicę.
            this.runAction(specialDef.triggers.onActivate ?? 'NONE', normalIdx, targetSet);
            targetSet.add(specialIdx);
        }
    }

    public runAction(action: SpecialAction, originIdx: number, targetSet: Set<number>) {
        if (!targetSet.has(originIdx)) {
            const originDef = BlockRegistry.getById(this.cells[originIdx].typeId);
            if (!originDef || !originDef.isIndestructible) {
                targetSet.add(originIdx);
            }
        }
        this.actionManager.execute(action, originIdx, this, targetSet);
    }

    private updateTimers(delta: number) {
        for (const cell of this.cells) {
            if (cell.state === CellState.EXPLODING) {
                cell.timer -= delta;
                if (cell.timer <= 0) {
                    cell.typeId = -1;
                    cell.state = CellState.IDLE;
                }
            }
        }
    }
}