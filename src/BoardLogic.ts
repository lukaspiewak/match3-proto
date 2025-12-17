import { COLS, ROWS, BLOCK_TYPES, type Cell, CellState } from './Config';

export class BoardLogic {
    public cells: Cell[];
    private needsMatchCheck: boolean = false;

    constructor() {
        this.cells = [];
        this.initBoard();
    }

    private initBoard() {
        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            this.cells.push({
                id: i,
                typeId: Math.floor(Math.random() * BLOCK_TYPES),
                state: CellState.IDLE,
                x: col,
                y: row - ROWS, // Startują nad ekranem dla efektu wejścia
                targetX: col,
                targetY: row,
                velocityY: 0
            });
        }
    }

    public update(delta: number) {
        // 1. Logika Grawitacji (Szukanie dziur)
        this.updateGravityLogic();

        // 2. Fizyka (Ruch wizualny)
        this.updatePhysics(delta);

        // 3. Wykrywanie dopasowań (tylko jeśli coś się zmieniło/wylądowało)
        if (this.needsMatchCheck) {
            this.detectMatches();
            this.needsMatchCheck = false;
        }
    }

    private updateGravityLogic() {
        for (let col = 0; col < COLS; col++) {
            let emptySlots = 0;
            // Skan od dołu
            for (let row = ROWS - 1; row >= 0; row--) {
                const idx = col + row * COLS;
                const cell = this.cells[idx];

                if (cell.typeId === -1) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    // Przesuń klocek w dół logicznie
                    const targetRow = row + emptySlots;
                    const targetIdx = col + targetRow * COLS;
                    
                    // Kopiowanie danych do nowego slotu
                    const targetCell = this.cells[targetIdx];
                    targetCell.typeId = cell.typeId;
                    targetCell.state = CellState.FALLING;
                    targetCell.y = cell.y; // Zachowaj wizualną pozycję startową
                    targetCell.velocityY = cell.velocityY;
                    targetCell.targetY = targetRow;

                    // Czyszczenie starego slotu
                    cell.typeId = -1;
                    cell.state = CellState.IDLE;
                }
            }

            // Spawner nowych klocków
            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const idx = col + targetRow * COLS;
                const cell = this.cells[idx];
                
                cell.typeId = Math.floor(Math.random() * BLOCK_TYPES);
                cell.state = CellState.FALLING;
                cell.targetY = targetRow;
                cell.y = -1 - i; // Nad ekranem
                cell.velocityY = 0;
            }
        }
    }

    private updatePhysics(delta: number) {
        const GRAVITY = 0.005; // Przyspieszenie (w jednostkach siatki)
        const MAX_SPEED = 0.5;

        for (const cell of this.cells) {
            if (cell.state === CellState.FALLING || cell.y < cell.targetY) {
                cell.velocityY += GRAVITY * delta;
                if (cell.velocityY > MAX_SPEED) cell.velocityY = MAX_SPEED;
                
                cell.y += cell.velocityY * delta;

                // Lądowanie
                if (cell.y >= cell.targetY) {
                    cell.y = cell.targetY;
                    cell.velocityY = 0;
                    cell.state = CellState.IDLE;
                    this.needsMatchCheck = true; // Sprawdź matche po wylądowaniu
                }
            }
        }
    }

    public detectMatches() {
        // Uproszczona wersja 1D - szukanie tylko wierszami i kolumnami
        const matchedIndices = new Set<number>();

        // Poziomo
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                if (type === -1 || this.cells[idx].state !== CellState.IDLE) continue;

                let matchLen = 1;
                while (c + matchLen < COLS && 
                       this.cells[c + matchLen + r * COLS].typeId === type &&
                       this.cells[c + matchLen + r * COLS].state === CellState.IDLE) {
                    matchLen++;
                }

                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) matchedIndices.add((c + k) + r * COLS);
                    c += matchLen - 1;
                }
            }
        }

        // Pionowo (analogicznie)
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                if (type === -1 || this.cells[idx].state !== CellState.IDLE) continue;

                let matchLen = 1;
                while (r + matchLen < ROWS && 
                       this.cells[c + (r + matchLen) * COLS].typeId === type &&
                       this.cells[c + (r + matchLen) * COLS].state === CellState.IDLE) {
                    matchLen++;
                }

                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) matchedIndices.add(c + (r + k) * COLS);
                    r += matchLen - 1;
                }
            }
        }

        if (matchedIndices.size > 0) {
            matchedIndices.forEach(idx => {
                this.cells[idx].typeId = -1; // Natychmiastowe usunięcie logiczne
                this.cells[idx].state = CellState.IDLE; // Gotowe na spadanie nowych
            });
        }
    }

    // Input API
    public trySwap(idxA: number, dirX: number, dirY: number) {
        const col = idxA % COLS;
        const row = Math.floor(idxA / COLS);
        const targetCol = col + dirX;
        const targetRow = row + dirY;

        if (targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) return;

        const idxB = targetCol + targetRow * COLS;
        const cellA = this.cells[idxA];
        const cellB = this.cells[idxB];

        if (cellA.state !== CellState.IDLE || cellB.state !== CellState.IDLE) return;

        // Natychmiastowa zamiana logiczna (dla responsywności)
        const tempType = cellA.typeId;
        cellA.typeId = cellB.typeId;
        cellB.typeId = tempType;
        
        // Wymuszenie sprawdzenia matchy w następnej klatce
        this.needsMatchCheck = true;
    }
}