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
export const COMBO_BONUS_SECONDS = 1.0; 
export const CURRENT_GRAVITY: GravityDir = 'DOWN'; 

// --- PALETA KOLORÓW (Max 7) ---
export const ALL_AVAILABLE_COLORS = [
    0xFF0000, // Red
    0x00FF00, // Green
    0x0000FF, // Blue
    0xFFFF00, // Yellow
    0xFF00FF, // Purple
    0x00FFFF, // Cyan
    0xFFA500  // Orange
];

// --- FALLBACK: IKONY TEKSTOWE ---
export const BLOCK_ICONS = [
    '♥', // Red
    '♣', // Green
    '♦', // Blue
    '$', // Yellow
    '♠', // Purple
    '●', // Cyan
    '▲'  // Orange
];

// --- SCIEŻKI DO ASSETÓW SVG (Opcjonalne) ---
// Jeśli plik pod tą ścieżką zostanie załadowany, użyjemy go zamiast ikony tekstowej.
// Pliki powinny znajdować się w folderze /public/assets/
export const BLOCK_ASSET_PATHS = [
    '/assets/block_0.svg', // Red
    '/assets/block_1.svg', // Green
    '/assets/block_2.svg', // Blue
    '/assets/block_3.svg', // Yellow
    '/assets/block_4.svg', // Purple
    '/assets/block_5.svg', // Cyan
    '/assets/block_6.svg', // Orange
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