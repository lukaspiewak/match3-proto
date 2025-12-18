import { COLS, ROWS, BLOCK_TYPES, CellState, type Cell, CURRENT_GRAVITY, type GravityDir } from './Config';

export class BoardLogic {
    public cells: Cell[];
    private needsMatchCheck: boolean = false;

    private readonly SWAP_SPEED = 0.20;
    private readonly GRAVITY_ACCEL = 0.008;
    private readonly MAX_SPEED = 0.6;
    private readonly EXPLOSION_TIME = 15.0;

    // Wektory grawitacji
    private dirX: number = 0;
    private dirY: number = 0;


    public onBadMove: (() => void) | null = null;

    constructor() {
        this.setGravity(CURRENT_GRAVITY);
        this.cells = [];
        this.initBoard();
    }

    public setGravity(direction: GravityDir) {
        switch (direction) {
            case 'DOWN': this.dirX = 0; this.dirY = 1; break;
            case 'UP': this.dirX = 0; this.dirY = -1; break;
            case 'RIGHT': this.dirX = 1; this.dirY = 0; break;
            case 'LEFT': this.dirX = -1; this.dirY = 0; break;
        }
    }

    private initBoard() {
        this.cells = [];
        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);

            // --- ALGORYTM "NO MATCH ON START" (Przywrócony) ---
            let forbiddenH = -1;
            let forbiddenV = -1;

            // 1. Sprawdź lewą stronę (dla wierszy)
            if (col >= 2) {
                const left1 = this.cells[i - 1].typeId;
                const left2 = this.cells[i - 2].typeId;
                if (left1 === left2) {
                    forbiddenH = left1;
                }
            }

            // 2. Sprawdź górę (dla kolumn)
            if (row >= 2) {
                const up1 = this.cells[i - COLS].typeId;
                const up2 = this.cells[i - (COLS * 2)].typeId;
                if (up1 === up2) {
                    forbiddenV = up1;
                }
            }

            // 3. Losuj tak długo, aż trafisz na kolor, który nie jest zakazany
            let chosenType;
            do {
                chosenType = Math.floor(Math.random() * BLOCK_TYPES);
            } while (chosenType === forbiddenH || chosenType === forbiddenV);

            // --- POZYCJA STARTOWA (Zgodna z grawitacją) ---
            // Obliczamy pozycję "poza ekranem", z której klocki nadlecą
            const startX = col - (this.dirX * COLS);
            const startY = row - (this.dirY * ROWS);

