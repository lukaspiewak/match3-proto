import { describe, it, expect } from 'vitest';
import { BoardLogic } from '../BoardLogic';
import { BlockRegistry, BlockDefinition } from '../BlockDef';
import { type GameConfig } from '../Config';

const NONE = { onMatch3: 'NONE', onMatch4: 'NONE', onMatch5: 'NONE', onDropDown: 'NONE', onLine5: 'NONE', onActivate: 'NONE' } as const;
function cfg(extra: Partial<GameConfig>): GameConfig {
    return { cols: 7, rows: 7, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed: 20260713, ...extra };
}

describe('BoardLogic init — wstępne wypełnienie nie zależy od id 0..N-1', () => {
    it('używa config.availableBlockIds gdy gra ma inny zakres id (bez zawieszenia)', () => {
        // Klejnoty pod 500-504; id 0-4 NIE są tą paletą. Dawniej konstruktor wołał
        // initBoard() z fallbackiem 0..N-1 i zapętlał się na anty-match, gdy 0-4 puste.
        BlockRegistry.load([500, 501, 502, 503, 504].map(id =>
            new BlockDefinition(id, 'g' + id, 0xffffff, 0xffffff, 'x', 'a', 10, '', NONE)));
        const b = new BoardLogic(cfg({ availableBlockIds: [500, 501, 502, 503, 504] }));
        const used = new Set(b.cells.map(c => c.typeId));
        expect([...used].every(id => id >= 500 && id <= 504)).toBe(true);
        expect(b.cells.length).toBe(49);
    });

    it('nie zawiesza się przy zdegenerowanej puli (jeden niezarejestrowany id)', () => {
        // Bounded re-roll: nawet gdy losowanie zwraca wciąż to samo, initBoard kończy pracę.
        const b = new BoardLogic(cfg({ cols: 5, rows: 5, availableBlockIds: [99] }));
        expect(b.cells.length).toBe(25); // dotarcie tutaj = brak nieskończonej pętli
    });
});
