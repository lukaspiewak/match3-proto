import { describe, it, expect } from 'vitest';
import { LEVELS, LEVEL_5, LEVEL_6, type LevelConfig } from '../../LevelDef';
import { simulateLevel } from '../LevelSimulator';
import { VOID } from '../../engine/Config';

const allRandom = (cols: number, rows: number) => Array.from({ length: rows }, () => Array(cols).fill(-1));

describe('LevelSimulator — walidacja poziomów', () => {
    it('WSZYSTKIE poziomy w grze: definitywny wynik i ZERO problemów (po naprawach)', () => {
        for (const lvl of LEVELS) {
            const r = simulateLevel(lvl, { seed: 12345, maxMoves: 200 });
            expect(['WIN', 'LOSS', 'STUCK', 'MOVE_CAP'], lvl.id).toContain(r.result);
            expect(r.issues, `${lvl.id}: ${r.issues.join('|')}`).toEqual([]);
        }
    });

    it('wykrywa NIEWYGRYWALNY poziom (cel na blok, którego nie da się uzyskać)', () => {
        const impossible: LevelConfig = {
            id: 'impossible', name: 'Impossible', mode: 'STANDARD',
            layout: allRandom(7, 9), moveLimit: 15, timeLimit: 0,
            availableBlockIds: [0, 1, 2, 3],
            goals: [{ type: 'COLLECT', targetId: 999, amount: 3 }], // 999 nigdy nie powstaje
        };
        const r = simulateLevel(impossible, { seed: 12345 });
        expect(r.won).toBe(false);
        expect(r.goals[0].current).toBe(0);
        expect(r.goals[0].met).toBe(false);
    });

    it('wykrywa MATCH NA STARCIE (wymuszona trójka na pełnej planszy — nic nie spada)', () => {
        // Pełna plansza bez luk → fizyka nic nie przesuwa → brak skanu → pozioma trójka
        // (0,0,0 w górnym rzędzie) zostaje w spoczynku (dokładnie jak pierwotny LEVEL_2).
        const layout = allRandom(7, 9);
        layout[0] = [0, 0, 0, -1, -1, -1, -1];
        const startMatch: LevelConfig = {
            id: 'startmatch', name: 'StartMatch', mode: 'STANDARD',
            layout, moveLimit: 5, timeLimit: 0, availableBlockIds: [0, 1, 2, 3],
            goals: [{ type: 'SCORE', amount: 9_999_999 }],
        };
        const r = simulateLevel(startMatch, { seed: 12345, maxMoves: 3 });
        expect(r.issues).toContain('nierozwiązane dopasowanie w spoczynku');
    });

    it('poziom z dziurami (LEVEL_5) jest wygrywalny i zachowuje kształt', () => {
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
        expect(simulateLevel(LEVEL_6, { seed: 12345 }).won).toBe(true);
    });

    it('symulacja jest deterministyczna dla tego samego ziarna', () => {
        const a = simulateLevel(LEVEL_6, { seed: 999 });
        const b = simulateLevel(LEVEL_6, { seed: 999 });
        expect(a.result).toBe(b.result);
        expect(a.movesUsed).toBe(b.movesUsed);
        expect(JSON.stringify(a.finalState.cells)).toBe(JSON.stringify(b.finalState.cells));
    });
});
