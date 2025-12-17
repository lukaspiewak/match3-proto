import { COLS, ROWS, BLOCK_TYPES, CellState, type Cell } from './Config';

export class BoardLogic {
    public cells: Cell[];
    private needsMatchCheck: boolean = false;
    
    // --- KONFIGURACJA ---
    private readonly SWAP_SPEED = 0.20;     
    private readonly GRAVITY = 0.008;       
    private readonly MAX_FALL_SPEED = 0.6;  
    private readonly EXPLOSION_TIME = 15.0; 

    constructor() {
        this.cells = [];
        this.initBoard();
    }

    private initBoard() {
        this.cells = [];

        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);

            // Algorytm "No Match on Start"
            let forbiddenHorizontal = -1;
            let forbiddenVertical = -1;

            if (col >= 2) {
                const left1 = this.cells[i - 1].typeId;
                const left2 = this.cells[i - 2].typeId;
                if (left1 === left2) forbiddenHorizontal = left1;
            }

            if (row >= 2) {
                const up1 = this.cells[i - COLS].typeId;
                const up2 = this.cells[i - (COLS * 2)].typeId;
                if (up1 === up2) forbiddenVertical = up1;
            }

            let chosenType;
            do {
                chosenType = Math.floor(Math.random() * BLOCK_TYPES);
            } while (chosenType === forbiddenHorizontal || chosenType === forbiddenVertical);

