import { Random } from './Random';

export type SpecialAction = 
    | 'NONE' 
    | 'EXPLODE_SMALL' 
    | 'EXPLODE_BIG' 
    | 'LINE_CLEAR_H' 
    | 'LINE_CLEAR_V' 
    | 'MAGIC_BONUS' 
    | 'CREATE_SPECIAL'  // Tworzy Gwiazdę (ID 100)
    | 'CREATE_STONE'    // Tworzy Kamień (ID 200)
    | 'CREATE_ICE';     // Tworzy Lód (ID 300)

export const SPECIAL_BLOCK_ID = 100;

export interface BlockTriggers {
    onMatch3: SpecialAction;
    onMatch4: SpecialAction;
    onMatch5: SpecialAction;
    onDropDown: SpecialAction;
}

export class BlockDefinition {
    public readonly triggers: BlockTriggers;

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
        public readonly hasGravity: boolean = true 
    ) {
        this.triggers = {
            onMatch3: customTriggers.onMatch3 || 'NONE',
            onMatch4: customTriggers.onMatch4 || 'EXPLODE_SMALL',
            onMatch5: customTriggers.onMatch5 || 'CREATE_SPECIAL',
            onDropDown: customTriggers.onDropDown || 'CREATE_STONE'
        };
    }
}

export class BlockRegistry {
    private static blocks: BlockDefinition[] = [];

    public static init() {
        this.blocks = [
            // Standardowe bloki
            new BlockDefinition(0, "Red Heart", 0xFC8181, 0x9B2C2C, '♥', 'block_0'),
            new BlockDefinition(1, "Green Club", 0x68D391, 0x276749, '♣', 'block_1'),
            new BlockDefinition(2, "Blue Diamond", 0x63B3ED, 0x2C5282, '♦', 'block_2'),
            // Przykład: Moneta przy Match-5 tworzy Kamień (dla testu mechaniki)
            new BlockDefinition(3, "Golden Coin", 0xF6E05E, 0x975A16, '$', 'block_3', 5, "Tworzy kamienie", { onMatch5: 'CREATE_STONE' }), 
            new BlockDefinition(4, "Purple Spade", 0xB794F4, 0x553C9A, '♠', 'block_4'),
            new BlockDefinition(5, "Cyan Circle", 0x76E4F7, 0x285E61, '●', 'block_5', 10, "Magiczna kula", { onMatch4: 'LINE_CLEAR_V', onMatch5: 'LINE_CLEAR_H' }),
            new BlockDefinition(6, "Orange Peak", 0xF6AD55, 0x9C4221, '▲', 'block_6')
        ];

        // 100: Gwiazda
        const specialBlock = new BlockDefinition(
            SPECIAL_BLOCK_ID, "Rainbow Star", 0xFFFFFF, 0x000000, '★', 'block_special', 0, "Moc",
            { onMatch3: 'EXPLODE_BIG', onMatch4: 'EXPLODE_BIG', onMatch5: 'EXPLODE_BIG' },
            false, true, true, 1, true
        );
        this.blocks[SPECIAL_BLOCK_ID] = specialBlock;

        // 200: Kamień (Statyczny)
        const stoneBlock = new BlockDefinition(
            200, "Stone", 0x718096, 0x2D3748, '■', 'block_stone', 0, "Przeszkoda",
            {}, false, false, false, 1, false 
        );
        this.blocks[200] = stoneBlock;

        // 300: Lód (Statyczny)
        const iceBlock = new BlockDefinition(
            300, "Ice Block", 0xA3BFFA, 0x5A67D8, '❄', 'block_ice', 5, "Lód",
            {}, false, true, true, 2, true
        );
        this.blocks[300] = iceBlock;
    }

    // ... reszta metod bez zmian ...
    public static getById(id: number): BlockDefinition { return this.blocks[id]; }
    public static getAll(): BlockDefinition[] { return this.blocks.filter(b => b && b.id < 100); }
    public static getAssetManifest() { return this.blocks.filter(b => b).map(b => ({ alias: b.assetAlias, src: `/assets/${b.assetAlias}.svg` })); }
    public static getRandomBlockId(activeCount: number): number {
        const activeBlocks = this.blocks.slice(0, activeCount);
        if(this.blocks[200]) activeBlocks.push(this.blocks[200]);
        if(this.blocks[300]) activeBlocks.push(this.blocks[300]);
        const totalWeight = activeBlocks.reduce((sum, block) => sum + block.weight, 0);
        let randomValue = Random.next() * totalWeight;
        for (const block of activeBlocks) {
            randomValue -= block.weight;
            if (randomValue <= 0) return block.id;
        }
        return activeBlocks[0].id; 
    }
}
BlockRegistry.init();