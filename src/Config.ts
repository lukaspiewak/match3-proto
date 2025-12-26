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

// --- NOWOŚĆ: Konfiguracja wizualna i AI ---
export const VisualConfig = {
    EXPLOSION_DURATION: 15.0,  // Czas trwania animacji wybuchu (w klatkach/czasie gry)
    HINT_DELAY_SECONDS: 3.0,   // Ile sekund bezczynności zanim pojawi się podpowiedź
    SHAKE_STRENGTH: 6,         // Siła wstrząsu
    SHAKE_DURATION: 0.3        // Czas wstrząsu
};

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

export const CurrentTheme = {
    background: 0x1a202c, 
    panelBg: 0x2d3748,
    slotBg: 0x171923,
    textMain: 0xf7fafc,
    textMuted: 0xa0aec0,
    accent: 0xecc94b,
    danger: 0xf56565,
    border: 0x4a5568
};