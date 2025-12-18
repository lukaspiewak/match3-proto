export const COLS = 7;
export const ROWS = 9;
export const BLOCK_TYPES = 5;
export const TILE_SIZE = 60;
export const GAP = 4;

// Definicja wektora grawitacji
export type GravityDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

// --- TUTAJ ZMIENIASZ KIERUNEK JEDNYM PARAMETREM ---
export const CURRENT_GRAVITY: GravityDir = 'DOWN'; 
// Spróbuj zmienić na 'UP', 'LEFT' lub 'RIGHT'!

export enum CellState {
    IDLE = 0,
    SWAPPING = 1,
    MATCHED = 2,
    EXPLODING = 3,
    FALLING = 4
}

export interface Cell {
    id: number;
    typeId: number;
    state: CellState;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    
    // Zmieniamy velocityY na ogólne velocity (działa w obie strony)
    velocity: number; 
    
    timer: number;
}