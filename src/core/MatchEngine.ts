import { CellState, COLS, ROWS, AppConfig, COMBO_BONUS_SECONDS } from '../Config';
import { BlockRegistry, SPECIAL_BLOCK_ID, type SpecialAction } from '../BlockDef';
import type { BoardLogic } from '../BoardLogic';

export class MatchEngine {
    private board: BoardLogic;
    
    // Stan Combo przeniesiony (lub zarządzany) tutaj
    public currentCombo: number = 0;
    public bestCombo: number = 0;
    public comboTimer: number = 0;
    
    public currentCascadeDepth: number = 0;
    public lastMoveGroupSize: number = 0;
    
    // Kontekst ostatniego ruchu (dla tworzenia specjala w miejscu akcji)
    public lastSwapTargetId: number = -1;

    constructor(board: BoardLogic) {
        this.board = board;
    }

    public update(dt: number) {
        // Obsługa Timerów Combo
        if (AppConfig.comboMode === 'TIME' && this.currentCombo > 0) {
            const isBoardBusy = !this.board.cells.every(c => c.state === CellState.IDLE);
            const shouldPause = (AppConfig.gameMode !== 'SOLO' && isBoardBusy);

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
        const initialMatches = new Set<number>();
        const cells = this.board.cells;

        // Horyzontalne
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                const idx = c + r * COLS;
                const type = cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                
                if (type === -1 || cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                
                let matchLen = 1;
                while (c + matchLen < COLS 
                       && cells[c + matchLen + r * COLS].typeId === type 
                       && cells[c + matchLen + r * COLS].state === CellState.IDLE) matchLen++;
                
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add((c + k) + r * COLS);
                    c += matchLen - 1;
                }
            }
        }

