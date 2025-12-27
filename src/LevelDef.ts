import { COLS, ROWS } from './Config';

export const R_ = -1;  // Random
export const S_ = 200; // Stone
export const I_ = 300; // Ice

// Typy Celów
export type GoalType = 'SCORE' | 'COLLECT';

// NOWOŚĆ: Tryb poziomu (dodano GATHERING)
export type LevelMode = 'STANDARD' | 'CONSTRUCTION' | 'GATHERING';

export interface LevelGoal {
    type: GoalType;
    targetId?: number;
    amount: number;
}

export interface LevelConfig {
    id: string;
    name: string;
    mode: LevelMode; 
    layout: number[][];
    moveLimit: number; // Jeśli -1 lub 0 w GATHERING -> brak limitu
    timeLimit: number;
    goals: LevelGoal[];
    availableBlockIds: number[]; 
}

// --- POZIOM 1: Kopalnia (Standard) ---
export const LEVEL_1: LevelConfig = {
    id: "level_1",
    name: "Level 1: The Mine",
    mode: 'STANDARD', 
    moveLimit: 20,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3],
    goals: [
        { type: 'COLLECT', targetId: 200, amount: 5 }
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, S_, S_, S_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, S_, R_, S_, R_, R_],
        [R_, R_, R_, I_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// --- POZIOM 2: Zamarznięte Serce (Standard) ---
export const LEVEL_2: LevelConfig = {
    id: "level_2",
    name: "Level 2: Frozen Time",
    mode: 'STANDARD',
    moveLimit: 0,
    timeLimit: 90,
    availableBlockIds: [0, 1, 2, 4, 5],
    goals: [
        { type: 'SCORE', amount: 3000 }
    ],
    layout: [
        [S_, S_, S_, S_, S_, S_, S_],
        [S_, I_, I_, I_, I_, I_, S_],
        [S_, I_, R_, R_, R_, I_, S_],
        [S_, I_, R_, R_, R_, I_, S_],
        [S_, I_, R_, R_, R_, I_, S_],
        [S_, I_, I_, I_, I_, I_, S_],
        [S_, S_, S_, R_, S_, S_, S_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// --- POZIOM 3: Budowa Spichlerza (Construction) ---
export const LEVEL_3: LevelConfig = {
    id: "level_3",
    name: "Level 3: Build Granary",
    mode: 'CONSTRUCTION', 
    moveLimit: 30, 
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3], 
    goals: [
        { type: 'COLLECT', targetId: 2, amount: 10 }, 
        { type: 'SCORE', amount: 1000 } 
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, I_, R_, R_, R_], 
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// --- NOWOŚĆ: POZIOM 4: Las (Gathering / Freeplay) ---
// Brak limitów czasowych/ruchów (chyba że gracz sam wyjdzie).
// Cele są puste, bo celem jest samo zbieranie.
export const LEVEL_4: LevelConfig = {
    id: "level_4",
    name: "Expedition: Forest",
    mode: 'GATHERING',
    moveLimit: -1, // Nieskończoność
    timeLimit: 0,
    availableBlockIds: [0, 1, 2], // Głównie drewno i podstawowe
    goals: [], 
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];