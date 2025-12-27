export class ResourceManager {
    private inventory: { [blockId: number]: number } = {};
    private readonly STORAGE_KEY = 'match3_save_data';

    constructor() {
        this.load();
        // DEBUG: Dajemy trochę zasobów na start, żeby można było testować tryb Construction
        if (!this.inventory[200]) this.inventory[200] = 50; // 50 Kamieni na start
        if (!this.inventory[0]) this.inventory[0] = 100; // 100 Serc
    }

    public addResource(blockId: number, amount: number) {
        if (!this.inventory[blockId]) {
            this.inventory[blockId] = 0;
        }
        this.inventory[blockId] += amount;
        this.save();
    }

    // NOWOŚĆ: Nadpisanie całego inwentarza (używane po trybie Construction)
    public setInventory(newInventory: { [id: number]: number }) {
        this.inventory = { ...newInventory };
        this.save();
    }

    public getAmount(blockId: number): number {
        return this.inventory[blockId] || 0;
    }

    public getAll(): { [id: number]: number } {
        return { ...this.inventory };
    }

    public clearSave() {
        this.inventory = {};
        localStorage.removeItem(this.STORAGE_KEY);
    }

    private save() {
        try {
            const json = JSON.stringify(this.inventory);
            localStorage.setItem(this.STORAGE_KEY, json);
            console.log("💾 Game Saved!");
        } catch (e) {
            console.warn("Save failed:", e);
        }
    }

    private load() {
        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (json) {
                this.inventory = JSON.parse(json);
            }
        } catch (e) {
            this.inventory = {};
        }
    }
}

export const Resources = new ResourceManager();