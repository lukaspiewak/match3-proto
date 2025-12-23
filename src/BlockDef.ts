import { Random } from './Random';

// Klasa reprezentująca definicję pojedynczego typu bloku
export class BlockDefinition {
    constructor(
        public readonly id: number,          // Unikalne ID
        public readonly name: string,        // Nazwa
        public readonly color: number,       // Kolor tła (Pastelowy)
        public readonly iconColor: number,   // NOWOŚĆ: Kolor ikony (Kontrastowy)
        public readonly symbol: string,      // Ikona tekstowa
        public readonly assetAlias: string,  // Alias do assetu
        public readonly weight: number = 10, // Waga losowania
        public readonly description: string = "" // Opis
    ) {}
}

// Rejestr zarządzający wszystkimi typami bloków
export class BlockRegistry {
    private static blocks: BlockDefinition[] = [];

    public static init() {
        this.blocks = [
            // 0. Red: Pastelowy Koralowy tło + Ciemny Czerwony ikona
            new BlockDefinition(0, "Red Heart",    0xFC8181, 0x9B2C2C, '♥', 'block_0', 10, "Symbol życia"),
            
            // 1. Green: Miętowa Zieleń tło + Ciemna Zieleń ikona
            new BlockDefinition(1, "Green Club",   0x68D391, 0x276749, '♣', 'block_1', 10, "Symbol natury"),
            
            // 2. Blue: Błękit tło + Ciemny Granat ikona
            new BlockDefinition(2, "Blue Diamond", 0x63B3ED, 0x2C5282, '♦', 'block_2', 10, "Cenny klejnot"),
            
            // 3. Yellow: Piaskowe Złoto tło + Ciemny Brąz/Złoto ikona
            new BlockDefinition(3, "Golden Coin",  0xF6E05E, 0x975A16, '$', 'block_3', 5,  "Rzadka moneta"), 
            
            // 4. Purple: Lawendowy tło + Ciemny Fiolet ikona
            new BlockDefinition(4, "Purple Spade", 0xB794F4, 0x553C9A, '♠', 'block_4', 10, "Symbol mocy"),
            
            // 5. Cyan: Turkus tło + Ciemny Morski ikona
            new BlockDefinition(5, "Cyan Circle",  0x76E4F7, 0x285E61, '●', 'block_5', 10, "Magiczna kula"),
            
            // 6. Orange: Morelowy tło + Ciemny Pomarańcz ikona
            new BlockDefinition(6, "Orange Peak",  0xF6AD55, 0x9C4221, '▲', 'block_6', 10, "Górski szczyt")
        ];
    }

    public static getById(id: number): BlockDefinition {
        return this.blocks[id];
    }

    public static getAll(): BlockDefinition[] {
        return this.blocks;
    }

    public static getAssetManifest() {
        return this.blocks.map(b => ({
            alias: b.assetAlias,
            src: `/assets/${b.assetAlias}.svg`
        }));
    }

    public static getRandomBlockId(activeCount: number): number {
        const activeBlocks = this.blocks.slice(0, activeCount);
        const totalWeight = activeBlocks.reduce((sum, block) => sum + block.weight, 0);
        let randomValue = Random.next() * totalWeight;
        
        for (const block of activeBlocks) {
            randomValue -= block.weight;
            if (randomValue <= 0) {
                return block.id;
            }
        }
        return activeBlocks[0].id; 
    }
}

BlockRegistry.init();