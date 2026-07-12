import { describe, it, expect } from 'vitest';
import { LEVELS, LEVEL_1, LEVEL_2, LEVEL_5, LEVEL_6 } from '../../LevelDef';
import { simulateLevel } from '../LevelSimulator';
import { VOID } from '../../engine/Config';

describe('LevelSimulator — walidacja poziomów', () => {
    it('każdy poziom kończy symulację definitywnie i bez naruszeń integralności dziur', () => {
        for (const lvl of LEVELS) {
            const r = simulateLevel(lvl, { seed: 12345, maxMoves: 200 });
            expect(['WIN', 'LOSS', 'STUCK', 'MOVE_CAP'], lvl.id).toContain(r.result);
            // Twarda poprawność silnika: void nigdy nie jest niszczony/tworzony błędnie.
            expect(r.issues.filter(i => i.includes('void')), lvl.id).toEqual([]);
        }
    });

    it('wykrywa NIEWYGRYWALNY poziom (LEVEL_1: cel wymaga murów niemożliwych do stworzenia)', () => {
        const r = simulateLevel(LEVEL_1, { seed: 12345 });
        expect(r.won).toBe(false);
        expect(r.goals[0].met).toBe(false);
        expect(r.goals[0].current).toBe(0);
    });

    it('wykrywa MATCH NA STARCIE (LEVEL_2: 5 lodów w linii w layoucie)', () => {
        const r = simulateLevel(LEVEL_2, { seed: 12345 });
        expect(r.issues).toContain('nierozwiązane dopasowanie w spoczynku');
    });

    it('poziom z dziurami (LEVEL_5) jest wygrywalny i zachowuje kształt planszy', () => {
        const r = simulateLevel(LEVEL_5, { seed: 12345 });
        expect(r.won).toBe(true);
        const cols = 7;
        r.finalState.cells.forEach((c, i) => {
            if (LEVEL_5.layout[Math.floor(i / cols)][i % cols] === VOID) {
                expect(c.typeId).toBe(VOID);
            }
        });
    });

    it('poziom z blokerami (LEVEL_6) jest wygrywalny', () => {
        const r = simulateLevel(LEVEL_6, { seed: 12345 });
        expect(r.won).toBe(true);
    });

    it('symulacja jest deterministyczna dla tego samego ziarna', () => {
        const a = simulateLevel(LEVEL_6, { seed: 999 });
        const b = simulateLevel(LEVEL_6, { seed: 999 });
        expect(a.result).toBe(b.result);
        expect(a.movesUsed).toBe(b.movesUsed);
        expect(JSON.stringify(a.finalState.cells)).toBe(JSON.stringify(b.finalState.cells));
    });
});
