import { EventEmitter } from 'pixi.js';
import { 
    COLS, ROWS, CellState, type Cell, 
    type GravityDir, 
    AppConfig, VisualConfig
} from './Config';
import { BlockRegistry, type SpecialAction } from './BlockDef';

// Importy Podsystemów
import { GridPhysics } from './core/GridPhysics';
import { MatchEngine } from './core/MatchEngine';
import { HintSystem } from './core/HintSystem';
import { ActionManager } from './actions/ActionManager';
import { StatsManager } from './core/StatsManager';

export interface MoveResult {
    success: boolean;       
    causedMatch: boolean;   
    maxGroupSize: number;   
}

export class BoardLogic extends EventEmitter {
    public cells: Cell[];
    
    // Podsystemy
    public statsManager: StatsManager;
    private physics: GridPhysics;
    private matchEngine: MatchEngine;
    private hintSystem: HintSystem;
    private actionManager: ActionManager;

    public needsMatchCheck: boolean = false;
    public statsEnabled: boolean = false; 

    public onBadMove: (() => void) | null = null;
    
    private currentThinkingTime: number = 0; 

    constructor() {
        super();
        this.cells = [];
        
        // Inicjalizacja Podsystemów
        this.statsManager = new StatsManager();
        this.actionManager = new ActionManager();
        this.physics = new GridPhysics(this.cells);
        this.matchEngine = new MatchEngine(this);
        this.hintSystem = new HintSystem(this, this.matchEngine);
        
        // Konfiguracja Fizyki - callbacki
        this.physics.onNeedsMatchCheck = () => { this.needsMatchCheck = true; };
        
        this.physics.onDropDown = (id) => {
            const def = BlockRegistry.getById(this.cells[id].typeId);
            if (def && def.triggers.onDropDown !== 'NONE') {
                this.runAction(def.triggers.onDropDown, id, new Set([id]));
                if (this.cells[id].state !== CellState.IDLE) {
                    this.needsMatchCheck = false;
                }
            }
        };

        this.initBoard();
    }

    // --- Proxy Properties (API dla innych modułów) ---
    public get currentCombo() { return this.matchEngine.currentCombo; }
    public set currentCombo(v) { this.matchEngine.currentCombo = v; }
    public get comboTimer() { return this.matchEngine.comboTimer; }
    public set comboTimer(v) { this.matchEngine.comboTimer = v; }
    public get bestCombo() { return this.matchEngine.bestCombo; }
    public getLastMoveGroupSize() { return this.matchEngine.lastMoveGroupSize; }
    
    public setGravity(direction: GravityDir) { this.physics.setGravity(direction); }
    public findHint() { return this.hintSystem.findHint(); }
    public findDeadlockFix() { return this.hintSystem.findDeadlockFix(); }

    // --- Główna Pętla ---

    public update(delta: number) {
        const dt = delta / 60.0;
        
        this.matchEngine.update(dt);
        this.hintSystem.update(dt); // Aktualizacja hintów

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

    public initBoard() {
        this.setGravity(AppConfig.gravityDir);
        this.cells.length = 0;
        this.matchEngine.reset();
        this.statsManager.reset();
        this.hintSystem.reset();
        this.currentThinkingTime = 0;

        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            let forbiddenH = -1; let forbiddenV = -1;
            if (col >= 2) { if (this.cells[i-1].typeId === this.cells[i-2].typeId) forbiddenH = this.cells[i-1].typeId; }
            if (row >= 2) { if (this.cells[i-COLS].typeId === this.cells[i-(COLS*2)].typeId) forbiddenV = this.cells[i-COLS].typeId; }
            
            let chosenType;
            do { chosenType = BlockRegistry.getRandomBlockId(AppConfig.blockTypes); } 
            while (chosenType === forbiddenH || chosenType === forbiddenV);

            const blockDef = BlockRegistry.getById(chosenType);

            this.cells.push({
                id: i, 
                typeId: chosenType, 
                state: CellState.IDLE,
                x: col, y: row, targetX: col, targetY: row,
                velocity: 0, timer: 0,
                hp: blockDef.initialHp,      // Inicjalizacja HP
                maxHp: blockDef.initialHp
            });
        }
    }

    public trySwap(idxA: number, dirX: number, dirY: number): MoveResult {
        const result: MoveResult = { success: false, causedMatch: false, maxGroupSize: 0 };
        this.matchEngine.lastMoveGroupSize = 0; 
        this.hintSystem.reset(); // Reset podpowiedzi przy ruchu

        const col = idxA % COLS; const row = Math.floor(idxA / COLS);
        const targetCol = col + dirX; const targetRow = row + dirY;
        if (targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) return result;
        
        const idxB = targetCol + targetRow * COLS;
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

        // Zamiana logiczna i fizyczna
        const tempType = cellA.typeId; cellA.typeId = cellB.typeId; cellB.typeId = tempType;
        const tempX = cellA.x; const tempY = cellA.y;
        cellA.x = cellB.x; cellA.y = cellB.y; cellB.x = tempX; cellB.y = tempY;

        // Przenosimy też HP przy zamianie!
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
            // Cofanie
            cellB.typeId = cellA.typeId; cellA.typeId = tempType;
            cellB.hp = cellA.hp; cellA.hp = tempHp;
            cellB.maxHp = cellA.maxHp; cellA.maxHp = tempMaxHp;
            
            this.matchEngine.lastSwapTargetId = -1; 
            if (this.onBadMove) this.onBadMove();
            result.success = false;
        }
        return result;
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