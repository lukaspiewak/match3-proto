import { BlockDefinition, BlockRegistry } from '../engine/BlockDef';

/**
 * Definicje bloków TEJ gry (content) — poza silnikiem.
 * Silnik dostarcza tylko mechanizm (BlockRegistry); tu ładujemy nasz zestaw.
 *
 * Uwaga: domyślny zestaw akcji silnika (ActionManager/DEFAULT_TRIGGERS) zakłada
 * konwencję ID bloków specjalnych: TNT=100, Color Bomb=101, Ore=30/31, Wall=200, Ice=300.
 * Inna gra może użyć własnych ID + własnego mapowania akcji.
 */
export const GAME_BLOCKS: BlockDefinition[] = [
    // --- Podstawowe surowce (id < 100) ---
    new BlockDefinition(0, "Food", 0x68D391, 0x276749, '🍏', 'block_1'),
    new BlockDefinition(1, "Wood", 0xd39168, 0x694834, '🪵', 'block_2'),
    new BlockDefinition(2, "Water", 0x63B3ED, 0x2C5282, '💧', 'block_6'),
    new BlockDefinition(3, "Stone", 0xc6ccd5, 0x2D3748, '🪨', 'block_4', 20, "Tworzy Rudy", { onMatch5: 'CREATE_ORE' }),
    new BlockDefinition(4, "Golden Coin", 0xF6E05E, 0x975A16, '🪙', 'block_3', 1, "Tworzy kamienie", { onMatch5: 'CREATE_WALL' }),

    // --- Rudy (tworzone przez CREATE_ORE) ---
    new BlockDefinition(30, "Copper Ore", 0x76E4F7, 0x285E61, '🟩', 'block_0', 0),
    new BlockDefinition(31, "Iron Ore", 0xFC8181, 0x9B2C2C, '🔶', 'block_0', 0),

    // --- Bloki specjalne ---
    new BlockDefinition(100, "TNT", 0xFFFFFF, 0x000000, '🧨', 'block_special', 0, "TNT",
        { onMatch3: 'EXPLODE_BIG', onMatch4: 'EXPLODE_BIG', onMatch5: 'EXPLODE_BIG', onActivate: 'EXPLODE_BIG' },
        false, true, true, 1, true),
    new BlockDefinition(101, "Color Bomb", 0xFFFFFF, 0x000000, '🌈', 'block_colorbomb', 0, "Color Bomb",
        { onActivate: 'CLEAR_COLOR' },
        false, true, false, 1, true),

    // Payload — do dostarczenia na krawędź (np. piłka do bramki).
    new BlockDefinition(110, "Payload", 0xF6AD55, 0x9C4221, '💎', 'block_payload', 0, "Dostarcz do krawędzi",
        {}, true, false, false, 1, true, { deliverAtEdge: true }),

    // --- Przeszkody / blokery ---
    new BlockDefinition(200, "Wall", 0x718096, 0x2D3748, '🧱', 'block_wall', 0, "Przeszkoda",
        {}, false, false, false, 1, false),
    new BlockDefinition(201, "Crate", 0x8B5A2B, 0x5B3A1B, '📦', 'block_crate', 0, "Skrzynia",
        {}, false, false, false, 1, false, { damagedByAdjacent: true }),
    new BlockDefinition(202, "Frosting", 0xCFE8FF, 0x7FB0E0, '❄️', 'block_frost', 0, "Szron (2 warstwy)",
        {}, false, false, false, 2, false, { damagedByAdjacent: true }),
    new BlockDefinition(203, "Lock", 0x9AA0A6, 0x5F6368, '🔒', 'block_lock', 0, "Kłódka",
        {}, false, false, false, 1, false, { damagedByAdjacent: true, revealTypeId: 0 }),
    new BlockDefinition(210, "Bomb", 0x2D3436, 0xE74C3C, '💣', 'block_bomb', 0, "Bomba (licznik ruchów)",
        {}, false, false, false, 1, false, { damagedByAdjacent: true, initialCountdown: 5 }),

    new BlockDefinition(300, "Ice", 0xA3BFFA, 0x5A67D8, '🧊', 'block_ice', 5, "Lód",
        {}, false, true, true, 2, true),
];

/** Ładuje content gry do rejestru silnika. Wołane przy starcie aplikacji i w testach. */
export function registerGameBlocks(): void {
    BlockRegistry.clear();
    BlockRegistry.load(GAME_BLOCKS);
}

// Rejestracja przy imporcie (side-effect) — jak dawne BlockRegistry.init().
registerGameBlocks();
