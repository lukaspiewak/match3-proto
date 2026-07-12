import { CellState, VisualConfig, COMBO_BONUS_SECONDS } from '../Config';
import { BlockRegistry, type SpecialAction } from '../BlockDef';
import type { BoardLogic } from '../BoardLogic';

export class MatchEngine {
    private board: BoardLogic;
    
    public currentCombo: number = 0;
    public bestCombo: number = 0;
    public comboTimer: number = 0;
    
    public currentCascadeDepth: number = 0;
    public lastMoveGroupSize: number = 0;
    public lastSwapTargetId: number = -1;

    constructor(board: BoardLogic) {
        this.board = board;
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
        const initialMatches = new Set<number>();
        const cells = this.board.cells;
        const cols = this.board.cols;
        const rows = this.board.rows;

        // Skanowanie (bez zmian)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 2; c++) {
                const idx = c + r * cols;
                const type = cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                if (type === -1 || cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                let matchLen = 1;
                while (c + matchLen < cols && cells[c + matchLen + r * cols].typeId === type && cells[c + matchLen + r * cols].state === CellState.IDLE) matchLen++;
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add((c + k) + r * cols);
                    c += matchLen - 1;
                }
            }
        }
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows - 2; r++) {
                const idx = c + r * cols;
                const type = cells[idx].typeId;
                const def = BlockRegistry.getById(type);
                if (type === -1 || cells[idx].state !== CellState.IDLE || !def || !def.isMatchable) continue;
                let matchLen = 1;
                while (r + matchLen < rows && cells[c + (r + matchLen) * cols].typeId === type && cells[c + (r + matchLen) * cols].state === CellState.IDLE) matchLen++;
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) initialMatches.add(c + (r + k) * cols);
                    r += matchLen - 1;
                }
            }
        }
        
        if (initialMatches.size > 0) {
            const finalMatches = new Set(initialMatches);
            
            this.processMatchEffects(initialMatches, finalMatches);

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
        const cells = this.board.cells;
        const cols = this.board.cols;
        const rows = this.board.rows;
        const cell = cells[idx];
        const type = cell.typeId;
        if (type === -1) return false;

        const def = BlockRegistry.getById(type);
        if (!def || !def.isMatchable) return false;

        const col = idx % cols; const row = Math.floor(idx / cols);
        let countH = 1, i = 1; while (col-i>=0 && cells[idx-i].typeId===type && cells[idx-i].state===CellState.IDLE) { countH++; i++; }
        i=1; while (col+i<cols && cells[idx+i].typeId===type && cells[idx+i].state===CellState.IDLE) { countH++; i++; }
        if (countH>=3) return true;
        
        let countV = 1; i=1; while (row-i>=0 && cells[idx-i*cols].typeId===type && cells[idx-i*cols].state===CellState.IDLE) { countV++; i++; }
        i=1; while (row+i<rows && cells[idx+i*cols].typeId===type && cells[idx+i*cols].state===CellState.IDLE) { countV++; i++; }
        if (countV>=3) return true; 
        
        return false;
    }

    private processMatchEffects(initialMatches: Set<number>, finalMatches: Set<number>) {
        const visited = new Set<number>();
        const indices = Array.from(initialMatches);
        const cells = this.board.cells;
        const cols = this.board.cols;
        const rows = this.board.rows;

        for (const idx of indices) {
            if (visited.has(idx)) continue;
            
            const typeId = cells[idx].typeId;
            const group = [idx];
            const stack = [idx];
            visited.add(idx);

            // Grouping logic (flood fill)
            while (stack.length > 0) {
                const current = stack.pop()!;
                const c = current % cols; const r = Math.floor(current / cols);
                const neighbors = [{c:c+1,r:r}, {c:c-1,r:r}, {c:c,r:r+1}, {c:c,r:r-1}];
                for (const n of neighbors) {
                    if (n.c >= 0 && n.c < cols && n.r >= 0 && n.r < rows) {
                        const nIdx = n.c + n.r * cols;
                        if (initialMatches.has(nIdx) && !visited.has(nIdx)) {
                            if (cells[nIdx].typeId === typeId) {
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
                // --- ZMIANA: Obsługa akcji tworzenia (CREATE_*) ---
                if (action.startsWith('CREATE_')) {
                    // Akcje tworzenia (CREATE_SPECIAL, CREATE_WALL itp.) uruchamiamy TYLKO RAZ dla grupy.
                    // Wybieramy najlepsze miejsce (tam gdzie gracz ruszył).
                    
                    let targetIdx = group[0];
                    if (this.lastSwapTargetId !== -1 && group.includes(this.lastSwapTargetId)) {
                        targetIdx = this.lastSwapTargetId;
                    }
                    
                    // Uruchamiamy akcję przez ActionManager
                    // ActionManager z nowym CreateBlockAction zajmie się resztą (usuwaniem z finalMatches)
                    this.board.runAction(action, targetIdx, finalMatches);
                    
                } else {
                    // Inne akcje (np. EXPLODE) uruchamiamy dla każdego klocka w grupie
                    group.forEach(gIdx => this.board.runAction(action, gIdx, finalMatches));
                }
            }
        }
    }

    // USUNIĘTO createSpecialBlock - teraz to robi CreateBlockAction w ActionManagerze

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