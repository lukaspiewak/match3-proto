import { describe, it, expect } from 'vitest';
import { BlockRegistry, BlockDefinition } from '../BlockDef';

describe('BlockDefinition.resolveAction — wybór akcji wg rozmiaru i kształtu', () => {
    const food = BlockRegistry.getById(0); // brak własnych triggerów (domyślne)

    it('mniejsze dopasowania idą wg rozmiaru', () => {
        expect(food.resolveAction(3, 'LINE')).toBe(food.triggers.onMatch3);
        expect(food.resolveAction(4, 'LINE')).toBe(food.triggers.onMatch4);
    });

    it('prosta linia >=5 → onMatch5 (brak onLine5)', () => {
        expect(food.resolveAction(5, 'LINE')).toBe(food.triggers.onMatch5);
        expect(food.resolveAction(6, 'LINE')).toBe(food.triggers.onMatch5);
    });

    it('zgięcia L/T (>=5) → EXPLODE_BIG (wrapped, domyślnie)', () => {
        expect(food.resolveAction(5, 'L_SHAPE')).toBe('EXPLODE_BIG');
        expect(food.resolveAction(5, 'T_SHAPE')).toBe('EXPLODE_BIG');
    });

    it('kształt nie wpływa na dopasowania < 5 (poza SQUARE)', () => {
        // L o rozmiarze 4 nie występuje w LineMatchRule, ale gdyby: nadal wg rozmiaru
        expect(food.resolveAction(4, 'L_SHAPE')).toBe(food.triggers.onMatch4);
    });

    it('blok z własnym onMatch5 zachowuje go dla prostej linii', () => {
        const stone = BlockRegistry.getById(3); // onMatch5: 'CREATE_ORE'
        expect(stone.resolveAction(5, 'LINE')).toBe('CREATE_ORE');
        expect(stone.resolveAction(5, 'T_SHAPE')).toBe('EXPLODE_BIG'); // kształt ma pierwszeństwo
    });

    it('własny onLine5 nadpisuje prostą linię 5 (np. color bomb)', () => {
        const custom = new BlockDefinition(500, 'Test', 0, 0, '?', 'x', 10, '', { onLine5: 'MAGIC_BONUS' });
        expect(custom.resolveAction(5, 'LINE')).toBe('MAGIC_BONUS');
        expect(custom.resolveAction(5, 'L_SHAPE')).toBe('EXPLODE_BIG');
    });

    it('można wyłączyć wrapped ustawiając onMatchL/onMatchT jawnie', () => {
        const custom = new BlockDefinition(501, 'Test2', 0, 0, '?', 'x', 10, '', { onMatchL: 'NONE', onMatchT: 'NONE' });
        // 'NONE' jest zdefiniowane, więc ma pierwszeństwo → jawnie brak akcji
        expect(custom.resolveAction(5, 'L_SHAPE')).toBe('NONE');
    });
});
