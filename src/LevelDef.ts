import { COLS, ROWS } from './Config';

export const R_ = -1;  // Random
export const S_ = 200; // Stone
export const I_ = 300; // Ice

// Typy Celów
export type GoalType = 'SCORE' | 'COLLECT';

// NOWOŚĆ: Tryb poziomu
export type LevelMode = 'STANDARD' | 'CONSTRUCTION';

export interface LevelGoal {
    type: GoalType;
    targetId?: number;
    amount: number;
}

export interface LevelConfig {
    id: string;
    name: string;
    mode: LevelMode; // NOWOŚĆ: Flaga trybu
    layout: number[][];
    moveLimit: number;
    timeLimit: number;
    goals: LevelGoal[];
    availableBlockIds: number[]; 
}

// --- POZIOM 1: Kopalnia (Standard) ---
export const LEVEL_1: LevelConfig = {
    id: "level_1",
    name: "Level 1: The Mine",
    mode: 'STANDARD', // Zbieramy surowce
    moveLimit: 20,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3],
    goals: [
        { type: 'COLLECT', targetId: 200, amount: 5 }
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
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
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, I_, I_, I_, I_, I_, R_],
        [R_, I_, R_, R_, R_, I_, R_],
        [R_, I_, R_, R_, R_, I_, R_],
        [R_, I_, R_, R_, R_, I_, R_],
        [R_, I_, I_, I_, I_, I_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// --- NOWOŚĆ: POZIOM 3: Budowa Spichlerza (Construction) ---
// Wymaga zużycia 10 Kamieni (ID 200) i 1000 punktów.
// Każde zbicie klocka (np. serduszka, monety) będzie je ODEJMOWAĆ z naszego konta.
export const LEVEL_3: LevelConfig = {
    id: "level_3",
    name: "Level 3: Build Granary",
    mode: 'CONSTRUCTION', 
    moveLimit: 30, // Mamy 30 ruchów, żeby "wydać" surowce
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3], 
    goals: [
        { type: 'COLLECT', targetId: 2, amount: 10 }, // Musimy "zużyć" 10 drewna
        { type: 'SCORE', amount: 1000 } // Musimy wygenerować 1000 punktów "kosztu robocizny"
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, I_, R_, R_, R_], // Dużo kamieni do zużycia
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];