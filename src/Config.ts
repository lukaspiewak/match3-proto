export const COLS = 7;
export const ROWS = 9;
export const BLOCK_TYPES = 5;
export const TILE_SIZE = 60;
export const GAP = 4;
export const GAME_SEED = 12345; 

// --- KONFIGURACJA TRYBÓW GRY ---
export type GameMode = 'SOLO' | 'VS_AI'; // W przyszłości dodasz 'ONLINE'
export const CURRENT_GAME_MODE: GameMode = 'VS_AI'; // Zmień na 'SOLO' by grać samemu

export const TURN_TIME_LIMIT = 15.0; // Sekundy na ruch w trybie VS

// Identyfikatory graczy
export const PLAYER_ID_NONE = -1;
export const PLAYER_ID_1 = 0; // Zazwyczaj Człowiek (Lokalny)
export const PLAYER_ID_2 = 1; // Bot lub Przeciwnik Sieciowy

// --- ISTNIEJĄCE KONFIGURACJE ---
export type ComboMode = 'TIME' | 'MOVE';
export const CURRENT_COMBO_MODE: ComboMode = 'TIME'; 
export const COMBO_BONUS_SECONDS = 1.0; 

export type LimitMode = 'NONE' | 'MOVES' | 'TIME';
export const GAME_LIMIT_MODE: LimitMode = 'MOVES'; 
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