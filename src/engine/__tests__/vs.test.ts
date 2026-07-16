import { describe, it, expect } from 'vitest';
import { BoardLogic } from '../BoardLogic';
import { type GameConfig } from '../Config';
import { RNG } from '../Random';
import { MoveFinder } from '../ai/MoveFinder';
import { MatchSession, type SessionPlayer, type VsMode } from '../session/MatchSession';
import { CollectGoal, type GoalRule } from '../rules/GoalRule';

function cfg(seed: number): GameConfig {
    return { cols: 7, rows: 9, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'VS_AI', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}
class SimPlayer implements SessionPlayer {
    constructor(public readonly id: number) {}
    update() {}
    onTurnStart() {}
}

interface VsResult { won: boolean; reason: string; ended: boolean; sH: number; sB: number; }

function driveVs(vsMode: VsMode, seed: number, moveLimit: number, buildGoals: () => GoalRule[]): VsResult {
    const logic = new BoardLogic(cfg(seed));
    let won = false, reason = '', ended = false;
    const session = new MatchSession(logic, { onFinished: (r, w) => { reason = r; won = w; ended = true; } });
    session.registerPlayer(new SimPlayer(0)); // człowiek
    session.registerPlayer(new SimPlayer(1)); // bot
    session.bindEvents();
    const rng0 = new RNG(); rng0.setSeed(seed);
    const rng1 = new RNG(); rng1.setSeed(seed + 7);
    session.start({ moveLimit, timeLimit: 0, buildGoals, checksGoals: true, vsMode });

    for (let i = 0; i < 20000 && !ended; i++) {
        // wasIdle: plansza była bezczynna NA POCZĄTKU tej iteracji, więc session.update
        // poniżej obsłużyło settle→endTurn (rotacja gracza). Dopiero wtedy wstrzykujemy ruch —
        // odwzorowanie gry, gdzie update widzi bezczynną klatkę przed inputem gracza.
        const wasIdle = logic.isSettled();
        session.update(60); // dt=1.0/tick — turn-timer nie wygasa natychmiast
        logic.update(60);
        if (ended) break;
        if (wasIdle && logic.isSettled()) {
            const cur = session.getCurrentPlayerId();
            if (cur !== -1 && session.isMyTurn(cur)) {
                const rng = cur === 0 ? rng0 : rng1;
                const mv = MoveFinder.getBestMove(logic, () => rng.next());
                if (mv) session.requestMove(cur, mv.idxA, mv.dirX, mv.dirY);
            }
        }
    }
    return { won, reason, ended, sH: session.getScoreFor(0), sB: session.getScoreFor(1) };
}

describe('Tryb VS (bot) — da się przegrać', () => {
    it('RACE_SCORE kończy się definitywnie, a wynik jest spójny z punktami', () => {
        for (let seed = 1; seed <= 8; seed++) {
            const r = driveVs('RACE_SCORE', seed, 8, () => []);
            expect(r.ended, `seed ${seed}`).toBe(true);         // gra się kończy (nie "wieczna")
            expect(r.won, `seed ${seed} ${r.sH}:${r.sB}`).toBe(r.sH > r.sB); // wygrana ⟺ wyższy wynik
            // ROZDZIELNE pule: bot ma własny budżet, więc realnie gra i punktuje
            // (przy wspólnej puli bywał zagłodzony → 0).
            expect(r.sB, `bot punktuje, seed ${seed}`).toBeGreaterThan(0);
        }
    });

    it('RACE_SCORE: PRZEGRANA jest osiągalna (bot bywa wyżej)', () => {
        const results = Array.from({ length: 12 }, (_, i) => driveVs('RACE_SCORE', i + 1, 8, () => []));
        expect(results.every(r => r.ended)).toBe(true);
        expect(results.some(r => !r.won)).toBe(true); // ⇐ sedno buga: da się przegrać
    });

    it('RACE_GOAL kończy się i bywa przegraną (bot pierwszy do celu)', () => {
        const results = Array.from({ length: 12 }, (_, i) =>
            driveVs('RACE_GOAL', i + 1, 30, () => [new CollectGoal(0, 6)]) // zbierz 6× Food
        );
        expect(results.every(r => r.ended)).toBe(true);
        expect(results.some(r => !r.won)).toBe(true);
    });
});
