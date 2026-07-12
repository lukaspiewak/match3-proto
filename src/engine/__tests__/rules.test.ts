import { describe, it, expect } from 'vitest';
import { CollectGoal, ScoreGoal } from '../rules/GoalRule';

describe('GoalRule — CollectGoal', () => {
    it('liczy tylko trafiony typ i spełnia się po osiągnięciu progu', () => {
        const g = new CollectGoal(3, 2);
        g.onBlockDestroyed(1, 10);
        expect(g.isMet()).toBe(false);
        expect(g.progress().current).toBe(0);
        g.onBlockDestroyed(3, 20);
        g.onBlockDestroyed(3, 30);
        expect(g.isMet()).toBe(true);
        expect(g.progress()).toMatchObject({ kind: 'COLLECT', targetId: 3, current: 2, target: 2, met: true });
    });

    it('reset zeruje postęp', () => {
        const g = new CollectGoal(0, 1);
        g.onBlockDestroyed(0, 0);
        expect(g.isMet()).toBe(true);
        g.reset();
        expect(g.isMet()).toBe(false);
    });
});

describe('GoalRule — ScoreGoal', () => {
    it('śledzi wynik i spełnia się przy progu', () => {
        const g = new ScoreGoal(1000);
        g.onBlockDestroyed(0, 500);
        expect(g.isMet()).toBe(false);
        g.onBlockDestroyed(0, 1000);
        expect(g.isMet()).toBe(true);
        expect(g.progress().current).toBe(1000);
    });
});
