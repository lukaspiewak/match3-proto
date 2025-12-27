// ... (importy bez zmian) ...
import { EventEmitter } from 'pixi.js';
import { 
    COLS, ROWS, CellState, type Cell, 
    type GravityDir, 
    AppConfig, VisualConfig
} from './Config';
import { Random } from './Random';
import { BlockRegistry, type SpecialAction, SPECIAL_BLOCK_ID } from './BlockDef';
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
    // ... (reszta pól bez zmian) ...
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
        this.statsManager = new StatsManager();
        this.actionManager = new ActionManager();
        this.physics = new GridPhysics(this.cells);
        this.matchEngine = new MatchEngine(this);
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

    // --- ZMODYFIKOWANA METODA INIT ---
    public initBoard(levelLayout?: number[][], availableBlockIds?: number[]) {
        this.setGravity(AppConfig.gravityDir);
        this.cells.length = 0;
        this.matchEngine.reset();
        this.statsManager.reset();
        this.hintSystem.reset();
        this.currentThinkingTime = 0;

        // 1. Konfiguracja fizyki (jakie bloki mają spadać)
        if (availableBlockIds && availableBlockIds.length > 0) {
            this.physics.allowedBlockIds = availableBlockIds;
        } else {
            // Fallback: wszystkie kolory
            this.physics.allowedBlockIds = [];
            for(let i=0; i<AppConfig.blockTypes; i++) this.physics.allowedBlockIds.push(i);
        }

        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            let chosenType = -1;

            // 2. Czy layout wymusza klocek?
            if (levelLayout && levelLayout[row] && levelLayout[row][col] !== undefined) {
                const layoutValue = levelLayout[row][col];
                if (layoutValue !== -1) {
                    chosenType = layoutValue;
                }
            }

            // 3. Jeśli nie, losujemy (z puli dozwolonych!)
            if (chosenType === -1) {
                let forbiddenH = -1; let forbiddenV = -1;
                if (col >= 2) { if (this.cells[i-1].typeId === this.cells[i-2].typeId) forbiddenH = this.cells[i-1].typeId; }
                if (row >= 2) { if (this.cells[i-COLS].typeId === this.cells[i-(COLS*2)].typeId) forbiddenV = this.cells[i-COLS].typeId; }
                
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
        // ... (bez zmian) ...
        const result: MoveResult = { success: false, causedMatch: false, maxGroupSize: 0 };
        this.matchEngine.lastMoveGroupSize = 0; 
        this.hintSystem.reset(); 

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