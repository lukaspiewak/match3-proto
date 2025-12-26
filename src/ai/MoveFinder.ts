import { BoardLogic } from '../BoardLogic';
import { AppConfig, COLS, ROWS, CellState } from '../Config';
import { Random } from '../Random';
import { BlockRegistry } from '../BlockDef'; // Dodano import

export interface BestMove {
    idxA: number;
    dirX: number;
    dirY: number;
    score: number;
}

export class MoveFinder {
    
    /**
     * Główna metoda AI. Skanuje planszę, symuluje ruchy i wybiera najlepszy.
     */
    public static getBestMove(logic: BoardLogic): BestMove | null {
        if (!logic.cells.every(c => c.state === CellState.IDLE)) return null;
        
        let bestMove: BestMove | null = null;
        let bestScore = -Infinity;

        for (let idx = 0; idx < logic.cells.length; idx++) {
            const cell = logic.cells[idx]; 
            if (cell.typeId === -1) continue;
            
            // Walidacja źródła: czy ten blok w ogóle można ruszyć?
            const defA = BlockRegistry.getById(cell.typeId);
            if (!defA || !defA.isSwappable) continue;

            const col = idx % COLS; 
            const row = Math.floor(idx / COLS);

            const moves = [];
            if (col < COLS - 1) moves.push({ target: idx + 1, dirX: 1, dirY: 0 }); 
            if (row < ROWS - 1) moves.push({ target: idx + COLS, dirX: 0, dirY: 1 }); 

            for (const m of moves) {
                const otherIdx = m.target;
                if (logic.cells[otherIdx].typeId === -1) continue;

                // Walidacja celu: czy sąsiada można ruszyć?
                const defB = BlockRegistry.getById(logic.cells[otherIdx].typeId);
                if (!defB || !defB.isSwappable) continue;

                // --- SYMULACJA ZAMIANY ---
                const t1 = logic.cells[idx].typeId;
                const t2 = logic.cells[otherIdx].typeId;
                
                logic.cells[idx].typeId = t2;
                logic.cells[otherIdx].typeId = t1;

                const sizeA = this.getMatchSizeAt(logic, idx);
                const sizeB = this.getMatchSizeAt(logic, otherIdx);
                const maxSize = Math.max(sizeA, sizeB);

                if (maxSize >= 3) {
                    let score = 0;
                    
                    if (maxSize === 3) score += 10;
                    else if (maxSize === 4) score += 50;
                    else if (maxSize >= 5) score += 100;

                    score += row; 
                    score += Random.next() * 5;

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { idxA: idx, dirX: m.dirX, dirY: m.dirY, score };
                    }
                }

                // --- COFNIĘCIE ---
                logic.cells[idx].typeId = t1;
                logic.cells[otherIdx].typeId = t2;
            }
        }
        return bestMove;
    }

    private static getMatchSizeAt(logic: BoardLogic, idx: number): number {
        const cell = logic.cells[idx]; 
        const type = cell.typeId; 
        if (type === -1) return 0;
        
        // Tutaj też warto sprawdzić matchowalność (choć AI i tak nie zamieni unswappable)
        const def = BlockRegistry.getById(type);
        if (!def || !def.isMatchable) return 0;

        const col = idx % COLS; 
        const row = Math.floor(idx / COLS);
        
        let countH = 1, i = 1; 
        while (col - i >= 0 && logic.cells[idx - i].typeId === type && logic.cells[idx - i].state === CellState.IDLE) { countH++; i++; }
        i = 1; 
        while (col + i < COLS && logic.cells[idx + i].typeId === type && logic.cells[idx + i].state === CellState.IDLE) { countH++; i++; }
        
        let countV = 1; 
        i = 1; 
        while (row - i >= 0 && logic.cells[idx - i * COLS].typeId === type && logic.cells[idx - i * COLS].state === CellState.IDLE) { countV++; i++; }
        i = 1; 
        while (row + i < ROWS && logic.cells[idx + i * COLS].typeId === type && logic.cells[idx + i * COLS].state === CellState.IDLE) { countV++; i++; }

        return Math.max(countH, countV);
    }
}