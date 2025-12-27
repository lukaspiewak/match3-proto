// src/BuildingDef.ts

export interface BuildingCost {
    resourceId: number; // ID surowca (np. 2 = Drewno, 3 = Złoto)
    amount: number;     // Ilość potrzebna do rozpoczęcia budowy
}

export interface BuildingDefinition {
    id: string;
    name: string;
    description: string;
    
    // Logika Magazynowa
    storageResourceId?: number; // Jaki surowiec ten budynek limituje (opcjonalne, np. Ratusz może nie limitować niczego)
    baseCapacity: number;       // Pojemność na poziomie 1
    capacityPerLevel: number;   // O ile rośnie pojemność z każdym poziomem
    
    // Koszt wejścia w tryb Construction (Upgrade)
    // Funkcja zwracająca koszt dla danego poziomu (level to poziom NA KTÓRY wchodzimy)
    getUpgradeCost: (targetLevel: number) => BuildingCost[];
}

export const BUILDINGS: BuildingDefinition[] = [
    {
        id: "sawmill",
        name: "Tartak",
        description: "Zwiększa limit przechowywanego Drewna (ID 2).",
        storageResourceId: 2, // Drewno
        baseCapacity: 100,
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 50 }, // Wymaga Złota do opłacenia robotników
            { resourceId: 200, amount: level * 10 } // Wymaga Kamienia pod fundamenty
        ]
    },
    {
        id: "stone_depot",
        name: "Skład Kamienia",
        description: "Zwiększa limit przechowywanego Kamienia (ID 200).",
        storageResourceId: 200, // Kamień
        baseCapacity: 50,
        capacityPerLevel: 25,
        getUpgradeCost: (level) => [
            { resourceId: 3, amount: level * 50 }, // Złoto
            { resourceId: 2, amount: level * 20 }  // Drewno (szalunki, rusztowania)
        ]
    },
    {
        id: "treasury",
        name: "Skarbiec",
        description: "Zwiększa limit przechowywanego Złota (ID 3).",
        storageResourceId: 3, // Złoto
        baseCapacity: 200,
        capacityPerLevel: 200,
        getUpgradeCost: (level) => [
            { resourceId: 2, amount: level * 50 },   // Drewno
            { resourceId: 200, amount: level * 50 }  // Kamień
        ]
    },
    {
        id: "granary",
        name: "Spichlerz",
        description: "Zwiększa limit żywności (ID 1 - Zielone).",
        storageResourceId: 1, // Zielone (przyjmijmy że to jedzenie)
        baseCapacity: 100,
        capacityPerLevel: 50,
        getUpgradeCost: (level) => [
            { resourceId: 2, amount: level * 30 }, 
            { resourceId: 200, amount: level * 10 }
        ]
    }
];

export const BuildingRegistry = {
    getAll: () => BUILDINGS,
    getById: (id: string) => BUILDINGS.find(b => b.id === id)
};