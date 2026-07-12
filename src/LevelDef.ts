import { COLS, ROWS, VOID } from './engine/Config';
import { type BuildingDefinition } from './BuildingDef';
import { Buildings } from './core/BuildingManager';

export const R_ = -1;    // Random
export const S_ = 200;   // Stone
export const I_ = 300;   // Ice
export const V_ = VOID;  // Void (trwała dziura / kształt planszy)
export const C_ = 201;   // Crate (skrzynia — 1 sąsiedni match)
export const F_ = 202;   // Frosting (szron — 2 sąsiednie matche)
export const K_ = 203;   // Lock (kłódka — odsłania klocek)
export const B_ = 210;   // Bomb (licznik ruchów)

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
    // Opcjonalne wloty (indeksy komórek-spawnerów). Puste/brak = cała krawędź generuje bloki.
    spawners?: number[];
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
        layout: layout,
        moveLimit: 30 + (nextLevel * 5), // Stały limit ruchów na budowę (można balansować)
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
        // Kamień (3) jest w puli — zbieramy go matchując. (Wcześniej: mur 200, niewykonalne.)
        { type: 'COLLECT', targetId: 3, amount: 12 }
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
    // Lód rozrzucony (brak linii >=3 na starcie → brak darmowego matcha).
    layout: [
        [R_, R_, R_, R_, R_, R_, S_],
        [R_, I_, R_, R_, I_, R_, S_],
        [R_, R_, R_, I_, R_, R_, S_],
        [R_, I_, R_, R_, I_, R_, S_],
        [R_, R_, R_, I_, R_, R_, S_],
        [R_, I_, R_, R_, I_, R_, S_],
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

// Demo topologii: kształt "pucharu" — dziury w dolnych rogach (V_).
// Górny rząd w pełni grywalny → wszystkie kolumny się dolewają, brak zamkniętych kieszeni.
export const LEVEL_5: LevelConfig = {
    id: "level_5",
    name: "Level 5: Shaped Board",
    mode: 'STANDARD',
    moveLimit: 25,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3],
    goals: [
        { type: 'SCORE', amount: 2000 }
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [V_, R_, R_, R_, R_, R_, V_],
        [V_, V_, R_, R_, R_, V_, V_]
    ]
};

// Demo blokerów CC-style: skrzynie (C_), frosting (F_), kłódka (K_), bomba (B_).
// Cel: zniszczyć obie skrzynie. Bomba (5 ruchów) dokłada presji — rozbroisz ją
// sąsiednim matchem albo przegrywasz.
export const LEVEL_6: LevelConfig = {
    id: "level_6",
    name: "Level 6: Blockers",
    mode: 'STANDARD',
    moveLimit: 20,
    timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3],
    goals: [
        { type: 'COLLECT', targetId: C_, amount: 2 }
    ],
    layout: [
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, C_, R_, F_, R_, C_, R_],
        [R_, R_, K_, R_, B_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_],
        [R_, R_, R_, R_, R_, R_, R_]
    ]
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6];