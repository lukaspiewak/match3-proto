import { COLS, ROWS, CellState, AppConfig } from '../Config';
import { BlockRegistry } from '../BlockDef';
import type { BoardLogic } from '../BoardLogic';
import type { MatchEngine } from './MatchEngine';

export class HintSystem {
    private board: BoardLogic;
    private matchEngine: MatchEngine;

    constructor(board: BoardLogic, matchEngine: MatchEngine) {
        this.board = board;
        this.matchEngine = matchEngine;
    }

    public findHint(): number[] | null {
        if (!this.board.cells.every(c => c.state === CellState.IDLE)) return null;
        
        const cells = this.board.cells;
        for (let idx = 0; idx < cells.length; idx++) {
            const cell = cells[idx]; 
            if (cell.typeId === -1) continue;
            
            const col = idx % COLS; 
            const row = Math.floor(idx / COLS);
            
            // Sprawdzamy ruch w prawo
            if (col < COLS - 1) { 
                const rI = idx + 1; 
                if (cells[rI].typeId !== -1 && this.simulateSwap(idx, rI)) return [idx, rI]; 
            }
            // Sprawdzamy ruch w dół
            if (row < ROWS - 1) { 
                const dI = idx + COLS; 
                if (cells[dI].typeId !== -1 && this.simulateSwap(idx, dI)) return [idx, dI]; 
            }
        }
        return null;
    }

    private simulateSwap(idxA: number, idxB: number): boolean {
        const cells = this.board.cells;
        const defA = BlockRegistry.getById(cells[idxA].typeId);
        const defB = BlockRegistry.getById(cells[idxB].typeId);
        
        if (!defA || !defB || !defA.isSwappable || !defB.isSwappable) return false;

        // Symulacja
        const t = cells[idxA].typeId; 
        cells[idxA].typeId = cells[idxB].typeId; 
        cells[idxB].typeId = t;
        
        // Sprawdzenie (używając MatchEngine)
        const hasMatch = this.matchEngine.checkMatchAt(idxA) || this.matchEngine.checkMatchAt(idxB);
        
        // Cofnięcie
        cells[idxB].typeId = cells[idxA].typeId; 
        cells[idxA].typeId = t; 
        
        return hasMatch;
    }

    public findDeadlockFix(): { id: number, targetType: number } | null {
        const cells = this.board.cells;
        for (let i = 0; i < cells.length; i++) {
            const originalType = cells[i].typeId; 
            if (originalType === -1) continue;
            
            // Próbujemy podmienić klocek na każdy inny dostępny typ
            for (let t = 0; t < AppConfig.blockTypes; t++) {
                if (t === originalType) continue; 
                
                cells[i].typeId = t;
                if (this.findHint() !== null) { 
                    cells[i].typeId = originalType; 
                    return { id: i, targetType: t }; 
                }
            } 
            cells[i].typeId = originalType;
        } 
        return null;
    }
}