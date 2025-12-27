import { COLS, ROWS } from './Config';

export const R_ = -1;  // Random
export const S_ = 200; // Stone
export const I_ = 300; // Ice

export type GoalType = 'SCORE' | 'COLLECT';

export interface LevelGoal {
    type: GoalType;
    targetId?: number;
    amount: number;
}

export interface LevelConfig {
    id: string;
    name: string;
    layout: number[][];
    moveLimit: number;
    timeLimit: number;
    goals: LevelGoal[];
    // NOWOŚĆ: Lista ID bloków, które mogą się pojawiać w tym poziomie
    availableBlockIds: number[]; 
}

// --- POZIOM 1: Kopalnia ---
// Dostępne tylko 4 kolory (łatwiej o combo) + Kamienie i Lód
export const LEVEL_1: LevelConfig = {
    id: "level_1",
    name: "Level 1: The Mine",
    moveLimit: 20,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3], // Tylko 4 podstawowe kolory
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

// --- POZIOM 2: Zamarznięte Serce ---
// Dostępne 5 kolorów
export const LEVEL_2: LevelConfig = {
    id: "level_2",
    name: "Level 2: Frozen Time",
    moveLimit: 0,
    timeLimit: 90,
    availableBlockIds: [0, 1, 2, 4, 5], // Inny zestaw kolorów
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

export const LEVELS = [LEVEL_1, LEVEL_2];