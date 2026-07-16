import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig, EMPTY, CellState } from '../Config';
import { DeliverGoal } from '../rules/GoalRule';
import { GameManager } from '../../GameManager';
import { PlayerController } from '../../PlayerController';
import { type LevelConfig } from '../../LevelDef';

const PAYLOAD = 110;
function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}
function state(cols: number, rows: number, types: number[]): BoardState {
    return { cols, rows, cells: types.map(t => ({ typeId: t, hp: 1, maxHp: 1, countdown: 0 })) };
}

describe('Dostarczanie do krawędzi', () => {
    it('payload dociera do krawędzi → zdarzenie "delivered" i blok znika', () => {
        const b = new BoardLogic(cfg(1, 4));
        b.loadState(state(1, 4, [PAYLOAD, EMPTY, EMPTY, EMPTY])); // payload na górze, reszta pusto
        let delivered = 0;
        b.on('delivered', (d: { typeId: number }) => { if (d.typeId === PAYLOAD) delivered++; });
        b.resolveInstant();
        expect(delivered).toBe(1);
        // Payload zniknął (dostarczony), a kolumna dolała się zwykłymi blokami.
        expect(b.getState().cells.some(c => c.typeId === PAYLOAD)).toBe(false);
    });

    it('reachEdge też odpala dla payloadu', () => {
        const b = new BoardLogic(cfg(1, 3));
        b.loadState(state(1, 3, [PAYLOAD, EMPTY, EMPTY]));
        let edge = 0;
        b.on('reachEdge', () => edge++);
        b.resolveInstant();
        expect(edge).toBeGreaterThan(0);
    });
});

describe('DeliverGoal', () => {
    it('liczy tylko dostarczenia właściwego typu', () => {
        const g = new DeliverGoal(PAYLOAD, 2);
        g.onDelivered(5);
        expect(g.isMet()).toBe(false);
        g.onDelivered(PAYLOAD);
        g.onDelivered(PAYLOAD);
        expect(g.isMet()).toBe(true);
        expect(g.progress()).toMatchObject({ kind: 'DELIVER', current: 2, target: 2, met: true });
    });
});

class SimPlayer extends PlayerController {
    public update(): void {}
    public onTurnStart(): void {}
}

describe('GameManager — routing zdarzenia delivered do celu', () => {
    it('cel DELIVER rośnie po zdarzeniu delivered i domyka wygraną', () => {
        const logic = new BoardLogic(cfg(5, 5));
        const gm = new GameManager(logic);
        let won = false;
        gm.onGameFinished = (_r, w) => { won = w; };
        gm.bindEvents();
        gm.registerPlayer(new SimPlayer(0, gm, logic));
        const level: LevelConfig = {
            id: 'deliver', name: 'Deliver', mode: 'STANDARD',
            layout: Array.from({ length: 5 }, () => Array(5).fill(-1)),
            moveLimit: 0, timeLimit: 0, availableBlockIds: [0, 1, 2, 3],
            goals: [{ type: 'DELIVER', targetId: PAYLOAD, amount: 2 }],
        };
        gm.startLevel(level);
        expect(gm.getGoalProgress(0)).toBe(0);
        logic.emit('delivered', { id: 0, typeId: PAYLOAD });
        expect(gm.getGoalProgress(0)).toBe(1);
        logic.emit('delivered', { id: 1, typeId: PAYLOAD });
        expect(gm.getGoalProgress(0)).toBe(2);
        expect(won).toBe(true); // 2/2 dostarczone → wygrana
    });
});

// sanity: stan po dostarczeniu jest spójny (brak zawieszonych stanów)
describe('Dostarczanie — spójność', () => {
    it('po dostarczeniu plansza się stabilizuje', () => {
        const b = new BoardLogic(cfg(3, 4));
        const s = b.getState();
        s.cells[1] = { typeId: PAYLOAD, hp: 1, maxHp: 1, countdown: 0 }; // payload w kolumnie 1, góra
        b.loadState(s);
        b.resolveInstant();
        expect(b.isSettled()).toBe(true);
        expect(b.cells.every(c => c.state === CellState.IDLE)).toBe(true);
    });
});
