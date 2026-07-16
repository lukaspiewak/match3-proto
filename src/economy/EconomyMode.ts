import { Resources } from '../core/ResourceManager';
import { Buildings } from '../core/BuildingManager';
import type { LevelConfig, LevelMode } from '../LevelDef';

export type Inventory = { [id: number]: number };

/**
 * EconomyMode — strategia trybu poziomu (część gry, NIE silnika).
 *
 * Cała wiedza o ekonomii/mieście (Resources, Buildings, bankructwo, zapis)
 * żyje tutaj. GameManager tylko woła te hooki — nie zna trybów z nazwy.
 * Nowy tryb gry = nowa klasa, bez switchy w kontrolerze sesji.
 */
export interface EconomyMode {
    readonly id: LevelMode;
    /** Czy poziom automatycznie ocenia wygraną po spełnieniu celów. */
    readonly checksGoals: boolean;
    /** Inwentarz na start sesji. */
    initInventory(): Inventory;
    /** Aktualizuje inwentarz po zniszczeniu bloku; zwraca powód porażki lub null. */
    collect(typeId: number, inv: Inventory): string | null;
    /** Zapis wyników sesji do trwałej ekonomii po wygranej. */
    saveOnWin(inv: Inventory, level: LevelConfig): void;
}

/** Klasyczny poziom: zbieramy bloki, wygrana po celach, dopisanie do zasobów. */
class StandardMode implements EconomyMode {
    readonly id = 'STANDARD' as const;
    readonly checksGoals = true;
    initInventory(): Inventory { return {}; }
    collect(typeId: number, inv: Inventory): string | null {
        inv[typeId] = (inv[typeId] || 0) + 1;
        return null;
    }
    saveOnWin(inv: Inventory): void {
        for (const [id, amount] of Object.entries(inv)) Resources.addResource(parseInt(id), amount);
    }
}

/** Budowa: wydajemy zasoby (mogą się skończyć = bankructwo), wygrana ulepsza budynek. */
class ConstructionMode implements EconomyMode {
    readonly id = 'CONSTRUCTION' as const;
    readonly checksGoals = true;
    initInventory(): Inventory { return Resources.getAll(); }
    collect(typeId: number, inv: Inventory): string | null {
        if (inv[typeId] === undefined) inv[typeId] = 0;
        inv[typeId]--;
        if (inv[typeId] < 0) return `BANKRUPTCY! (Ran out of Block ${typeId})`;
        return null;
    }
    saveOnWin(inv: Inventory, level: LevelConfig): void {
        Resources.setInventory(inv);
        if (level.targetBuildingId) Buildings.upgradeBuilding(level.targetBuildingId);
    }
}

/** Ekspedycja: zbieramy do limitu pojemności, brak auto-wygranej (kończy gracz). */
class GatheringMode implements EconomyMode {
    readonly id = 'GATHERING' as const;
    readonly checksGoals = false;
    initInventory(): Inventory { return {}; }
    collect(typeId: number, inv: Inventory): string | null {
        const currentSession = inv[typeId] || 0;
        if (Resources.hasSpace(typeId, currentSession)) {
            inv[typeId] = (inv[typeId] || 0) + 1;
        } else {
            console.log(`Inventory FULL for block ${typeId}`);
        }
        return null;
    }
    saveOnWin(inv: Inventory): void {
        for (const [id, amount] of Object.entries(inv)) Resources.addResource(parseInt(id), amount);
    }
}

const MODES: Record<LevelMode, EconomyMode> = {
    STANDARD: new StandardMode(),
    CONSTRUCTION: new ConstructionMode(),
    GATHERING: new GatheringMode(),
};

export function resolveEconomyMode(mode: LevelMode): EconomyMode {
    return MODES[mode] ?? MODES.STANDARD;
}