        // Wertykalne
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                const idx = c + r * COLS;
                const type = cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                
                if (type === -1 || cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                
                let matchLen = 1;
                while (r + matchLen < ROWS 
                       && cells[c + (r + matchLen) * COLS].typeId === type 
                       && cells[c + (r + matchLen) * COLS].state === CellState.IDLE) matchLen++;
                
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add(c + (r + k) * COLS);
                    r += matchLen - 1;
                }
            }
        }
        
        if (initialMatches.size > 0) {
            const finalMatches = new Set(initialMatches);
            
            // Logika efektów specjalnych (tworzenie bomb itp.)
            this.processMatchEffects(initialMatches, finalMatches);

            this.currentCascadeDepth++;
            if (this.currentCascadeDepth > 1 && this.board.statsEnabled) {
                if (this.currentCascadeDepth > this.board.stats.highestCascade) {
                    this.board.stats.highestCascade = this.currentCascadeDepth;
                }
                console.log(`🌊 Cascade Depth: ${this.currentCascadeDepth}`);
            }

            this.updateStats(finalMatches);

            this.currentCombo++;
            if (AppConfig.comboMode === 'TIME') this.comboTimer += COMBO_BONUS_SECONDS;
            
            // Oznaczanie klocków do zniszczenia i emitowanie eventu
            finalMatches.forEach(idx => {
                const cell = cells[idx];
                if (cell.state !== CellState.EXPLODING) {
                    cell.state = CellState.EXPLODING;
                    cell.timer = this.board.EXPLOSION_TIME;
                    
                    this.board.emit('explode', { 
                        id: cell.id, 
                        typeId: cell.typeId, 
                        x: cell.x, 
                        y: cell.y 
                    });
                }
            });
        }
    }

    public checkMatchAt(idx: number): boolean { 
        const cells = this.board.cells;
        const cell = cells[idx]; 
        const type = cell.typeId; 
        if (type === -1) return false;
        
        const def = BlockRegistry.getById(type);
        if (!def || !def.isMatchable) return false;

        const col = idx % COLS; 
        const row = Math.floor(idx / COLS);
        
        let countH = 1, i = 1; 
        while (col-i>=0 && cells[idx-i].typeId===type && cells[idx-i].state===CellState.IDLE) { countH++; i++; }
        i=1; 
        while (col+i<COLS && cells[idx+i].typeId===type && cells[idx+i].state===CellState.IDLE) { countH++; i++; }
        if (countH>=3) return true;
        
        let countV = 1; i=1; 
        while (row-i>=0 && cells[idx-i*COLS].typeId===type && cells[idx-i*COLS].state===CellState.IDLE) { countV++; i++; }
        i=1; 
        while (row+i<ROWS && cells[idx+i*COLS].typeId===type && cells[idx+i*COLS].state===CellState.IDLE) { countV++; i++; }
        if (countV>=3) return true; 
        
        return false;
    }

    private processMatchEffects(initialMatches: Set<number>, finalMatches: Set<number>) {
        const visited = new Set<number>();
        const indices = Array.from(initialMatches);
        const cells = this.board.cells;

        for (const idx of indices) {
            if (visited.has(idx)) continue;
            
            const typeId = cells[idx].typeId;
            const group = [idx];
            const stack = [idx];
            visited.add(idx);

            // Flood fill do znalezienia grupy
            while (stack.length > 0) {
                const current = stack.pop()!;
                const c = current % COLS; 
                const r = Math.floor(current / COLS);
                const neighbors = [{c:c+1,r:r}, {c:c-1,r:r}, {c:c,r:r+1}, {c:c,r:r-1}];
                
                for (const n of neighbors) {
                    if (n.c >= 0 && n.c < COLS && n.r >= 0 && n.r < ROWS) {
                        const nIdx = n.c + n.r * COLS;
                        if (initialMatches.has(nIdx) && !visited.has(nIdx)) {
                            if (cells[nIdx].typeId === typeId) {
                                visited.add(nIdx); 
                                stack.push(nIdx); 
                                group.push(nIdx);
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
                if (action === 'CREATE_SPECIAL') {
                    this.createSpecialBlock(group, finalMatches);
                } else {
                    // Delegujemy wykonanie akcji do BoardLogic -> ActionManager
                    group.forEach(gIdx => this.board.runAction(action, gIdx, finalMatches));
                }
            }
        }
    }

    private createSpecialBlock(groupIndices: number[], finalMatches: Set<number>) {
        let targetIdx = groupIndices[0];
        // Używamy zapamiętanego ID celu ruchu, jeśli należy do grupy
        if (this.lastSwapTargetId !== -1 && groupIndices.includes(this.lastSwapTargetId)) {
            targetIdx = this.lastSwapTargetId;
        }

        console.log(`✨ Creating Special Block at index ${targetIdx}`);
        
        const cell = this.board.cells[targetIdx];
        cell.typeId = SPECIAL_BLOCK_ID;
        cell.state = CellState.IDLE;
        
        // Usuwamy z listy do zniszczenia
        finalMatches.delete(targetIdx);
    }

    private updateStats(finalMatches: Set<number>) {
        const stats = this.board.stats;
        let groupSize = finalMatches.size; 
        if (groupSize > this.lastMoveGroupSize) this.lastMoveGroupSize = groupSize;

        finalMatches.forEach(idx => {
            const type = this.board.cells[idx].typeId;
            if (this.board.statsEnabled && stats.colorClears[type] !== undefined) {
                stats.colorClears[type]++;
            }
        });
        
        if (this.board.statsEnabled) {
             if (groupSize >= 5) {
                stats.matchCounts[5]++;
                console.log(`✨ MASSIVE CLEAR (Size: ${groupSize})`);
            } else if (groupSize === 4) {
                stats.matchCounts[4]++;
            } else if (groupSize === 3) {
                stats.matchCounts[3]++;
            }
        }
    }

    public reset() {
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.comboTimer = 0;
        this.currentCascadeDepth = 0;
        this.lastMoveGroupSize = 0;
    }
}