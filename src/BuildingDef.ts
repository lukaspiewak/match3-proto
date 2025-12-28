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
        description: "Zwiększa limit przechowywanego Drewna (ID 2).",
        storageResourceId: 1, // Drewno
        baseCapacity: 100, // OK
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 50 }, 
            { resourceId: 200, amount: level * 10 } 
        ]
    },
    {
        id: "stone_depot",
        name: "Skład Kamienia",
        description: "Zwiększa limit przechowywanego Kamienia (ID 200).",
        storageResourceId: 3, // Kamień
        baseCapacity: 100, // ZMIANA: 50 -> 100
        capacityPerLevel: 50, // ZMIANA: 25 -> 50 (dla równego skalowania)
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 50 }, 
            { resourceId: 1, amount: level * 20 }  
        ]
    },
    {
        id: "treasury",
        name: "Skarbiec",
        description: "Zwiększa limit przechowywanego Złota (ID 3).",
        storageResourceId: 4, // Złoto
        baseCapacity: 100, // ZMIANA: 200 -> 100
        capacityPerLevel: 100, // ZMIANA: 200 -> 100
        getUpgradeCost: (level) => [
            { resourceId: 1, amount: level * 50 },   
            { resourceId: 3, amount: level * 50 }  
        ]
    },
    {
        id: "granary",
        name: "Spichlerz",
        description: "Zwiększa limit żywności (ID 1 - Zielone).",
        storageResourceId: 0, // Zielone
        baseCapacity: 100, // OK
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 2, amount: level * 30 }, 
            { resourceId: 3, amount: level * 10 }
        ]
    }
];

export const BuildingRegistry = {
    getAll: () => BUILDINGS,
    getById: (id: string) => BUILDINGS.find(b => b.id === id)
};