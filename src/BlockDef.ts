import { Random } from './Random';

// Klasa reprezentująca definicję pojedynczego typu bloku
export class BlockDefinition {
    constructor(
        public readonly id: number,          // Unikalne ID (używane w logice planszy jako typeId)
        public readonly name: string,        // Nazwa (np. "Red Heart")
        public readonly color: number,       // Kolor (hex)
        public readonly symbol: string,      // Ikona tekstowa (fallback)
        public readonly assetAlias: string,  // Alias do Asset Managera (np. 'block_0')
        public readonly weight: number = 10, // Prawdopodobieństwo wystąpienia (domyślnie 10)
        public readonly description: string = "" // Opis fabularny/mechaniczny
    ) {}
}

// Rejestr zarządzający wszystkimi typami bloków
export class BlockRegistry {
    private static blocks: BlockDefinition[] = [];

    // Inicjalizacja definicji bloków (zastępuje tablice z Config.ts)
    public static init() {
        this.blocks = [
            new BlockDefinition(0, "Red Heart",    0xFF0000, '♥', 'block_0', 10, "Symbol życia"),
            new BlockDefinition(1, "Green Club",   0x00FF00, '♣', 'block_1', 10, "Symbol natury"),
            new BlockDefinition(2, "Blue Diamond", 0x0000FF, '♦', 'block_2', 10, "Cenny klejnot"),
            new BlockDefinition(3, "Golden Coin",  0xFFFF00, '$', 'block_3', 5,  "Rzadka moneta (mniejsza szansa!)"), // Mniejsza waga!
            new BlockDefinition(4, "Purple Spade", 0xFF00FF, '♠', 'block_4', 10, "Symbol mocy"),
            new BlockDefinition(5, "Cyan Circle",  0x00FFFF, '●', 'block_5', 10, "Magiczna kula"),
            new BlockDefinition(6, "Orange Peak",  0xFFA500, '▲', 'block_6', 10, "Górska szczyt")
        ];
    }

    public static getById(id: number): BlockDefinition {
        return this.blocks[id]; // W tym prostym przypadku ID odpowiada indeksowi
    }

    public static getAll(): BlockDefinition[] {
        return this.blocks;
    }

    // Zwraca listę ścieżek do assetów (dla preloadera w main.ts)
    // Zakładamy, że pliki nazywają się block_0.svg, block_1.svg itd. w /assets/
    public static getAssetManifest() {
        return this.blocks.map(b => ({
            alias: b.assetAlias,
            src: `/assets/${b.assetAlias}.svg`
        }));
    }

    /**
     * Losuje typ bloku uwzględniając wagi (prawdopodobieństwo).
     * Ogranicza się do pierwszych 'count' typów bloków (zgodnie z ustawieniami trudności).
     */
    public static getRandomBlockId(activeCount: number): number {
        // Ograniczamy pulę do liczby kolorów wybranej w opcjach
        const activeBlocks = this.blocks.slice(0, activeCount);
        
        // Suma wag
        const totalWeight = activeBlocks.reduce((sum, block) => sum + block.weight, 0);
        
        let randomValue = Random.next() * totalWeight;
        
        for (const block of activeBlocks) {
            randomValue -= block.weight;
            if (randomValue <= 0) {
                return block.id;
            }
        }
        
        return activeBlocks[0].id; // Fallback
    }
}

// Inicjalizujemy od razu
BlockRegistry.init();