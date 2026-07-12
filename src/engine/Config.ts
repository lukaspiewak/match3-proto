export type GameMode = 'SOLO' | 'VS_AI';
export type LimitMode = 'NONE' | 'MOVES' | 'TIME';
export type ComboMode = 'TIME' | 'MOVE';
export type GravityDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

/**
 * GameConfig — per-instancja konfiguracja silnika.
 * Każda BoardLogic dostaje własny obiekt, dzięki czemu można tworzyć
 * różne warianty gry (inne rozmiary planszy, grawitacja, tryby) obok siebie.
 */
export interface GameConfig {
    cols: number;
    rows: number;
    blockTypes: number;
    gravityDir: GravityDir;
    gameMode: GameMode;
    comboMode: ComboMode;
    limitMode: LimitMode;
    limitValue: number;
    seed: number;
    /** Ile kolejnych bloków pokazywać w podglądzie nad kolumną (0/brak = wyłączony). */
    previewCount?: number;
    /** Forma podglądu: 'bars' = grube paski na szerokość kolumny, 'dots' = rząd małych kwadratów. */
    previewStyle?: 'bars' | 'dots';
}

// Rozmiar renderu pojedynczego kafla (piksele) — wspólny dla całego UI.
export const TILE_SIZE = 60;
export const GAP = 4;

/**
 * Sentinele typeId komórki:
 *  EMPTY = -1  — chwilowo pusta (podczas kaskady/opadania; zostanie wypełniona).
 *  VOID  = -2  — TRWALE niegrywalna (dziura/kształt planszy): nigdy nie trzyma bloku,
 *                blokuje grawitację (bloki na niej stają), nie jest matchowalna ani renderowana.
 */
export const EMPTY = -1;
export const VOID = -2;

export enum CellState {
    IDLE = 0,
    SWAPPING = 1,
    MATCHED = 2,
    EXPLODING = 3,
    FALLING = 4
}

/**
 * Cell — komórka planszy w czasie działania gry.
 *
 * Pola dzielą się na dwie grupy:
 *  • LOGICZNE  (typeId, hp, maxHp, state) — prawda gry, serializowane jako BoardState.
 *  • WIZUALNE  (x, y, targetX, targetY, velocity, timer) — stan animacji; zapisuje
 *    je i czyta wyłącznie warstwa fizyki/renderu, ignorowane w symulacji headless.
 */
export interface Cell {
    id: number;

    // --- LOGICZNE ---
    typeId: number;
    state: CellState;
    hp: number;
    maxHp: number;

    // --- WIZUALNE (animacja) ---
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    velocity: number;
    timer: number;
}

export const TURN_TIME_LIMIT = 15.0; 
export const PLAYER_ID_NONE = -1;
export const PLAYER_ID_1 = 0; 
export const PLAYER_ID_2 = 1; 
export const COMBO_BONUS_SECONDS = 1.0; 
export const CURRENT_GRAVITY: GravityDir = 'DOWN'; 

export const VisualConfig = {
    EXPLOSION_DURATION: 15.0,
    HINT_DELAY_SECONDS: 3.0,
    SHAKE_STRENGTH: 6,
    SHAKE_DURATION: 0.3
};

/**
 * AppConfig — domyślna, globalna instancja GameConfig.
 * Menu edytuje ten obiekt (ustawienia sesji); nowa gra kopiuje go do
 * własnego GameConfig przekazywanego do BoardLogic.
 */
export const AppConfig: GameConfig = {
    cols: 7,
    rows: 9,
    gameMode: 'SOLO',
    limitMode: 'MOVES',
    limitValue: 20,
    comboMode: 'TIME',
    seed: 12345,
    blockTypes: 5,
    gravityDir: 'DOWN',
    previewCount: 3,
    previewStyle: 'bars'
};

// Domyślne wymiary planszy dla layoutu scen (nie dla logiki silnika).
export const COLS = AppConfig.cols;
export const ROWS = AppConfig.rows;

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