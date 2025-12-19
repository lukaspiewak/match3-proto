import {
    COLS, ROWS, BLOCK_TYPES, CellState, type Cell,
    CURRENT_GRAVITY, type GravityDir,
    COMBO_BONUS_SECONDS, CURRENT_COMBO_MODE,
    GAME_LIMIT_MODE, GAME_LIMIT_VALUE
} from './Config';
import { Random } from './Random';

export interface GameStats {
    totalMoves: number;
    invalidMoves: number;
    totalThinkingTime: number;
    highestCascade: number;
    matchCounts: { [size: number]: number };
    colorClears: { [typeId: number]: number };
}

// Stany gry
export type GameState = 'PENDING' | 'PLAYING' | 'FINISHED';
export type FinishReason = 'NONE' | 'LIMIT_REACHED' | 'VICTORY'; // Victory obsłużymy później w UI

export class BoardLogic {
    public cells: Cell[];
    private needsMatchCheck: boolean = false;

    private readonly SWAP_SPEED = 0.20;
    private readonly GRAVITY_ACCEL = 0.008;
    private readonly MAX_SPEED = 0.6;
    private readonly EXPLOSION_TIME = 15.0;

    private dirX: number = 0;
    private dirY: number = 0;

    public onBadMove: (() => void) | null = null;
    public onGameFinished: ((reason: FinishReason) => void) | null = null;

    // Combo
    public currentCombo: number = 0;
    public bestCombo: number = 0;
    public comboTimer: number = 0;

    // Telemetria
    public stats: GameStats;
    private currentCascadeDepth: number = 0;
    private currentThinkingTime: number = 0;

    // --- NOWOŚĆ: ZMIENNE STANU GRY ---
    public gameState: GameState = 'PENDING';
    public finishReason: FinishReason = 'NONE';

    // Liczniki progresu
    public movesUsed: number = 0;       // Ile ruchów wykonano
    public timeElapsed: number = 0;     // Czas gry (od pierwszego ruchu)

    constructor() {
        this.setGravity(CURRENT_GRAVITY);

        this.stats = {
            totalMoves: 0, invalidMoves: 0, totalThinkingTime: 0,
            highestCascade: 0, matchCounts: { 3: 0, 4: 0, 5: 0 },
            colorClears: {}
        };
        for (let i = 0; i < BLOCK_TYPES; i++) this.stats.colorClears[i] = 0;

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
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.comboTimer = 0;
        this.currentCascadeDepth = 0;
        this.currentThinkingTime = 0;

        // Reset stanów gry
        this.gameState = 'PENDING';
        this.finishReason = 'NONE';
        this.movesUsed = 0;
        this.timeElapsed = 0;

        for (let i = 0; i < COLS * ROWS; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);

            let forbiddenH = -1;
            let forbiddenV = -1;

            if (col >= 2) {
                const left1 = this.cells[i - 1].typeId;
                const left2 = this.cells[i - 2].typeId;
                if (left1 === left2) forbiddenH = left1;
            }

            if (row >= 2) {
                const up1 = this.cells[i - COLS].typeId;
                const up2 = this.cells[i - (COLS * 2)].typeId;
                if (up1 === up2) forbiddenV = up1;
            }

            let chosenType;
            do {
                chosenType = Random.nextInt(BLOCK_TYPES);
            } while (chosenType === forbiddenH || chosenType === forbiddenV);

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
    }

    public update(delta: number) {
        // Delta w sekundach
        const dt = delta / 60.0;

        // --- OBSŁUGA CZASU GRY ---
        // Stoper rusza dopiero, gdy gra jest w stanie PLAYING
        if (this.gameState === 'PLAYING') {
            this.timeElapsed += dt;

            // Sprawdzenie limitu CZASU
            if (GAME_LIMIT_MODE === 'TIME') {
                if (this.timeElapsed >= GAME_LIMIT_VALUE) {
                    this.finishGame('LIMIT_REACHED');
                }
            }
        }

        // Combo Logic (tylko w czasie gry)
        if (this.gameState === 'PLAYING' && CURRENT_COMBO_MODE === 'TIME') {
            if (this.currentCombo > 0) {
                this.comboTimer -= dt;
                if (this.comboTimer <= 0) {
                    this.comboTimer = 0;
                    this.currentCombo = 0;
                    console.log("📉 Combo lost (Time out)!");
                }
            }
        }

        // Thinking Time (tylko gdy IDLE)
        if (!this.needsMatchCheck && this.cells.every(c => c.state === CellState.IDLE)) {
            this.currentThinkingTime += dt;
        }

        this.updateTimers(delta);
        this.updateGravityLogic();
        this.updateMovement(delta);

        if (this.needsMatchCheck) {
            this.detectMatches();
            this.needsMatchCheck = false;
        }
    }

