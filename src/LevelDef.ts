import { COLS, ROWS } from './Config';

// USUNIĘTO BŁĘDNY IMPORT: import { R, S, I } from './LevelDef';

// Stałe dla czytelności
export const R_ = -1;  // Random (Losowy)
export const S_ = 200; // Stone (Kamień)
export const I_ = 300; // Ice (Lód)

// Typy Celów
export type GoalType = 'SCORE' | 'COLLECT';

export interface LevelGoal {
    type: GoalType;
    targetId?: number; // Np. ID bloku do zebrania (dla COLLECT)
    amount: number;    // Ile punktów lub ile sztuk
}

export interface LevelConfig {
    id: string;
    layout: number[][];      // Układ planszy (7x9)
    moveLimit: number;       // Limit ruchów (0 = brak)
    timeLimit: number;       // Limit czasu w sekundach (0 = brak)
    goals: LevelGoal[];      // Lista celów
}

// --- POZIOM 1: Kopalnia ---
// Cel: Zbij 5 kamieni.
export const LEVEL_1: LevelConfig = {
    id: "level_1",
    moveLimit: 20,
    timeLimit: 0,
    goals: [
        { type: 'COLLECT', targetId: 200, amount: 5 } // ID 200 = Kamień
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, S_, S_, S_, R_, R_], // Kamienie na górze
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, S_, R_, S_, R_, R_],
        [R_, R_, R_, I_, R_, R_, R_], // Trochę lodu
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// --- POZIOM 2: Zamarznięte Serce ---
export const LEVEL_2: LevelConfig = {
    id: "level_2",
    moveLimit: 0,
    timeLimit: 90,
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
        [S_, S_, S_, R_, S_, S_, S_], // Tylko jedno wejście
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};