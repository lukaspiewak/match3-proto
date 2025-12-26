import { 
    COLS, ROWS, CellState, type Cell, 
    type GravityDir, 
    COMBO_BONUS_SECONDS, AppConfig 
} from './Config';
import { Random } from './Random';
import { BlockRegistry, type SpecialAction, SPECIAL_BLOCK_ID } from './BlockDef';
import { GridPhysics } from './core/GridPhysics';
// NOWOŚĆ: Import Managera Akcji
import { ActionManager } from './actions/ActionManager';

export interface MoveResult {
    success: boolean;       
    causedMatch: boolean;   
    maxGroupSize: number;   
}

export interface GameStats {
    totalMoves: number;             
    invalidMoves: number;           
    totalThinkingTime: number;      
    highestCascade: number;         
    matchCounts: { [size: number]: number }; 
    colorClears: { [typeId: number]: number };
}

export class BoardLogic {
    public cells: Cell[];
    private physics: GridPhysics;
    // NOWOŚĆ: Instancja ActionManager
    private actionManager: ActionManager;

    public needsMatchCheck: boolean = false;
    public statsEnabled: boolean = false; 

    public readonly EXPLOSION_TIME = 15.0; 

    public onBadMove: (() => void) | null = null;
    
    public currentCombo: number = 0;
    public bestCombo: number = 0;       
    public comboTimer: number = 0;      

    public stats: GameStats;
    private currentCascadeDepth: number = 0;
    private currentThinkingTime: number = 0; 

    private lastMoveGroupSize: number = 0;
    private lastSwapTargetId: number = -1;

    constructor() {
        this.stats = {
            totalMoves: 0, invalidMoves: 0, totalThinkingTime: 0,
            highestCascade: 0, matchCounts: { 3: 0, 4: 0, 5: 0 }, 
            colorClears: {}
        };
        for(let i=0; i < AppConfig.blockTypes; i++) this.stats.colorClears[i] = 0;

        this.cells = [];
        this.physics = new GridPhysics(this.cells);
        // Inicjalizacja Managera Akcji
        this.actionManager = new ActionManager();
        
        this.physics.onNeedsMatchCheck = () => {
            this.needsMatchCheck = true;
        };
        
        this.physics.onDropDown = (id) => {
            const def = BlockRegistry.getById(this.cells[id].typeId);
            if (def && def.triggers.onDropDown !== 'NONE') {
                // DELEGACJA DO ACTION MANAGER
                this.runAction(def.triggers.onDropDown, id, new Set([id]));
                
                if (this.cells[id].state !== CellState.IDLE) {
                    this.needsMatchCheck = false;
                }
            }
        };

        this.initBoard();
    }

    public setGravity(direction: GravityDir) {
        this.physics.setGravity(direction);
    }

