import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig } from '../Config';

function cfg(cols: number, rows: number): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed: 1 };
}
function state(cols: number, rows: number, types: number[]): BoardState {
    return { cols, rows, cells: types.map(t => ({ typeId: t, hp: 1, maxHp: 1 })) };
}
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe('CLEAR_COLOR — color bomb', () => {
    // 3x3:  0 1 0 / 1 0 1 / 2 0 2   → typ 0 na indeksach 0,2,4,7 ; typ 2 na 6,8
    const types = [0, 1, 0, 1, 0, 1, 2, 0, 2];

    it('usuwa wszystkie bloki tego samego koloru co źródło', () => {
        const board = new BoardLogic(cfg(3, 3));
        board.loadState(state(3, 3, types));
        const set = new Set<number>();
        board.runAction('CLEAR_COLOR', 0, set); // źródło typu 0
        expect(sorted(set)).toEqual([0, 2, 4, 7]);
    });

    it('działa dla innego koloru źródła', () => {
        const board = new BoardLogic(cfg(3, 3));
        board.loadState(state(3, 3, types));
        const set = new Set<number>();
        board.runAction('CLEAR_COLOR', 6, set); // źródło typu 2
        expect(sorted(set)).toEqual([6, 8]);
    });

    it('nie rusza innych kolorów', () => {
        const board = new BoardLogic(cfg(3, 3));
        board.loadState(state(3, 3, types));
        const set = new Set<number>();
        board.runAction('CLEAR_COLOR', 4, set); // typ 0
        expect([...set].every(i => types[i] === 0)).toBe(true);
    });
});