            this.cells.push({
                id: i,
                typeId: chosenType,
                state: CellState.IDLE,
                x: col,
                y: row - ROWS, 
                targetX: col,
                targetY: row,
                velocityY: 0,
                timer: 0
            });
        }
    }

    public update(delta: number) {
        this.updateTimers(delta);
        this.updateGravityLogic();
        this.updateMovement(delta);

        if (this.needsMatchCheck) {
            this.detectMatches();
            this.needsMatchCheck = false; 
        }
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

    private updateGravityLogic() {
        for (let col = 0; col < COLS; col++) {
            let emptySlots = 0;
            for (let row = ROWS - 1; row >= 0; row--) {
                const idx = col + row * COLS;
                const cell = this.cells[idx];

                if (cell.typeId === -1) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const targetRow = row + emptySlots;
                    const targetIdx = col + targetRow * COLS;
                    
                    const targetCell = this.cells[targetIdx];
                    targetCell.typeId = cell.typeId;
                    targetCell.state = CellState.FALLING;
                    
                    targetCell.y = cell.y; 
                    targetCell.x = cell.x;
                    targetCell.velocityY = cell.velocityY;
                    
                    targetCell.targetY = targetRow;
                    targetCell.targetX = col;

                    cell.typeId = -1;
                    cell.state = CellState.IDLE;
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const idx = col + targetRow * COLS;
                const cell = this.cells[idx];
                
                cell.typeId = Math.floor(Math.random() * BLOCK_TYPES);
                cell.state = CellState.FALLING;
                cell.targetY = targetRow;
                cell.targetX = col;
                
                cell.x = col;
                cell.y = -1 - i; 
                cell.velocityY = 0;
            }
        }
    }

    private updateMovement(delta: number) {
        for (const cell of this.cells) {
            if (cell.typeId === -1) continue;

            // --- GRAWITACJA ---
            if (cell.state === CellState.FALLING) {
                cell.velocityY += this.GRAVITY * delta;
                if (cell.velocityY > this.MAX_FALL_SPEED) cell.velocityY = this.MAX_FALL_SPEED;
                
                cell.y += cell.velocityY * delta;

                if (cell.y >= cell.targetY) {
                    cell.y = cell.targetY; // Snap przy lądowaniu
                    cell.velocityY = 0;
                    cell.state = CellState.IDLE;
                    this.needsMatchCheck = true; 
                }
            }

            // --- ZAMIANA ---
            else if (cell.state === CellState.SWAPPING) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;

                cell.x += diffX * this.SWAP_SPEED * delta;
                cell.y += diffY * this.SWAP_SPEED * delta;

                if (Math.abs(diffX) < 0.05 && Math.abs(diffY) < 0.05) {
                    cell.x = cell.targetX; // Snap przy końcu swapa
                    cell.y = cell.targetY;
                    cell.state = CellState.IDLE;
                    this.needsMatchCheck = true;
                }
            }
            
            // --- KOREKTA POZYCJI (Fix dla "krzywych" klocków) ---
            else if (cell.state === CellState.IDLE) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;
                
                // Sprawdzamy, czy klocek jest przesunięty
                if (Math.abs(diffX) > 0.001 || Math.abs(diffY) > 0.001) {
                    // Jeśli jest daleko, przesuwamy go płynnie
                    if (Math.abs(diffX) > 0.01 || Math.abs(diffY) > 0.01) {
                        cell.x += diffX * this.SWAP_SPEED * delta;
                        cell.y += diffY * this.SWAP_SPEED * delta;
                    } else {
                        // Jeśli jest bardzo blisko (poniżej progu), DOCIĄGAMY GO NA SIŁĘ (Snap)
                        // To jest ta linijka, której brakowało!
                        cell.x = cell.targetX;
                        cell.y = cell.targetY;
                    }
                }
            }
        }
    }

    public detectMatches() {
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
                       this.cells[c + matchLen + r * COLS].state === CellState.IDLE) matchLen++;

                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) matchedIndices.add((c + k) + r * COLS);
                    c += matchLen - 1;
                }
            }
        }

        // Pionowo
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                if (type === -1 || this.cells[idx].state !== CellState.IDLE) continue;

                let matchLen = 1;
                while (r + matchLen < ROWS && 
                       this.cells[c + (r + matchLen) * COLS].typeId === type &&
                       this.cells[c + (r + matchLen) * COLS].state === CellState.IDLE) matchLen++;

                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) matchedIndices.add(c + (r + k) * COLS);
                    r += matchLen - 1;
                }
            }
        }

        if (matchedIndices.size > 0) {
            matchedIndices.forEach(idx => {
                const cell = this.cells[idx];
                cell.state = CellState.EXPLODING;
                cell.timer = this.EXPLOSION_TIME;
            });
        }
    }

    private checkMatchAt(idx: number): boolean {
        const cell = this.cells[idx];
        const type = cell.typeId;
        if (type === -1) return false;

        const col = idx % COLS;
        const row = Math.floor(idx / COLS);

        let countH = 1;
        let i = 1;
        while (col - i >= 0 && this.cells[idx - i].typeId === type && this.cells[idx - i].state === CellState.IDLE) { countH++; i++; }
        i = 1;
        while (col + i < COLS && this.cells[idx + i].typeId === type && this.cells[idx + i].state === CellState.IDLE) { countH++; i++; }
        
        if (countH >= 3) return true;

        let countV = 1;
        i = 1;
        while (row - i >= 0 && this.cells[idx - i * COLS].typeId === type && this.cells[idx - i * COLS].state === CellState.IDLE) { countV++; i++; }
        i = 1;
        while (row + i < ROWS && this.cells[idx + i * COLS].typeId === type && this.cells[idx + i * COLS].state === CellState.IDLE) { countV++; i++; }

        if (countV >= 3) return true;

        return false;
    }

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

        const tempType = cellA.typeId;
        cellA.typeId = cellB.typeId;
        cellB.typeId = tempType;

        const matchA = this.checkMatchAt(idxA);
        const matchB = this.checkMatchAt(idxB);

        const tempX = cellA.x;
        const tempY = cellA.y;
        cellA.x = cellB.x;
        cellA.y = cellB.y;
        cellB.x = tempX;
        cellB.y = tempY;

        if (matchA || matchB) {
            cellA.state = CellState.SWAPPING;
            cellB.state = CellState.SWAPPING;
        } else {
            cellB.typeId = cellA.typeId;
            cellA.typeId = tempType;
            // Tutaj updateMovement w następnej klatce wykryje przesunięcie 
            // i dzięki poprawce "else { snap }" wyrówna je idealnie.
        }
    }
}