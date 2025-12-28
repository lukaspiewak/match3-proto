import { COLS, ROWS } from './Config';
import { type BuildingDefinition } from './BuildingDef';
import { Buildings } from './core/BuildingManager';

export const R_ = -1;  // Random
export const S_ = 200; // Stone
export const I_ = 300; // Ice

// Typy Celów
export type GoalType = 'SCORE' | 'COLLECT';

// Tryb poziomu
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
    moveLimit: number;
    timeLimit: number;
    goals: LevelGoal[];
    availableBlockIds: number[];
    // NOWOŚĆ: ID budynku, który ulepszamy po wygranej (tylko dla CONSTRUCTION)
    targetBuildingId?: string;
}

// --- GENERATOR POZIOMU BUDOWY ---
export function createConstructionLevel(def: BuildingDefinition): LevelConfig {
    const nextLevel = Buildings.getLevel(def.id) + 1;
    const costs = def.getUpgradeCost(nextLevel);

    // Cele to dokładnie tyle, ile wynosi koszt
    const goals: LevelGoal[] = costs.map(c => ({
        type: 'COLLECT',
        targetId: c.resourceId,
        amount: c.amount
    }));

    // Dostępne klocki: Muszą zawierać te wymagane do budowy + jakieś "przeszkadzajki"
    const requiredIds = costs.map(c => c.resourceId);
    // Dodajemy podstawowe klocki, żeby dało się grać, jeśli koszt to np. tylko złoto
    const pool = Array.from(new Set([...requiredIds, 0, 1, 2, 3, 4])).slice(0, 5);

    // Prosty layout losowy
    const layout = Array(ROWS).fill(0).map(() => Array(COLS).fill(R_));

    return {
        id: `build_${def.id}_lvl${nextLevel}`,
        name: `Build: ${def.name} Lvl ${nextLevel}`,
        mode: 'CONSTRUCTION',
        moveLimit: 30, // Stały limit ruchów na budowę (można balansować)
        timeLimit: 0,
        goals: goals,
        availableBlockIds: pool,
        targetBuildingId: def.id // Ważne!
    };
}

// --- POZIOMY STATYCZNE ---

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

export const LEVEL_2: LevelConfig = {
    id: "level_2",
    name: "Level 2: Frozen Time",
    mode: 'STANDARD',
    moveLimit: 0,
    timeLimit: 90,
    availableBlockIds: [0, 1, 2, 3],
    goals: [
        { type: 'SCORE', amount: 3000 }
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, S_],
        [R_, I_, I_, I_, I_, I_, S_],
        [R_, I_, R_, R_, R_, I_, S_],
        [R_, I_, R_, R_, R_, I_, S_],
        [R_, I_, R_, R_, R_, I_, S_],
        [R_, I_, I_, I_, I_, I_, S_],
        [R_, R_, R_, R_, R_, R_, S_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

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

export const LEVEL_4: LevelConfig = {
    id: "level_4",
    name: "Expedition",
    mode: 'GATHERING',
    moveLimit: -1,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3, 4],
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