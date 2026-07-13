import { BlockDefinition, BlockRegistry, type BlockTriggers } from '../../engine/BlockDef';

/**
 * PALETA DAILY — własny content drugiego gatunku (dowód "bloki = dane").
 *
 * Pięć zwykłych klejnotów pod id 0–4 — czyli tam, gdzie silnik domyślnie szuka
 * bloków (fallback `blockTypes` = id 0..N-1). Druga gra ładuje SWOJĄ paletę w to
 * miejsce, nadpisując paletę city-buildera w rejestrze (BlockRegistry jest
 * per-uruchomienie gry; obie gry to osobne wejścia aplikacji).
 *
 * Kluczowe: WSZYSTKIE triggery = 'NONE' → brak color bomba i wybuchów. Dzięki temu
 * cel COLLECT wymaga realnego planowania (wiele dopasowań), a nie jednego one-shota.
 */

export const DAILY_BLOCK_IDS = [0, 1, 2, 3, 4];

// Cel dzienny: zbieramy pierwszy klejnot z palety.
export const DAILY_GOAL_TARGET = DAILY_BLOCK_IDS[0];

const NO_SPECIALS: Partial<BlockTriggers> = {
    onMatch3: 'NONE', onMatch4: 'NONE', onMatch5: 'NONE', onDropDown: 'NONE',
    onMatchL: 'NONE', onMatchT: 'NONE', onLine5: 'NONE', onMatchSquare: 'NONE',
    onActivate: 'NONE',
};

const GEMS: Array<{ id: number; name: string; color: number; symbol: string }> = [
    { id: 0, name: 'Ruby', color: 0xe23b4e, symbol: '◆' },
    { id: 1, name: 'Sapphire', color: 0x3b82e2, symbol: '●' },
    { id: 2, name: 'Emerald', color: 0x2fbf5e, symbol: '▲' },
    { id: 3, name: 'Amber', color: 0xf0a92b, symbol: '■' },
    { id: 4, name: 'Amethyst', color: 0x9b5de5, symbol: '★' },
];

let loaded = false;

/** Rejestruje paletę daily (idempotentnie). Wołane przy budowie łamigłówki. */
export function registerDailyBlocks(): void {
    if (loaded) return;
    BlockRegistry.load(GEMS.map(g => new BlockDefinition(
        g.id, g.name, g.color, 0xffffff, g.symbol, `gem_${g.id}`,
        10, `${g.name} (daily)`, NO_SPECIALS,
    )));
    loaded = true;
}
