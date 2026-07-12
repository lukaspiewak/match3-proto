import { describe, it, expect } from 'vitest';
import { BlockRegistry, BlockDefinition, DEFAULT_TRIGGERS } from '../BlockDef';

describe('DEFAULT_TRIGGERS — konfigurowalne mapowanie układ → efekt', () => {
    it('domyślna gramatyka gatunku', () => {
        expect(DEFAULT_TRIGGERS.onMatch4).toBe('EXPLODE_SMALL');
        expect(DEFAULT_TRIGGERS.onLine5).toBe('CLEAR_COLOR');   // prosta 5 = color bomb
        expect(DEFAULT_TRIGGERS.onMatchL).toBe('EXPLODE_BIG');  // L = wrapped
        expect(DEFAULT_TRIGGERS.onMatchT).toBe('EXPLODE_BIG');  // T = wrapped
    });

    it('nowy blok bez własnych triggerów dziedziczy DEFAULT_TRIGGERS', () => {
        const b = new BlockDefinition(600, 'Plain', 0, 0, '?', 'x');
        expect(b.resolveAction(5, 'LINE')).toBe('CLEAR_COLOR');
        expect(b.resolveAction(5, 'L_SHAPE')).toBe('EXPLODE_BIG');
        expect(b.resolveAction(4, 'LINE')).toBe('EXPLODE_SMALL');
    });
});

describe('BlockDefinition.resolveAction — wybór wg rozmiaru i kształtu', () => {
    const food = BlockRegistry.getById(0); // domyślne triggery

    it('mniejsze dopasowania idą wg rozmiaru', () => {
        expect(food.resolveAction(3, 'LINE')).toBe(food.triggers.onMatch3);
        expect(food.resolveAction(4, 'LINE')).toBe('EXPLODE_SMALL');
    });

    it('prosta linia >=5 → CLEAR_COLOR (color bomb)', () => {
        expect(food.resolveAction(5, 'LINE')).toBe('CLEAR_COLOR');
        expect(food.resolveAction(7, 'LINE')).toBe('CLEAR_COLOR');
    });

    it('zgięcia L/T (>=5) → EXPLODE_BIG (wrapped)', () => {
        expect(food.resolveAction(5, 'L_SHAPE')).toBe('EXPLODE_BIG');
        expect(food.resolveAction(5, 'T_SHAPE')).toBe('EXPLODE_BIG');
    });

    it('kształt nie wpływa na dopasowania < 5', () => {
        expect(food.resolveAction(4, 'L_SHAPE')).toBe('EXPLODE_SMALL');
    });

    it('per-blok nadpisuje globalny mapping (custom onLine5)', () => {
        const custom = new BlockDefinition(500, 'Test', 0, 0, '?', 'x', 10, '', { onLine5: 'MAGIC_BONUS' });
        expect(custom.resolveAction(5, 'LINE')).toBe('MAGIC_BONUS');
        expect(custom.resolveAction(5, 'L_SHAPE')).toBe('EXPLODE_BIG'); // reszta z defaultów
    });

    it('per-blok może wyłączyć wrapped (onMatchL/onMatchT = NONE)', () => {
        const custom = new BlockDefinition(501, 'Test2', 0, 0, '?', 'x', 10, '', { onMatchL: 'NONE', onMatchT: 'NONE' });
        expect(custom.resolveAction(5, 'L_SHAPE')).toBe('NONE');
        expect(custom.resolveAction(5, 'T_SHAPE')).toBe('NONE');
    });
});
