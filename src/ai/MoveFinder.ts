import { BoardLogic } from '../BoardLogic';
import { AppConfig, COLS, ROWS, CellState } from '../Config';
import { Random } from '../Random';

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
        // Jeśli plansza się rusza, nie planujemy
        if (!logic.cells.every(c => c.state === CellState.IDLE)) return null;
        
        let bestMove: BestMove | null = null;
        let bestScore = -Infinity;

        // Iterujemy po wszystkich komórkach
        for (let idx = 0; idx < logic.cells.length; idx++) {
            const cell = logic.cells[idx]; 
            if (cell.typeId === -1) continue;
            
            const col = idx % COLS; 
            const row = Math.floor(idx / COLS);

            // Sprawdzamy tylko ruch w Prawo i w Dół (to pokrywa wszystkie pary sąsiadów)
            const moves = [];
            if (col < COLS - 1) moves.push({ target: idx + 1, dirX: 1, dirY: 0 }); 
            if (row < ROWS - 1) moves.push({ target: idx + COLS, dirX: 0, dirY: 1 }); 

            for (const m of moves) {
                const otherIdx = m.target;
                if (logic.cells[otherIdx].typeId === -1) continue;

                // --- SYMULACJA ZAMIANY ---
                // Modyfikujemy typy w logic.cells "na brudno" i natychmiast cofamy
                const t1 = logic.cells[idx].typeId;
                const t2 = logic.cells[otherIdx].typeId;
                
                logic.cells[idx].typeId = t2;
                logic.cells[otherIdx].typeId = t1;

                // Sprawdzamy, co by się stało
                const sizeA = this.getMatchSizeAt(logic, idx);
                const sizeB = this.getMatchSizeAt(logic, otherIdx);
                const maxSize = Math.max(sizeA, sizeB);

                if (maxSize >= 3) {
                    let score = 0;
                    
                    // Zasady punktacji AI
                    if (maxSize === 3) score += 10;
                    else if (maxSize === 4) score += 50;  // Extra Turn
                    else if (maxSize >= 5) score += 100; // Ultra Match / Bomb

                    // Preferuj ruchy na dole planszy (większa szansa na kaskady)
                    score += row; 

                    // Szczypta losowości, żeby bot nie był nudny
                    score += Random.next() * 5;

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { idxA: idx, dirX: m.dirX, dirY: m.dirY, score };
                    }
                }

                // --- COFNIĘCIE SYMULACJI ---
                logic.cells[idx].typeId = t1;
                logic.cells[otherIdx].typeId = t2;
            }
        }
        return bestMove;
    }

    /**
     * Pomocnicza metoda obliczająca wielkość dopasowania w danym punkcie.
     * Przeniesiona z BoardLogic, bo służy głównie do predykcji.
     */
    private static getMatchSizeAt(logic: BoardLogic, idx: number): number {
        const cell = logic.cells[idx]; 
        const type = cell.typeId; 
        if (type === -1) return 0;
        
        const col = idx % COLS; 
        const row = Math.floor(idx / COLS);
        
        // Sprawdzanie w poziomie (Horizontal)
        let countH = 1; 
        let i = 1; 
        while (col - i >= 0 && logic.cells[idx - i].typeId === type && logic.cells[idx - i].state === CellState.IDLE) { countH++; i++; }
        i = 1; 
        while (col + i < COLS && logic.cells[idx + i].typeId === type && logic.cells[idx + i].state === CellState.IDLE) { countH++; i++; }
        
        // Sprawdzanie w pionie (Vertical)
        let countV = 1; 
        i = 1; 
        while (row - i >= 0 && logic.cells[idx - i * COLS].typeId === type && logic.cells[idx - i * COLS].state === CellState.IDLE) { countV++; i++; }
        i = 1; 
        while (row + i < ROWS && logic.cells[idx + i * COLS].typeId === type && logic.cells[idx + i * COLS].state === CellState.IDLE) { countV++; i++; }

        return Math.max(countH, countV);
    }
}