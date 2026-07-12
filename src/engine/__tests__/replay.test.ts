import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig } from '../Config';
import { MoveFinder } from '../ai/MoveFinder';
import { Random } from '../Random';
import { ReplayRecorder, playReplay, type Replay } from '../replay/Replay';

function cfg(cols: number, rows: number, seed = 42): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}
const eq = (a: BoardState[], b: BoardState[]) => JSON.stringify(a.map(s => s.cells)) === JSON.stringify(b.map(s => s.cells));

// Nagrywa realistyczny przebieg: MoveFinder wybiera ruchy, recorder je zbiera.
function recordSession(config: GameConfig, maxMoves: number): { replay: Replay; states: BoardState[] } {
    Random.setSeed(1);
    const board = new BoardLogic(config);
    board.initBoard();
    const rec = new ReplayRecorder().attach(board);
    const states: BoardState[] = [board.getState()];
    for (let i = 0; i < maxMoves; i++) {
        const mv = MoveFinder.getBestMove(board);
        if (!mv) break;
        const res = board.trySwap(mv.idxA, mv.dirX, mv.dirY);
        if (res.success) { board.resolveInstant(); states.push(board.getState()); }
    }
    return { replay: rec.build(config), states };
}

describe('Replay — nagrywanie i odtwarzanie', () => {
    it('odtworzenie daje IDENTYCZNY ciąg stanów jak oryginalna sesja', () => {
        const { replay, states } = recordSession(cfg(7, 9, 42), 8);
        expect(replay.moves.length).toBe(states.length - 1);
        expect(replay.moves.length).toBeGreaterThan(0);
        const replayed = playReplay(replay);
        expect(eq(replayed, states)).toBe(true);
    });

    it('playReplay jest deterministyczne (dwa odtworzenia identyczne)', () => {
        const { replay } = recordSession(cfg(7, 9, 7), 6);
        expect(eq(playReplay(replay), playReplay(replay))).toBe(true);
    });

    it('odtworzenie jest NIEZALEŻNE od stanu globalnego RNG (AI/hint)', () => {
        const { replay } = recordSession(cfg(7, 9, 99), 6);
        const first = playReplay(replay);
        // „zaburzamy" globalny RNG — nie może wpłynąć na przebieg planszy
        Random.setSeed(123456);
        for (let i = 0; i < 50; i++) Random.next();
        const second = playReplay(replay);
        expect(eq(first, second)).toBe(true);
    });

    it('działa z topologią (layout z dziurą) i zachowuje kształt', () => {
        const config = cfg(5, 5, 11);
        Random.setSeed(1);
        const board = new BoardLogic(config);
        const layout = [
            [-1, -1, -1, -1, -1],
            [-1, -1, -2, -1, -1], // -2 = void
            [-1, -1, -1, -1, -1],
            [-1, -1, -1, -1, -1],
            [-1, -1, -1, -1, -1],
        ];
        board.initBoard(layout);
        const rec = new ReplayRecorder().attach(board);
        const states: BoardState[] = [board.getState()];
        for (let i = 0; i < 5; i++) {
            const mv = MoveFinder.getBestMove(board);
            if (!mv) break;
            if (board.trySwap(mv.idxA, mv.dirX, mv.dirY).success) { board.resolveInstant(); states.push(board.getState()); }
        }
        const replay = rec.build(config, { layout });
        const replayed = playReplay(replay);
        expect(eq(replayed, states)).toBe(true);
        // dziura pozostaje dziurą przez cały replay
        expect(replayed.every(s => s.cells[7].typeId === -2)).toBe(true);
    });
});
