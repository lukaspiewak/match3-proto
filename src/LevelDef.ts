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
    name: string;            // NOWOŚĆ: Nazwa wyświetlana w menu
    layout: number[][];      // Układ planszy (7x9)
    moveLimit: number;       // Limit ruchów (0 = brak)
    timeLimit: number;       // Limit czasu w sekundach (0 = brak)
    goals: LevelGoal[];      // Lista celów
}

// --- POZIOM 1: Kopalnia ---
export const LEVEL_1: LevelConfig = {
    id: "level_1",
    name: "Level 1: The Mine",
    moveLimit: 20,
    timeLimit: 0,
    goals: [
        { type: 'COLLECT', targetId: 200, amount: 5 } // Zbij 5 kamieni
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
export const LEVEL_2: LevelConfig = {
    id: "level_2",
    name: "Level 2: Frozen Time",
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
        [S_, S_, S_, R_, S_, S_, S_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

// Eksportujemy listę wszystkich poziomów dla Menu
export const LEVELS = [LEVEL_1, LEVEL_2];