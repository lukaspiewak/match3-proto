import { BoardLogic, type BoardState } from '../BoardLogic';
import type { GameConfig } from '../Config';

/**
 * Replay — deterministyczne odtwarzanie rozgrywki z ziarna + sekwencji ruchów.
 *
 * Dzięki temu, że cała losowość ewolucji planszy pochodzi ze strumieni związanych
 * z config.seed (fill/spawn/efekty), przebieg jest funkcją (config, initBoard, moves).
 * Zastosowania: debug, „obejrzyj rozwiązanie", weryfikacja rekordów, testy regresji.
 */

export interface ReplayMove {
    idxA: number;
    dirX: number;
    dirY: number;
}

export interface Replay {
    version: 1;
    config: GameConfig;
    /** Argumenty initBoard (kształt/dozwolone bloki/spawnery). */
    initBoard?: { layout?: number[][]; availableBlockIds?: number[]; spawners?: number[] };
    moves: ReplayMove[];
}

/**
 * Nagrywarka — podłącz do BoardLogic (board.onMoveApplied), zbiera udane ruchy.
 * `build()` domyka nagranie do serializowalnego obiektu Replay.
 */
export class ReplayRecorder {
    readonly moves: ReplayMove[] = [];

    /** Podłącza się do planszy, przechwytując każdy udany ruch. */
    public attach(board: BoardLogic): this {
        board.onMoveApplied = (m) => this.moves.push({ ...m });
        return this;
    }

    public build(config: GameConfig, initBoard?: Replay['initBoard']): Replay {
        return { version: 1, config, initBoard, moves: [...this.moves] };
    }
}

/**
 * Odtwarza nagranie headless i zwraca stan logiczny planszy po KAŻDYM ruchu
 * (element [0] to stan startowy). W pełni deterministyczne dla danego Replay.
 */
export function playReplay(replay: Replay): BoardState[] {
    const board = new BoardLogic(replay.config);
    board.initBoard(replay.initBoard?.layout, replay.initBoard?.availableBlockIds, replay.initBoard?.spawners);

    const states: BoardState[] = [board.getState()];
    for (const m of replay.moves) {
        const res = board.trySwap(m.idxA, m.dirX, m.dirY);
        if (res.success) board.resolveInstant();
        states.push(board.getState());
    }
    return states;
}
