import { Buildings } from './BuildingManager';
import { type BuildingCost } from '../BuildingDef'; // Importujemy definicję kosztu

export class ResourceManager {
    private inventory: { [blockId: number]: number } = {};
    private readonly STORAGE_KEY = 'match3_save_data';

    constructor() {
        this.load();
        // DEBUG: Startowe zasoby
        if (!this.inventory[200]) this.inventory[200] = 50; 
        if (!this.inventory[0]) this.inventory[0] = 100; 
    }

    // ... (metody addResource, setInventory, getAmount, getAll, hasSpace bez zmian) ...
    public addResource(blockId: number, amount: number) {
        if (!this.inventory[blockId]) this.inventory[blockId] = 0;
        this.inventory[blockId] += amount;
        this.save();
    }

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

    public hasSpace(resourceId: number, currentSessionAmount: number = 0): boolean {
        const currentGlobal = this.getAmount(resourceId);
        const maxCapacity = Buildings.getResourceCapacity(resourceId);
        return (currentGlobal + currentSessionAmount) < maxCapacity;
    }

    // --- NOWOŚĆ: Logika wydawania surowców ---

    // Sprawdza, czy gracza stać na podany koszt
    public hasEnough(cost: BuildingCost[]): boolean {
        for (const item of cost) {
            if (this.getAmount(item.resourceId) < item.amount) {
                return false;
            }
        }
        return true;
    }

    // Pobiera surowce z konta. Zwraca true jeśli się udało.
    public spend(cost: BuildingCost[]): boolean {
        if (!this.hasEnough(cost)) return false;

        for (const item of cost) {
            this.inventory[item.resourceId] -= item.amount;
        }
        this.save();
        return true;
    }

    public clearSave() {
        this.inventory = {};
        localStorage.removeItem(this.STORAGE_KEY);
    }

    private save() {
        try {
            const json = JSON.stringify(this.inventory);
            localStorage.setItem(this.STORAGE_KEY, json);
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