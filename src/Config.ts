export const COLS = 7;
export const ROWS = 9;
export const BLOCK_TYPES = 5;
export const TILE_SIZE = 60;
export const GAP = 4;

// --- KONFIGURACJA RNG (ZIARNO) ---
export const GAME_SEED = 123456; // Zmień to, aby zmienić układ gry

// --- KONFIGURACJA TRYBU COMBO ---
export type ComboMode = 'TIME' | 'MOVE';
export const CURRENT_COMBO_MODE: ComboMode = 'TIME'; 
export const COMBO_BONUS_SECONDS = 1.0; 

// --- KONFIGURACJA ZASAD GRY ---
export type LimitMode = 'NONE' | 'MOVES' | 'TIME';
export const GAME_LIMIT_MODE: LimitMode = 'NONE'; 
export const GAME_LIMIT_VALUE = 20; 

export type GravityDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
export const CURRENT_GRAVITY: GravityDir = 'DOWN'; 

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
    velocity: number; 
    timer: number;
}