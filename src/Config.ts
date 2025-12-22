export const COLS = 7;
export const ROWS = 9;
export const TILE_SIZE = 60;
export const GAP = 4;

// Definicje typów
export type GameMode = 'SOLO' | 'VS_AI';
export type LimitMode = 'NONE' | 'MOVES' | 'TIME';
export type ComboMode = 'TIME' | 'MOVE';
export type GravityDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

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

// Stałe systemowe
export const TURN_TIME_LIMIT = 15.0; 
export const PLAYER_ID_NONE = -1;
export const PLAYER_ID_1 = 0; 
export const PLAYER_ID_2 = 1; 
export const COMBO_BONUS_SECONDS = 1.0; // Upewnij się, że to tu jest!
export const CURRENT_GRAVITY: GravityDir = 'DOWN'; 

// --- PALETA KOLORÓW ---
export const ALL_AVAILABLE_COLORS = [
    0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 
    0xFF00FF, 0x00FFFF, 0xFFA500
];

// --- FALLBACK: IKONY TEKSTOWE ---
export const BLOCK_ICONS = ['♥', '♣', '♦', '$', '♠', '●', '▲'];

// --- SCIEŻKI DO ASSETÓW SVG ---
export const BLOCK_ASSET_PATHS = [
    '/assets/block_0.svg', '/assets/block_1.svg', '/assets/block_2.svg', 
    '/assets/block_3.svg', '/assets/block_4.svg', '/assets/block_5.svg', 
    '/assets/block_6.svg'
];

// --- KONFIGURACJA RUNTIME ---
export const AppConfig = {
    gameMode: 'SOLO' as GameMode,
    limitMode: 'MOVES' as LimitMode,
    limitValue: 20 as number,
    comboMode: 'TIME' as ComboMode,
    seed: 12345 as number,
    blockTypes: 5 as number,
    gravityDir: 'DOWN' as GravityDir
};