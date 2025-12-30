// src/BuildingDef.ts

export interface BuildingCost {
    resourceId: number;
    amount: number;
}

export interface BuildingDefinition {
    id: string;
    name: string;
    description: string;
    storageResourceId?: number;
    baseCapacity: number;
    capacityPerLevel: number;
    getUpgradeCost: (targetLevel: number) => BuildingCost[];
}

export const BUILDINGS: BuildingDefinition[] = [
    {
        id: "sawmill",
        name: "Tartak",
        description: "Zwiększa limit przechowywanego Drewna (ID 1).",
        storageResourceId: 1, // Drewno
        baseCapacity: 100, // OK
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 30 },
            { resourceId: 1, amount: level * 10 },
            //{ resourceId: 4, amount: level * 2 }
        ]
    },
    {
        id: "stone_depot",
        name: "Skład Kamienia",
        description: "Zwiększa limit przechowywanego Kamienia (ID 3).",
        storageResourceId: 3, // Kamień
        baseCapacity: 100, // ZMIANA: 50 -> 100
        capacityPerLevel: 50, // ZMIANA: 25 -> 50 (dla równego skalowania)
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 40 },
            { resourceId: 1, amount: level * 20 },
            //{ resourceId: 4, amount: level * 2 }
        ]
    },
    {
        id: "treasury",
        name: "Skarbiec",
        description: "Zwiększa limit przechowywanego Złota (ID 4).",
        storageResourceId: 4, // Złoto
        baseCapacity: 50, // ZMIANA: 200 -> 100
        capacityPerLevel: 25, // ZMIANA: 200 -> 100
        getUpgradeCost: (level) => [
            { resourceId: 1, amount: level * 40 },
            { resourceId: 3, amount: level * 30 },
            //{ resourceId: 4, amount: level * 2 }
        ]
    },
    {
        id: "granary",
        name: "Spichlerz",
        description: "Zwiększa limit żywności (ID 0 - Zielone).",
        storageResourceId: 0, // Zielone
        baseCapacity: 100, // OK
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 2, amount: level * 30 },
            { resourceId: 3, amount: level * 10 },
            //{ resourceId: 4, amount: level * 2 }
        ]
    }
];

export const BuildingRegistry = {
    getAll: () => BUILDINGS,
    getById: (id: string) => BUILDINGS.find(b => b.id === id)
};