import { CellState, VOID, type Cell, type GravityDir, type GameConfig } from '../Config';
import { BlockRegistry } from '../BlockDef';

export class GridPhysics {
    private cells: Cell[];
    private config: GameConfig;

    // Parametry fizyki
    private readonly SWAP_SPEED = 0.20;
    private readonly GRAVITY_ACCEL = 0.008;
    private readonly MAX_SPEED = 0.6;

    public dirX: number = 0;
    public dirY: number = 0;

    // NOWOŚĆ: Lista dozwolonych bloków do spawnowania
    public allowedBlockIds: number[] = [];

    // Indeksy komórek-wlotów (spawnerów). Pusty zbiór = domyślnie wlot na każdej
    // krawędzi (klasyczne zachowanie: cała górna krawędź generuje bloki).
    private spawners: Set<number> = new Set();

    public setSpawners(indices: number[]) {
        this.spawners = new Set(indices);
    }

    public onDropDown: ((id: number) => void) | null = null;
    public onNeedsMatchCheck: (() => void) | null = null;

    constructor(cells: Cell[], config: GameConfig) {
        this.cells = cells;
        this.config = config;
        this.setGravity(config.gravityDir);

        // Domyślna lista (jeśli nikt nie ustawi innej)
        for(let i=0; i<config.blockTypes; i++) this.allowedBlockIds.push(i);
    }

    public setGravity(direction: GravityDir) {
        switch (direction) {
            case 'DOWN': this.dirX = 0; this.dirY = 1; break;
            case 'UP': this.dirX = 0; this.dirY = -1; break;
            case 'RIGHT': this.dirX = 1; this.dirY = 0; break;
            case 'LEFT': this.dirX = -1; this.dirY = 0; break;
        }
    }

    public update(delta: number) {
        this.updateGravityLogic();
        this.updateMovement(delta);
    }

    private updateGravityLogic() {
        const cols = this.config.cols;
        const rows = this.config.rows;
        const isVertical = (this.dirY !== 0);
        const primarySize = isVertical ? cols : rows;
        const secondarySize = isVertical ? rows : cols;

        for (let p = 0; p < primarySize; p++) {
            let emptySlots = 0;
            let start = (this.dirX > 0 || this.dirY > 0) ? secondarySize - 1 : 0;
            let end = (this.dirX > 0 || this.dirY > 0) ? -1 : secondarySize;
            let step = (this.dirX > 0 || this.dirY > 0) ? -1 : 1;
            
            // 1. Przesuwanie
            for (let s = start; s !== end; s += step) {
                const col = isVertical ? p : s;
                const row = isVertical ? s : p;
                const idx = col + row * cols;
                const cell = this.cells[idx];

                // Void = trwała przeszkoda: bloki na niej stają, nie przechodzą przez nią.
                if (cell.typeId === VOID) { emptySlots = 0; continue; }

                const def = (cell.typeId !== -1) ? BlockRegistry.getById(cell.typeId) : null;

                if (cell.typeId === -1) {
                    emptySlots++;
                }
                else if (def && !def.hasGravity) {
                    emptySlots = 0;
                }
                else if (emptySlots > 0) {
                    const targetCol = col + (this.dirX * emptySlots);
                    const targetRow = row + (this.dirY * emptySlots);
                    const targetIdx = targetCol + targetRow * cols;
                    const targetCell = this.cells[targetIdx];
                    
                    targetCell.typeId = cell.typeId; 
                    targetCell.state = CellState.FALLING;
                    targetCell.x = cell.x; 
                    targetCell.y = cell.y;
                    targetCell.velocity = cell.velocity;
                    targetCell.targetX = targetCol; 
                    targetCell.targetY = targetRow;
                    targetCell.hp = cell.hp;
                    targetCell.maxHp = cell.maxHp;
                    
                    cell.typeId = -1; 
                    cell.state = CellState.IDLE;
                }
            }
            
            // 2. Generowanie nowych bloków ("Spawn Train")
            // Wlot dla tej linii to komórka na krawędzi po stronie przeciwnej do grawitacji.
            const entryCol = isVertical ? p : (this.dirX > 0 ? 0 : cols - 1);
            const entryRow = isVertical ? (this.dirY > 0 ? 0 : rows - 1) : p;
            const entryIdx = entryCol + entryRow * cols;
            const canSpawn = this.spawners.size === 0 || this.spawners.has(entryIdx);

            for (let i = 0; canSpawn && i < emptySlots; i++) {
                let logicalS;
                if (this.dirX > 0 || this.dirY > 0) { logicalS = emptySlots - 1 - i; } 
                else { logicalS = (secondarySize - emptySlots) + i; }
                
                const finalCol = isVertical ? p : logicalS;
                const finalRow = isVertical ? logicalS : p;
                const idx = finalCol + finalRow * cols;
                const cell = this.cells[idx];
                
                // ZMIANA: Używamy listy dozwolonych bloków
                const newTypeId = BlockRegistry.getRandomBlockIdFromList(this.allowedBlockIds);
                const blockDef = BlockRegistry.getById(newTypeId);

                cell.typeId = newTypeId;
                cell.state = CellState.FALLING;
                cell.targetX = finalCol;
                cell.targetY = finalRow;
                cell.velocity = 0;
                
                cell.hp = blockDef.initialHp;
                cell.maxHp = blockDef.initialHp;

                let spawnX = finalCol;
                let spawnY = finalRow;

                if (this.dirY === 1) spawnY = -(i + 1);
                else if (this.dirY === -1) spawnY = rows + (emptySlots - i);
                else if (this.dirX === 1) spawnX = -(i + 1);
                else if (this.dirX === -1) spawnX = cols + (emptySlots - i);

                cell.x = spawnX;
                cell.y = spawnY;
            }
        }
    }

    private updateMovement(delta: number) {
        const rows = this.config.rows;
        for (const cell of this.cells) {
            if (cell.typeId < 0) continue; // pomija puste (-1) i void (-2)
            
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
                    
                    if (this.onNeedsMatchCheck) this.onNeedsMatchCheck();

                    if (this.onDropDown && cell.y === rows - 1 && this.dirY === 1) {
                        this.onDropDown(cell.id);
                    }
                }
            } 
            else if (cell.state === CellState.SWAPPING) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;
                const moveAmount = this.SWAP_SPEED * delta;
                
                if (Math.abs(diffX) <= moveAmount) cell.x = cell.targetX;
                else cell.x += Math.sign(diffX) * moveAmount;

                if (Math.abs(diffY) <= moveAmount) cell.y = cell.targetY;
                else cell.y += Math.sign(diffY) * moveAmount;

                if (cell.x === cell.targetX && cell.y === cell.targetY) {
                    cell.state = CellState.IDLE; 
                    if (this.onNeedsMatchCheck) this.onNeedsMatchCheck();
                }
            } 
            else if (cell.state === CellState.IDLE) {
                const diffX = cell.targetX - cell.x;
                const diffY = cell.targetY - cell.y;
                if (Math.abs(diffX) > 0.001 || Math.abs(diffY) > 0.001) {
                    cell.x += diffX * this.SWAP_SPEED * delta;
                    cell.y += diffY * this.SWAP_SPEED * delta;
                    if (Math.abs(diffX) < 0.01 && Math.abs(diffY) < 0.01) {
                        cell.x = cell.targetX; 
                        cell.y = cell.targetY;
                    }
                }
            }
        }
    }
}