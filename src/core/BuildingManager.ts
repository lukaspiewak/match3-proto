// src/core/BuildingManager.ts
import { BuildingRegistry, BuildingDefinition } from '../BuildingDef';

interface SavedBuildingState {
    [buildingId: string]: number; // ID -> Level
}

export class BuildingManager {
    // Przechowujemy tylko poziom budynku. 
    // (Postęp wewnątrz poziomu będziemy ewentualnie dodawać później, jeśli construction mode będzie wieloetapowy)
    private levels: SavedBuildingState = {};
    private readonly STORAGE_KEY = 'match3_buildings_data';

    constructor() {
        this.load();
        this.initializeDefaults();
    }

    // Upewniamy się, że każdy budynek ma przynajmniej 1 poziom
    private initializeDefaults() {
        const all = BuildingRegistry.getAll();
        all.forEach(b => {
            if (!this.levels[b.id]) {
                this.levels[b.id] = 1;
            }
        });
    }

    // --- API ---

    public getLevel(buildingId: string): number {
        return this.levels[buildingId] || 1;
    }

    // Awansuj budynek (wywoływane po wygraniu poziomu CONSTRUCTION)
    public upgradeBuilding(buildingId: string) {
        if (!this.levels[buildingId]) this.levels[buildingId] = 1;
        this.levels[buildingId]++;
        this.save();
        console.log(`🏗️ Building ${buildingId} upgraded to Level ${this.levels[buildingId]}!`);
    }

    // Oblicz maksymalną pojemność dla danego SUROWCA na podstawie budynków
    // (Sumuje pojemność wszystkich budynków, które magazynują ten surowiec)
    public getResourceCapacity(resourceId: number): number {
        let totalCapacity = 0;
        const allBuildings = BuildingRegistry.getAll();

        for (const def of allBuildings) {
            if (def.storageResourceId === resourceId) {
                const lvl = this.getLevel(def.id);
                // Wzór: Baza + (Level-1 * Przyrost)
                // Np. Baza 100, PerLvl 50. Lvl 1 = 100. Lvl 2 = 150.
                const cap = def.baseCapacity + ((lvl - 1) * def.capacityPerLevel);
                totalCapacity += cap;
            }
        }

        // Jeśli nie ma budynku dla danego surowca, ustalamy jakiś domyślny limit (np. 50) lub brak limitu
        if (totalCapacity === 0) return 999999; 
        
        return totalCapacity;
    }

    // --- ZAPIS / ODCZYT ---

    private save() {
        try {
            const json = JSON.stringify(this.levels);
            localStorage.setItem(this.STORAGE_KEY, json);
        } catch (e) {
            console.warn("Building save failed:", e);
        }
    }

    private load() {
        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (json) {
                this.levels = JSON.parse(json);
                console.log("🏘️ Buildings Loaded:", this.levels);
            }
        } catch (e) {
            this.levels = {};
        }
    }
    
    public clearSave() {
        this.levels = {};
        localStorage.removeItem(this.STORAGE_KEY);
        this.initializeDefaults();
    }
}

export const Buildings = new BuildingManager();