import { Random } from './Random';
import type { MatchShape } from './match/MatchRule';

export type SpecialAction =
    | 'NONE'
    | 'EXPLODE_SMALL'
    | 'EXPLODE_BIG'
    | 'LINE_CLEAR_H'
    | 'LINE_CLEAR_V'
    | 'MAGIC_BONUS'
    | 'CLEAR_COLOR'      // color bomb — usuwa wszystkie bloki tego samego koloru
    | 'CREATE_SPECIAL'
    | 'CREATE_COLORBOMB' // tworzy blok Color Bomb (aktywowany swapem)
    | 'CREATE_WALL'
    | 'CREATE_ORE'
    | 'CREATE_ICE';


export interface BlockTriggers {
    onMatch3: SpecialAction;
    onMatch4: SpecialAction;
    onMatch5: SpecialAction;   // fallback dla dopasowań >=5 (i prostych linii bez onLine5)
    onDropDown: SpecialAction;

    // --- Zależne od KSZTAŁTU (mają pierwszeństwo przed onMatch5) ---
    // undefined → użyj onMatch5. Aktywne dla grup >=5 (poza onMatchSquare).
    onMatchL?: SpecialAction;      // zgięcie L  → domyślnie EXPLODE_BIG (wrapped)
    onMatchT?: SpecialAction;      // zgięcie T/+ → domyślnie EXPLODE_BIG (wrapped)
    onLine5?: SpecialAction;       // prosta linia >=5 → domyślnie tworzy Color Bomb
    onMatchSquare?: SpecialAction; // kwadrat 2x2 (wymaga reguły produkującej SQUARE)

    // Efekt AKTYWACJI bloku przez zamianę (swap). Blok z onActivate != 'NONE' to "specjalny".
    onActivate?: SpecialAction;
}

/**
 * DEFAULT_TRIGGERS — JEDNO, KONFIGUROWALNE miejsce mapujące UKŁAD dopasowania
 * (rozmiar + kształt) na EFEKT (akcję specjalną) dla wszystkich bloków.
 *
 * Zmiana tutaj wpływa globalnie; pojedynczy blok może nadpisać dowolne pole przez
 * `customTriggers` w konstruktorze. To domyślna "gramatyka" gatunku match-3:
 *   3          → brak, 4 → mały wybuch, 5 (prosta) → color bomb,
 *   L/T (>=5)  → wrapped (duży wybuch).
 */
export const DEFAULT_TRIGGERS: BlockTriggers = {
    onMatch3: 'NONE',
    onMatch4: 'EXPLODE_SMALL',
    onMatch5: 'CREATE_SPECIAL',
    onDropDown: 'NONE',
    onMatchL: 'EXPLODE_BIG',
    onMatchT: 'EXPLODE_BIG',
    onLine5: 'CREATE_COLORBOMB', // linia >=5 zostawia blok Color Bomb (swap → CLEAR_COLOR)
    onActivate: 'NONE',
    // onMatchSquare celowo pominięte (undefined) → fallback do logiki rozmiaru.
};

/** Dodatkowe właściwości blokerów (CC-style). Opcjonalne — nie psują istniejących bloków. */
export interface BlockOptions {
    /** Uszkadzany przez SĄSIEDNI match (frosting/skrzynia/kłódka). hp = liczba warstw. */
    damagedByAdjacent?: boolean;
    /** Po zbiciu (hp<=0) odsłania ten blok zamiast znikać (kłódka → klocek). undefined = zniszcz. */
    revealTypeId?: number;
    /** Licznik ruchów (bomba). >0 → blok jest bombą; 0 (domyślnie) → zwykły blok. */
    initialCountdown?: number;
    /** Po dotarciu do krawędzi (zgodnej z grawitacją) blok jest "dostarczony": znika i zgłasza gol. */
    deliverAtEdge?: boolean;
}

export class BlockDefinition {
    public readonly triggers: BlockTriggers;
    public readonly damagedByAdjacent: boolean;
    public readonly revealTypeId: number | undefined;
    public readonly initialCountdown: number;
    public readonly deliverAtEdge: boolean;