    public initBoard() {
        this.setGravity(AppConfig.gravityDir);
        this.cells.length = 0;
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.comboTimer = 0;
        this.currentCascadeDepth = 0;
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

            this.cells.push({
                id: i, typeId: chosenType, state: CellState.IDLE,
                x: col, y: row, targetX: col, targetY: row,
                velocity: 0, timer: 0
            });
        }
    }

    public update(delta: number) {
        const dt = delta / 60.0;

        if (AppConfig.comboMode === 'TIME' && this.currentCombo > 0) {
            const isBoardBusy = !this.cells.every(c => c.state === CellState.IDLE);
            const shouldPause = (AppConfig.gameMode !== 'SOLO' && isBoardBusy);

            if (!shouldPause) {
                this.comboTimer -= dt; 
                if (this.comboTimer <= 0) {
                    this.comboTimer = 0;
                    this.currentCombo = 0; 
                }
            }
        }

        if (this.statsEnabled && !this.needsMatchCheck && this.cells.every(c => c.state === CellState.IDLE)) {
            this.currentThinkingTime += dt;
        }

        this.updateTimers(delta);
        this.physics.update(delta);

        if (this.needsMatchCheck) {
            this.detectMatches();
            this.needsMatchCheck = false;
        }
    }

    public trySwap(idxA: number, dirX: number, dirY: number): MoveResult {
        const result: MoveResult = { success: false, causedMatch: false, maxGroupSize: 0 };
        this.lastMoveGroupSize = 0;

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
            this.stats.totalThinkingTime += this.currentThinkingTime;
        }
        this.currentThinkingTime = 0; 
        this.currentCascadeDepth = 0;

        if (AppConfig.comboMode === 'MOVE') this.currentCombo = 0;

        this.lastSwapTargetId = idxB;

        const tempType = cellA.typeId; cellA.typeId = cellB.typeId; cellB.typeId = tempType;
        const tempX = cellA.x; const tempY = cellA.y;
        cellA.x = cellB.x; cellA.y = cellB.y; cellB.x = tempX; cellB.y = tempY;

        const matchA = this.checkMatchAt(idxA); const matchB = this.checkMatchAt(idxB);
       
       if (matchA || matchB) {
            if (this.statsEnabled) {
                this.stats.totalMoves++;
                console.log(`✅ Player Move #${this.stats.totalMoves}`);
            }
            cellA.state = CellState.SWAPPING;
            cellB.state = CellState.SWAPPING;
            result.success = true;
            result.causedMatch = true;
        } else {
            if (this.statsEnabled) {
                this.stats.invalidMoves++;
                console.log(`❌ Invalid Player Move`);
            }
            cellB.typeId = cellA.typeId; cellA.typeId = tempType;
            this.lastSwapTargetId = -1; 
            if (this.onBadMove) this.onBadMove();
            result.success = false;
        }
        return result;
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

    public detectMatches() {
        const initialMatches = new Set<number>();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                if (type === -1 || this.cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                let matchLen = 1;
                while (c + matchLen < COLS && this.cells[c + matchLen + r * COLS].typeId === type && this.cells[c + matchLen + r * COLS].state === CellState.IDLE) matchLen++;
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add((c + k) + r * COLS);
                    c += matchLen - 1;
                }
            }
        }
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                if (type === -1 || this.cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                let matchLen = 1;
                while (r + matchLen < ROWS && this.cells[c + (r + matchLen) * COLS].typeId === type && this.cells[c + (r + matchLen) * COLS].state === CellState.IDLE) matchLen++;
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add(c + (r + k) * COLS);
                    r += matchLen - 1;
                }
            }
        }
        
        if (initialMatches.size > 0) {
            const finalMatches = new Set(initialMatches);
            this.processMatchEffects(initialMatches, finalMatches);
            this.currentCascadeDepth++;
            if (this.currentCascadeDepth > 1 && this.statsEnabled) {
                if (this.currentCascadeDepth > this.stats.highestCascade) this.stats.highestCascade = this.currentCascadeDepth;
                console.log(`🌊 Cascade Depth: ${this.currentCascadeDepth}`);
            }
            this.updateStats(finalMatches);
            this.currentCombo++;
            if (AppConfig.comboMode === 'TIME') this.comboTimer += COMBO_BONUS_SECONDS;
            
            finalMatches.forEach(idx => {
                const cell = this.cells[idx];
                if (cell.state !== CellState.EXPLODING) {
                    cell.state = CellState.EXPLODING;
                    cell.timer = this.EXPLOSION_TIME;
                }
            });
        }
    }

    private processMatchEffects(initialMatches: Set<number>, finalMatches: Set<number>) {
        const visited = new Set<number>();
        const indices = Array.from(initialMatches);
        for (const idx of indices) {
            if (visited.has(idx)) continue;
            const typeId = this.cells[idx].typeId;
            const group = [idx];
            const stack = [idx];
            visited.add(idx);
            while (stack.length > 0) {
                const current = stack.pop()!;
                const c = current % COLS; const r = Math.floor(current / COLS);
                const neighbors = [{c:c+1,r:r}, {c:c-1,r:r}, {c:c,r:r+1}, {c:c,r:r-1}];
                for (const n of neighbors) {
                    if (n.c >= 0 && n.c < COLS && n.r >= 0 && n.r < ROWS) {
                        const nIdx = n.c + n.r * COLS;
                        if (initialMatches.has(nIdx) && !visited.has(nIdx)) {
                            if (this.cells[nIdx].typeId === typeId) {
                                visited.add(nIdx); stack.push(nIdx); group.push(nIdx);
                            }
                        }
                    }
                }
            }
            const size = group.length;
            const blockDef = BlockRegistry.getById(typeId);
            if (!blockDef) continue;
            let action: SpecialAction = 'NONE';
            if (size >= 5) action = blockDef.triggers.onMatch5;
            else if (size === 4) action = blockDef.triggers.onMatch4;
            else if (size === 3) action = blockDef.triggers.onMatch3;

            if (action !== 'NONE') {
                console.log(`⚡ Trigger: ${action} on ${blockDef.name} (Size: ${size})`);
                if (action === 'CREATE_SPECIAL') this.createSpecialBlock(group, finalMatches);
                else {
                    // DELEGACJA DO ACTION MANAGER
                    group.forEach(gIdx => this.runAction(action, gIdx, finalMatches));
                }
            }
        }
    }

    private createSpecialBlock(groupIndices: number[], finalMatches: Set<number>) {
        let targetIdx = groupIndices[0];
        if (this.lastSwapTargetId !== -1 && groupIndices.includes(this.lastSwapTargetId)) {
            targetIdx = this.lastSwapTargetId;
        }
        console.log(`✨ Creating Special Block at index ${targetIdx}`);
        this.cells[targetIdx].typeId = SPECIAL_BLOCK_ID;
        this.cells[targetIdx].state = CellState.IDLE;
        finalMatches.delete(targetIdx);
    }

    // Nowa metoda pomocnicza, która zastępuje executeSpecialAction
    private runAction(action: SpecialAction, originIdx: number, targetSet: Set<number>) {
        // Zawsze dodajemy źródło do zniszczenia (chyba że strategia zdecyduje inaczej, 
        // ale domyślnie chcemy zniszczyć klocek, który wywołał akcję).
        // W poprzedniej wersji robiliśmy to w executeSpecialAction. 
        // Tutaj możemy to zrobić przed delegacją lub w każdej strategii.
        // Dla czystości, zrobimy to "przed", ale z uwzględnieniem indestructible.
        
        if (!targetSet.has(originIdx)) {
            const originDef = BlockRegistry.getById(this.cells[originIdx].typeId);
            if (!originDef || !originDef.isIndestructible) {
                targetSet.add(originIdx);
            }
        }

        // Uruchomienie strategii
        this.actionManager.execute(action, originIdx, this, targetSet);
    }

    // updateStats, getLastMoveGroupSize, checkMatchAt, findHint, simulateSwap, findDeadlockFix - bez zmian
    
    private updateStats(finalMatches: Set<number>) {
        let groupSize = finalMatches.size; 
        if (groupSize > this.lastMoveGroupSize) this.lastMoveGroupSize = groupSize;
        finalMatches.forEach(idx => {
            const type = this.cells[idx].typeId;
            if (this.statsEnabled && this.stats.colorClears[type] !== undefined) this.stats.colorClears[type]++;
        });
        if (this.statsEnabled) {
             if (groupSize >= 5) {
                this.stats.matchCounts[5]++;
                console.log(`✨ MASSIVE CLEAR (Size: ${groupSize})`);
            } else if (groupSize === 4) {
                this.stats.matchCounts[4]++;
            } else if (groupSize === 3) {
                this.stats.matchCounts[3]++;
            }
        }
    }
    
    public getLastMoveGroupSize(): number { return this.lastMoveGroupSize; }

    private checkMatchAt(idx: number): boolean { 
        const cell = this.cells[idx]; const type = cell.typeId; if (type === -1) return false;
        const def = BlockRegistry.getById(type);
        if (!def || !def.isMatchable) return false;
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        let countH = 1, i = 1; while (col-i>=0 && this.cells[idx-i].typeId===type && this.cells[idx-i].state===CellState.IDLE) { countH++; i++; }
        i=1; while(col+i<COLS && this.cells[idx+i].typeId===type && this.cells[idx+i].state===CellState.IDLE) { countH++; i++; }
        if (countH>=3) return true;
        let countV = 1; i=1; while(row-i>=0 && this.cells[idx-i*COLS].typeId===type && this.cells[idx-i*COLS].state===CellState.IDLE) { countV++; i++; }
        i=1; while(row+i<ROWS && this.cells[idx+i*COLS].typeId===type && this.cells[idx+i*COLS].state===CellState.IDLE) { countV++; i++; }
        if (countV>=3) return true; return false;
    }

    public findHint(): number[] | null {
        if (!this.cells.every(c => c.state === CellState.IDLE)) return null;
        for (let idx = 0; idx < this.cells.length; idx++) {
            const cell = this.cells[idx]; if (cell.typeId === -1) continue;
            const col = idx % COLS; const row = Math.floor(idx / COLS);
            if (col < COLS - 1) { const rI = idx + 1; if (this.cells[rI].typeId!==-1 && this.simulateSwap(idx,rI)) return [idx,rI]; }
            if (row < ROWS - 1) { const dI = idx + COLS; if (this.cells[dI].typeId!==-1 && this.simulateSwap(idx,dI)) return [idx,dI]; }
        } return null;
    }
    private simulateSwap(idxA: number, idxB: number): boolean {
        const defA = BlockRegistry.getById(this.cells[idxA].typeId);
        const defB = BlockRegistry.getById(this.cells[idxB].typeId);
        if (!defA || !defB || !defA.isSwappable || !defB.isSwappable) return false;
        const t = this.cells[idxA].typeId; this.cells[idxA].typeId = this.cells[idxB].typeId; this.cells[idxB].typeId = t;
        const h = this.checkMatchAt(idxA) || this.checkMatchAt(idxB);
        this.cells[idxB].typeId = this.cells[idxA].typeId; this.cells[idxA].typeId = t; return h;
    }
    public findDeadlockFix(): { id: number, targetType: number } | null {
        for (let i = 0; i < this.cells.length; i++) {
            const o = this.cells[i].typeId; if (o === -1) continue;
            for (let t = 0; t < AppConfig.blockTypes; t++) {
                if (t === o) continue; this.cells[i].typeId = t;
                if (this.findHint() !== null) { this.cells[i].typeId = o; return { id: i, targetType: t }; }
            } this.cells[i].typeId = o;
        } return null;
    }
}