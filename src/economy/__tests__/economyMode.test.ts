import { describe, it, expect } from 'vitest';
import { resolveEconomyMode, type Inventory } from '../EconomyMode';

describe('EconomyMode — strategie trybów', () => {
    it('STANDARD: dolicza bloki, bez porażki, sprawdza cele', () => {
        const m = resolveEconomyMode('STANDARD');
        expect(m.checksGoals).toBe(true);
        const inv: Inventory = {};
        expect(m.collect(5, inv)).toBeNull();
        expect(m.collect(5, inv)).toBeNull();
        expect(inv[5]).toBe(2);
    });

    it('CONSTRUCTION: odejmuje i sygnalizuje bankructwo poniżej zera', () => {
        const m = resolveEconomyMode('CONSTRUCTION');
        expect(m.checksGoals).toBe(true);
        const inv: Inventory = { 2: 1 };
        expect(m.collect(2, inv)).toBeNull();      // 1 -> 0
        expect(inv[2]).toBe(0);
        const fail = m.collect(2, inv);            // 0 -> -1 => bankructwo
        expect(typeof fail).toBe('string');
        expect(inv[2]).toBe(-1);
    });

    it('GATHERING: nie sprawdza auto-wygranej', () => {
        const m = resolveEconomyMode('GATHERING');
        expect(m.checksGoals).toBe(false);
    });

    it('każdy tryb ma spójne id', () => {
        expect(resolveEconomyMode('STANDARD').id).toBe('STANDARD');
        expect(resolveEconomyMode('CONSTRUCTION').id).toBe('CONSTRUCTION');
        expect(resolveEconomyMode('GATHERING').id).toBe('GATHERING');
    });
});