    constructor(
        public readonly id: number,
        public readonly name: string,
        public readonly color: number,
        public readonly iconColor: number,
        public readonly symbol: string,
        public readonly assetAlias: string,
        public readonly weight: number = 10,
        public readonly description: string = "",
        customTriggers: Partial<BlockTriggers> = {},

        public readonly isIndestructible: boolean = false,
        public readonly isSwappable: boolean = true,
        public readonly isMatchable: boolean = true,
        public readonly initialHp: number = 1,
        public readonly hasGravity: boolean = true,
        opts: BlockOptions = {}
    ) {
        this.damagedByAdjacent = opts.damagedByAdjacent ?? false;
        this.revealTypeId = opts.revealTypeId;
        this.initialCountdown = opts.initialCountdown ?? 0;
        this.deliverAtEdge = opts.deliverAtEdge ?? false;
        // Per-blok nadpisuje globalną konfigurację DEFAULT_TRIGGERS (układ → efekt).
        this.triggers = {
            onMatch3: customTriggers.onMatch3 ?? DEFAULT_TRIGGERS.onMatch3,
            onMatch4: customTriggers.onMatch4 ?? DEFAULT_TRIGGERS.onMatch4,
            onMatch5: customTriggers.onMatch5 ?? DEFAULT_TRIGGERS.onMatch5,
            onDropDown: customTriggers.onDropDown ?? DEFAULT_TRIGGERS.onDropDown,
            onMatchL: customTriggers.onMatchL ?? DEFAULT_TRIGGERS.onMatchL,
            onMatchT: customTriggers.onMatchT ?? DEFAULT_TRIGGERS.onMatchT,
            onLine5: customTriggers.onLine5 ?? DEFAULT_TRIGGERS.onLine5,
            onMatchSquare: customTriggers.onMatchSquare ?? DEFAULT_TRIGGERS.onMatchSquare,
            onActivate: customTriggers.onActivate ?? DEFAULT_TRIGGERS.onActivate,
        };
    }

    /** Czy blok jest "specjalny" — daje się aktywować zamianą (swapem). */
    public isSpecial(): boolean {
        return (this.triggers.onActivate ?? 'NONE') !== 'NONE';
    }

    /**
     * Wybiera akcję specjalną dla dopasowanej grupy na podstawie ROZMIARU i KSZTAŁTU.
     * Triggery zależne od kształtu mają pierwszeństwo; brak (undefined) → fallback do
     * onMatch5 (dla >=5) lub onMatch4/onMatch3.
     */
    public resolveAction(size: number, shape: MatchShape): SpecialAction {
        if (shape === 'SQUARE' && this.triggers.onMatchSquare) return this.triggers.onMatchSquare;
        if (size >= 5) {
            if (shape === 'T_SHAPE' && this.triggers.onMatchT) return this.triggers.onMatchT;
            if (shape === 'L_SHAPE' && this.triggers.onMatchL) return this.triggers.onMatchL;
            if (shape === 'LINE' && this.triggers.onLine5) return this.triggers.onLine5;
            return this.triggers.onMatch5;
        }
        if (size === 4) return this.triggers.onMatch4;
        if (size === 3) return this.triggers.onMatch3;
        return 'NONE';
    }
}

/**
 * BlockRegistry — mechanizm rejestru/lookupu definicji bloków.
 *
 * Silnik NIE definiuje żadnych bloków — to content gry. Gra ładuje swój zestaw
 * przez `BlockRegistry.load(defs)` przy starcie (patrz src/content/blocks.ts).
 */
export class BlockRegistry {
    private static blocks: BlockDefinition[] = [];

    /** Rejestruje pojedynczą definicję (nadpisuje po id). */
    public static register(def: BlockDefinition): void { this.blocks[def.id] = def; }
    /** Ładuje zestaw definicji (indeksowany po id). */
    public static load(defs: BlockDefinition[]): void { for (const d of defs) this.blocks[d.id] = d; }
    /** Czyści rejestr (np. przed załadowaniem innego zestawu / w testach). */
    public static clear(): void { this.blocks = []; }

    public static getById(id: number): BlockDefinition { return this.blocks[id]; }
    public static getAll(): BlockDefinition[] { return this.blocks.filter(b => b && b.id < 100); }
    public static getAssetManifest() { return this.blocks.filter(b => b).map(b => ({ alias: b.assetAlias, src: `/assets/${b.assetAlias}.svg` })); }

    // Stara metoda (zostawiamy dla kompatybilności)
    public static getRandomBlockId(activeCount: number): number {
        const ids = [];
        for (let i = 0; i < activeCount; i++) ids.push(i);
        return this.getRandomBlockIdFromList(ids);
    }

    // Ważone losowanie z listy dozwolonych. `rng` pozwala użyć własnego strumienia
    // (np. niezależnej kolejki per-kolumna); domyślnie globalny Random.
    public static getRandomBlockIdFromList(allowedIds: number[], rng: () => number = () => Random.next()): number {
        if (!allowedIds || allowedIds.length === 0) return 0; // Fallback

        // Filtrujemy, żeby upewnić się, że bloki istnieją
        const candidates = allowedIds.map(id => this.getById(id)).filter(b => b !== undefined);

        if (candidates.length === 0) return allowedIds[0] || 0;

        const totalWeight = candidates.reduce((sum, block) => sum + block.weight, 0);
        let randomValue = rng() * totalWeight;

        for (const block of candidates) {
            randomValue -= block.weight;
            if (randomValue <= 0) return block.id;
        }
        return candidates[0].id;
    }
}