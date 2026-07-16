import { describe, it, expect } from 'vitest';
import { seedForDate, dailyNumber, getDaily, solveDaily, shareString, createDailySession } from '../DailyChallenge';

describe('Daily Challenge — inny gatunek na silniku', () => {
    it('ziarno jest deterministyczne z daty (ten sam dla wszystkich)', () => {
        expect(seedForDate('2026-07-13')).toBe(20260713);
        expect(seedForDate('2026-07-13')).toBe(seedForDate('2026-07-13'));
        expect(dailyNumber('2026-01-01')).toBe(1);
    });

    it('getDaily jest deterministyczny (ta sama data → ta sama łamigłówka)', () => {
        const a = getDaily('2026-07-13');
        const b = getDaily('2026-07-13');
        expect(a).toEqual(b);
        expect(a.number).toBe(dailyNumber('2026-07-13'));
    });

    it('każdy dzienny wyzwanie jest GWARANTOWANIE rozwiązywalny', () => {
        for (const date of ['2026-07-13', '2026-07-14', '2026-08-01', '2026-12-25']) {
            const def = getDaily(date);
            const r = solveDaily(def);
            expect(r.won, `${date} seed ${def.seed}`).toBe(true);
            expect(r.collected).toBeGreaterThanOrEqual(def.goalAmount);
            expect(r.movesUsed).toBeLessThanOrEqual(def.moveLimit);
        }
    });

    it('solver jest deterministyczny (to samo wejście → to samo rozwiązanie)', () => {
        const def = getDaily('2026-07-13');
        const r1 = solveDaily(def);
        const r2 = solveDaily(def);
        expect(r1.won).toBe(r2.won);
        expect(r1.movesUsed).toBe(r2.movesUsed);
        expect(r1.moves).toEqual(r2.moves);
    });

    it('share string jest spoiler-free i w stylu Wordle', () => {
        const def = getDaily('2026-07-13');
        const r = solveDaily(def);
        const s = shareString(def, r);
        expect(s).toContain(`Daily #${def.number}`);
        expect(s).toMatch(/[✅❌]/);
        expect(s).toMatch(/[🟩🟥⬛]/);
        // nie zdradza planszy (brak współrzędnych/typów bloków)
        expect(s).not.toMatch(/typeId|\d+,\d+/);
    });

    it('sesja daily używa wyłącznie silnika (start = plansza gotowa do gry)', () => {
        const def = getDaily('2026-07-14');
        const { logic, session } = createDailySession(def);
        expect(logic.cols).toBe(def.cols);
        expect(logic.rows).toBe(def.rows);
        expect(session.movesLeft).toBe(def.moveLimit); // budżet gracza gotowy
        expect(session.isGameOver).toBe(false);
    });
});
