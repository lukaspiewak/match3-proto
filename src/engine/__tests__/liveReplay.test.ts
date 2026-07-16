import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig } from '../Config';
import { MoveFinder } from '../ai/MoveFinder';
import { Random } from '../Random';
import { ReplayRecorder, type ReplayMove } from '../replay/Replay';
import { GameManager } from '../../GameManager';
import { type LevelConfig } from '../../LevelDef';

function cfg(cols: number, rows: number, seed = 42): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}
const eqCells = (a: BoardState, b: BoardState) => JSON.stringify(a.cells) === JSON.stringify(b.cells);

const LAYOUT = Array.from({ length: 9 }, () => Array(7).fill(-1));
const LEVEL: LevelConfig = {
    id: 'replay-test', name: 'Replay Test', mode: 'STANDARD',
    layout: LAYOUT, moveLimit: 0, timeLimit: 0,
    availableBlockIds: [0, 1, 2, 3, 4],
    goals: [{ type: 'SCORE', amount: 9_999_999 }], // nigdy niespełniony → gra się nie kończy
};

// Nagrywa sekwencję ruchów (MoveFinder) na czystej planszy o danym ziarnie.
function recordMoves(seed: number, count: number): ReplayMove[] {
    Random.setSeed(1);
    const b = new BoardLogic(cfg(7, 9, seed));
    b.initBoard(LAYOUT, LEVEL.availableBlockIds);
    const rec = new ReplayRecorder().attach(b);
    for (let i = 0; i < count; i++) {
        const mv = MoveFinder.getBestMove(b);
        if (!mv) break;
        if (b.trySwap(mv.idxA, mv.dirX, mv.dirY).success) b.resolveInstant();
    }
    return rec.moves;
}

// Odtwarza ruchy przez żywy GameManager (jak w grze) i zwraca końcowy stan planszy.
function drive(seed: number, moves: ReplayMove[]): BoardState {
    const logic = new BoardLogic(cfg(7, 9, seed));
    const gm = new GameManager(logic);
    gm.startReplay(LEVEL, moves);
    for (let i = 0; i < 3000 && (gm.isReplaying || !logic.isSettled()); i++) {
        gm.update(1000);
        logic.update(1000);
    }
    return logic.getState();
}

describe('Żywe odtwarzanie (GameManager.startReplay)', () => {
    const moves = recordMoves(42, 8);

    it('nagranie zawiera ruchy', () => {
        expect(moves.length).toBeGreaterThan(0);
    });

    it('odtwarzanie jest deterministyczne (dwa przebiegi identyczne)', () => {
        expect(eqCells(drive(42, moves), drive(42, moves))).toBe(true);
    });

    it('odtwarzanie faktycznie zmienia planszę względem startu', () => {
        const initial = (() => { const b = new BoardLogic(cfg(7, 9, 42)); b.initBoard(LAYOUT, LEVEL.availableBlockIds); return b.getState(); })();
        expect(eqCells(drive(42, moves), initial)).toBe(false);
    });

    it('input gracza jest zablokowany w trakcie odtwarzania', () => {
        const logic = new BoardLogic(cfg(7, 9, 42));
        const gm = new GameManager(logic);
        gm.startReplay(LEVEL, moves);
        expect(gm.isReplaying).toBe(true);
        expect(gm.isMyTurn(0)).toBe(false);
    });

    it('po wyczerpaniu ruchów odtwarzanie się kończy', () => {
        const logic = new BoardLogic(cfg(7, 9, 42));
        const gm = new GameManager(logic);
        let finished = false;
        gm.onReplayFinished = () => { finished = true; };
        gm.startReplay(LEVEL, moves);
        for (let i = 0; i < 3000 && gm.isReplaying; i++) { gm.update(1000); logic.update(1000); }
        expect(gm.isReplaying).toBe(false);
        expect(finished).toBe(true);
    });
});
