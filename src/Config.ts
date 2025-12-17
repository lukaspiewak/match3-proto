export const COLS = 7;
export const ROWS = 9;
export const BLOCK_TYPES = 5;
export const TILE_SIZE = 60; // Mniejszy, żeby zmieścił się na ekranie PC
export const GAP = 4;

export enum CellState {
    IDLE = 0,
    SWAPPING = 1,
    MATCHED = 2,
    EXPLODING = 3,
    FALLING = 4
}

export interface Cell {
    id: number;
    typeId: number; // -1 to puste
    state: CellState;
    // Pozycje wizualne (float)
    x: number;
    y: number;
    // Cel logiczny (int)
    targetX: number;
    targetY: number;
    velocityY: number;
}