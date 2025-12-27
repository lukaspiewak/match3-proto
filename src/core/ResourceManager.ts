// src/core/ResourceManager.ts
export class ResourceManager {
    // Mapa: ID Bloku -> Ilość posiadana
    private inventory: { [blockId: number]: number } = {};
    private readonly STORAGE_KEY = 'match3_save_data';

    constructor() {
        this.load();
    }

    // Dodaj zasoby (np. po wygranym poziomie)
    public addResource(blockId: number, amount: number) {
        if (!this.inventory[blockId]) {
            this.inventory[blockId] = 0;
        }
        this.inventory[blockId] += amount;
        this.save();
    }

    // Pobierz ilość konkretnego zasobu
    public getAmount(blockId: number): number {
        return this.inventory[blockId] || 0;
    }

    // Pobierz wszystko (np. do wyświetlenia w menu)
    public getAll(): { [id: number]: number } {
        return { ...this.inventory };
    }

    // Zapis do localStorage
    private save() {
        try {
            const json = JSON.stringify(this.inventory);
            localStorage.setItem(this.STORAGE_KEY, json);
            console.log("💾 Game Saved!");
        } catch (e) {
            console.warn("Save failed:", e);
        }
    }

    // Odczyt z localStorage
    private load() {
        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (json) {
                this.inventory = JSON.parse(json);
                console.log("📂 Game Loaded:", this.inventory);
            }
        } catch (e) {
            console.warn("Load failed:", e);
            this.inventory = {};
        }
    }

    // Opcjonalnie: Reset postępów (dla debugowania)
    public clearSave() {
        this.inventory = {};
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

// Eksportujemy jedną, globalną instancję
export const Resources = new ResourceManager();