    // --- METODA KOŃCZĄCA GRĘ ---
    private finishGame(reason: FinishReason) {
        if (this.gameState === 'FINISHED') return;

        this.gameState = 'FINISHED';
        this.finishReason = reason;
        console.log(`🏁 GAME OVER! Reason: ${reason}`);
        console.log(`📊 Stats: Moves: ${this.movesUsed}, Time: ${this.timeElapsed.toFixed(2)}s`);

        if (this.onGameFinished) this.onGameFinished(reason);
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

    // ... (updateGravityLogic, updateMovement, detectMatches, analyzeMatchStats, checkMatchAt, findHint, simulateSwap, findDeadlockFix - BEZ ZMIAN) ...
    // DLA PRZEJRZYSTOŚCI POMIJAM KOD METOD KTÓRE SIĘ NIE ZMIENIŁY
    // Należy skopiować je z poprzedniej wersji (lub zostawić jeśli edytujesz plik)

    private updateGravityLogic() { /* ... kod bez zmian ... */
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


                cell.typeId = Random.nextInt(BLOCK_TYPES);

                cell.state = CellState.FALLING;
                cell.targetX = finalCol;
                cell.targetY = finalRow;
                cell.velocity = 0;
                cell.x = finalCol - (this.dirX * (i + 2));
                cell.y = finalRow - (this.dirY * (i + 2));
            }
        }
    }

    private updateMovement(delta: number) { /* ... kod bez zmian ... */
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

    public detectMatches() { /* ... kod bez zmian ... */
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
            this.currentCascadeDepth++;
            if (this.currentCascadeDepth > this.stats.highestCascade) this.stats.highestCascade = this.currentCascadeDepth;
            if (this.currentCascadeDepth > 1) console.log(`🌊 Cascade Depth: ${this.currentCascadeDepth}`);

            this.analyzeMatchStats(matchedIndices);

            this.currentCombo++;
            if (this.currentCombo > this.bestCombo) {
                this.bestCombo = this.currentCombo;
                console.log(`🔥 New Best Combo: ${this.bestCombo}`);
            }

            if (CURRENT_COMBO_MODE === 'TIME') {
                this.comboTimer += COMBO_BONUS_SECONDS;
            }

            matchedIndices.forEach(idx => {
                const cell = this.cells[idx];
                cell.state = CellState.EXPLODING;
                cell.timer = this.EXPLOSION_TIME;
            });
        }
    }

    private analyzeMatchStats(matchedIndices: Set<number>) { /* ... kod bez zmian ... */
        const visited = new Set<number>();
        const indices = Array.from(matchedIndices);

        for (const idx of indices) {
            if (visited.has(idx)) continue;

            const typeId = this.cells[idx].typeId;
            let groupSize = 0;
            const stack = [idx];
            visited.add(idx);

            while (stack.length > 0) {
                const current = stack.pop()!;
                groupSize++;

                if (this.stats.colorClears[typeId] !== undefined) {
                    this.stats.colorClears[typeId]++;
                }

                const c = current % COLS;
                const r = Math.floor(current / COLS);
                const neighbors = [
                    { c: c + 1, r: r }, { c: c - 1, r: r },
                    { c: c, r: r + 1 }, { c: c, r: r - 1 }
                ];

                for (const n of neighbors) {
                    if (n.c >= 0 && n.c < COLS && n.r >= 0 && n.r < ROWS) {
                        const nIdx = n.c + n.r * COLS;
                        if (matchedIndices.has(nIdx) && !visited.has(nIdx)) {
                            if (this.cells[nIdx].typeId === typeId) {
                                visited.add(nIdx);
                                stack.push(nIdx);
                            }
                        }
                    }
                }
            }

            if (groupSize >= 5) {
                this.stats.matchCounts[5]++;
                console.log(`✨ ULTRA MATCH (Size: ${groupSize}, Color: ${typeId})`);
            } else if (groupSize === 4) {
                this.stats.matchCounts[4]++;
                console.log(`⭐ MATCH 4 (Color: ${typeId})`);
            } else if (groupSize === 3) {
                this.stats.matchCounts[3]++;
            }
        }
    }

    private checkMatchAt(idx: number): boolean { /* ... kod bez zmian ... */
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
        // BLOKADA: Jeśli gra się skończyła, nie pozwalamy na ruch
        if (this.gameState === 'FINISHED') return;

        const col = idxA % COLS;
        const row = Math.floor(idxA / COLS);
        const targetCol = col + dirX;
        const targetRow = row + dirY;
        if (targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) return;
        const idxB = targetCol + targetRow * COLS;
        const cellA = this.cells[idxA];
        const cellB = this.cells[idxB];
        if (cellA.state !== CellState.IDLE || cellB.state !== CellState.IDLE) return;

        this.stats.totalThinkingTime += this.currentThinkingTime;
        const thinkingTime = this.currentThinkingTime;
        this.currentThinkingTime = 0;
        this.currentCascadeDepth = 0;

        // --- ZMIANA: START GRY ---
        // Jeśli to pierwszy ruch, zmieniamy stan na PLAYING
        if (this.gameState === 'PENDING') {
            this.gameState = 'PLAYING';
            console.log("▶ GAME STARTED");
        }

        if (CURRENT_COMBO_MODE === 'MOVE') {
            this.currentCombo = 0;
            console.log("Combo reset (New Move)");
        }

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
            // POPRAWNY RUCH
            this.stats.totalMoves++;
            this.movesUsed++; // Naliczamy ruch do limitu

            console.log(`✅ Move #${this.movesUsed} | Think: ${thinkingTime.toFixed(2)}s`);

            // --- SPRAWDZENIE LIMITU RUCHÓW ---
            if (GAME_LIMIT_MODE === 'MOVES') {
                // Jeśli osiągnęliśmy limit ruchów, gra się kończy (Przegrana, chyba że cele są spełnione - to sprawdzi ScoreUI)
                if (this.movesUsed >= GAME_LIMIT_VALUE) {
                    this.finishGame('LIMIT_REACHED');
                }
            }

            cellA.state = CellState.SWAPPING;
            cellB.state = CellState.SWAPPING;
        } else {
            this.stats.invalidMoves++;
            console.log(`❌ Invalid Move (${this.stats.invalidMoves} total)`);
            cellB.typeId = cellA.typeId;
            cellA.typeId = tempType;
            if (this.onBadMove) this.onBadMove();
        }
    }

    public findHint(): number[] | null { /* ... kod bez zmian ... */
        if (!this.cells.every(c => c.state === CellState.IDLE)) return null;

        for (let idx = 0; idx < this.cells.length; idx++) {
            const cell = this.cells[idx];
            if (cell.typeId === -1) continue;
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);
            if (col < COLS - 1) {
                const rightIdx = idx + 1;
                const rightCell = this.cells[rightIdx];
                if (rightCell.typeId !== -1) {
                    if (this.simulateSwap(idx, rightIdx)) return [idx, rightIdx];
                }
            }
            if (row < ROWS - 1) {
                const downIdx = idx + COLS;
                const downCell = this.cells[downIdx];
                if (downCell.typeId !== -1) {
                    if (this.simulateSwap(idx, downIdx)) return [idx, downIdx];
                }
            }
        }
        return null;
    }

    private simulateSwap(idxA: number, idxB: number): boolean { /* ... kod bez zmian ... */
        const temp = this.cells[idxA].typeId;
        this.cells[idxA].typeId = this.cells[idxB].typeId;
        this.cells[idxB].typeId = temp;
        const hasMatch = this.checkMatchAt(idxA) || this.checkMatchAt(idxB);
        this.cells[idxB].typeId = this.cells[idxA].typeId;
        this.cells[idxA].typeId = temp;
        return hasMatch;
    }

    public findDeadlockFix(): { id: number, targetType: number } | null { /* ... kod bez zmian ... */
        for (let i = 0; i < this.cells.length; i++) {
            const originalType = this.cells[i].typeId;
            if (originalType === -1) continue;
            for (let type = 0; type < BLOCK_TYPES; type++) {
                if (type === originalType) continue;
                this.cells[i].typeId = type;
                if (this.findHint() !== null) {
                    this.cells[i].typeId = originalType;
                    return { id: i, targetType: type };
                }
            }
            this.cells[i].typeId = originalType;
        }
        return null;
    }
}