            this.cells.push({
                id: i,
                typeId: chosenType,
                state: CellState.IDLE,
                x: startX,
                y: startY,
                targetX: col,
                targetY: row,
                velocity: 0,
                timer: 0
            });
        }

        // Nie wywołujemy detectMatches(), bo mamy gwarancję czystej planszy!
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
        const isVertical = (this.dirY !== 0);
        const primarySize = isVertical ? COLS : ROWS;
        const secondarySize = isVertical ? ROWS : COLS;

        for (let p = 0; p < primarySize; p++) {
            let emptySlots = 0;

            let start = (this.dirX > 0 || this.dirY > 0) ? secondarySize - 1 : 0;
            let end = (this.dirX > 0 || this.dirY > 0) ? -1 : secondarySize;
            let step = (this.dirX > 0 || this.dirY > 0) ? -1 : 1;

            for (let s = start; s !== end; s += step) {
                const col = isVertical ? p : s;
                const row = isVertical ? s : p;

                const idx = col + row * COLS;
                const cell = this.cells[idx];

                if (cell.typeId === -1) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const targetCol = col + (this.dirX * emptySlots);
                    const targetRow = row + (this.dirY * emptySlots);
                    const targetIdx = targetCol + targetRow * COLS;

                    const targetCell = this.cells[targetIdx];
                    targetCell.typeId = cell.typeId;
                    targetCell.state = CellState.FALLING;
                    targetCell.x = cell.x;
                    targetCell.y = cell.y;
                    targetCell.velocity = cell.velocity;
                    targetCell.targetX = targetCol;
                    targetCell.targetY = targetRow;

                    cell.typeId = -1;
                    cell.state = CellState.IDLE;
                }
            }

            // SPAWNER
            for (let i = 0; i < emptySlots; i++) {
                let logicalS;
                if (this.dirX > 0 || this.dirY > 0) {
                    logicalS = emptySlots - 1 - i;
                } else {
                    logicalS = (secondarySize - emptySlots) + i;
                }

                const finalCol = isVertical ? p : logicalS;
                const finalRow = isVertical ? logicalS : p;

                const idx = finalCol + finalRow * COLS;
                const cell = this.cells[idx];

                cell.typeId = Math.floor(Math.random() * BLOCK_TYPES);
                cell.state = CellState.FALLING;
                cell.targetX = finalCol;
                cell.targetY = finalRow;
                cell.velocity = 0;

                // Spawn Point "za bandą"
                cell.x = finalCol - (this.dirX * (i + 2));
                cell.y = finalRow - (this.dirY * (i + 2));
            }
        }
    }

    private updateMovement(delta: number) {
        for (const cell of this.cells) {
            if (cell.typeId === -1) continue;

            if (cell.state === CellState.FALLING) {
                cell.velocity += this.GRAVITY_ACCEL * delta;
                if (cell.velocity > this.MAX_SPEED) cell.velocity = this.MAX_SPEED;

                cell.x += this.dirX * cell.velocity * delta;
                cell.y += this.dirY * cell.velocity * delta;

                let landed = false;
                if (this.dirX === 1 && cell.x >= cell.targetX) landed = true;
                else if (this.dirX === -1 && cell.x <= cell.targetX) landed = true;
                else if (this.dirY === 1 && cell.y >= cell.targetY) landed = true;
                else if (this.dirY === -1 && cell.y <= cell.targetY) landed = true;

                if (landed) {
                    cell.x = cell.targetX;
                    cell.y = cell.targetY;
                    cell.velocity = 0;
                    cell.state = CellState.IDLE;
                    this.needsMatchCheck = true;
                }
            }
            else if (cell.state === CellState.SWAPPING) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;
                cell.x += diffX * this.SWAP_SPEED * delta;
                cell.y += diffY * this.SWAP_SPEED * delta;

                if (Math.abs(diffX) < 0.05 && Math.abs(diffY) < 0.05) {
                    cell.x = cell.targetX;
                    cell.y = cell.targetY;
                    cell.state = CellState.IDLE;
                    this.needsMatchCheck = true;
                }
            }
            else if (cell.state === CellState.IDLE) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;
                if (Math.abs(diffX) > 0.001 || Math.abs(diffY) > 0.001) {
                    if (Math.abs(diffX) > 0.01 || Math.abs(diffY) > 0.01) {
                        cell.x += diffX * this.SWAP_SPEED * delta;
                        cell.y += diffY * this.SWAP_SPEED * delta;
                    } else {
                        cell.x = cell.targetX;
                        cell.y = cell.targetY;
                    }
                }
            }
        }
    }

    public detectMatches() {
        const matchedIndices = new Set<number>();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                if (type === -1 || this.cells[idx].state !== CellState.IDLE) continue;
                let matchLen = 1;
                while (c + matchLen < COLS && this.cells[c + matchLen + r * COLS].typeId === type && this.cells[c + matchLen + r * COLS].state === CellState.IDLE) matchLen++;
                if (matchLen >= 3) {
                    for (let k = 0; k < matchLen; k++) matchedIndices.add((c + k) + r * COLS);
                    c += matchLen - 1;
                }
            }
        }
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS - 2; r++) {
                const idx = c + r * COLS;
                const type = this.cells[idx].typeId;
                if (type === -1 || this.cells[idx].state !== CellState.IDLE) continue;
                let matchLen = 1;
                while (r + matchLen < ROWS && this.cells[c + (r + matchLen) * COLS].typeId === type && this.cells[c + (r + matchLen) * COLS].state === CellState.IDLE) matchLen++;
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
        let countH = 1, i = 1;
        while (col - i >= 0 && this.cells[idx - i].typeId === type && this.cells[idx - i].state === CellState.IDLE) { countH++; i++; }
        i = 1;
        while (col + i < COLS && this.cells[idx + i].typeId === type && this.cells[idx + i].state === CellState.IDLE) { countH++; i++; }
        if (countH >= 3) return true;
        let countV = 1; i = 1;
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
            // ZŁY RUCH
            cellB.typeId = cellA.typeId;
            cellA.typeId = tempType;

            // 2. DODAJ WYWOŁANIE CALLBACKA:
            if (this.onBadMove) this.onBadMove();
        }
    }
}