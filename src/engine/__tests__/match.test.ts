import { describe, it, expect } from 'vitest';
import { type Cell, CellState } from '../Config';
import { type MatchBoard, classifyShape } from '../match/MatchRule';
import { LineMatchRule } from '../match/LineMatchRule';
import { CollapseMatchRule } from '../match/CollapseMatchRule';

function mkBoard(grid: number[][]): MatchBoard {
    const rows = grid.length, cols = grid[0].length;
    const cells: Cell[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        cells.push({ id: c + r * cols, typeId: grid[r][c], state: CellState.IDLE, x: c, y: r, targetX: c, targetY: r, velocity: 0, timer: 0, hp: 1, maxHp: 1 });
    }
    return { cols, rows, cells };
}
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('LineMatchRule — detekcja', () => {
    const rule = new LineMatchRule();

    it('wykrywa poziomą trójkę jako jedną grupę LINE', () => {
        const b = mkBoard([
            [0, 0, 0, 1, 2],
            [1, 2, 1, 2, 1],
            [2, 1, 2, 1, 2],
        ]);
        const groups = rule.findMatches(b);
        expect(groups).toHaveLength(1);
        expect(groups[0].typeId).toBe(0);
        expect(sorted(groups[0].cells)).toEqual([0, 1, 2]);
        expect(groups[0].shape).toBe('LINE');
    });

    it('scala przecinające się linie tego samego koloru w jedną grupę (L)', () => {
        const b = mkBoard([
            [0, 0, 0],
            [0, 1, 1],
            [0, 2, 2],
        ]);
        const groups = rule.findMatches(b);
        expect(groups).toHaveLength(1);
        expect(groups[0].size).toBe(5);
        expect(groups[0].shape).toBe('L_SHAPE');
    });

    it('klasyfikuje układ plus/T jako T_SHAPE', () => {
        const b = mkBoard([
            [2, 0, 2],
            [0, 0, 0],
            [2, 0, 2],
        ]);
        const groups = rule.findMatches(b);
        expect(groups).toHaveLength(1);
        expect(groups[0].size).toBe(5);
        expect(groups[0].shape).toBe('T_SHAPE');
    });

    it('brak dopasowań → pusta lista', () => {
        const b = mkBoard([
            [0, 1, 0],
            [1, 0, 1],
            [0, 1, 0],
        ]);
        expect(rule.findMatches(b)).toHaveLength(0);
    });

    it('ignoruje bloki niematchowalne (ściana=200)', () => {
        const b = mkBoard([
            [200, 200, 200],
            [1, 2, 1],
            [2, 1, 2],
        ]);
        expect(rule.findMatches(b)).toHaveLength(0);
    });

    it('hasMatchAt wykrywa pozycję w linii', () => {
        const b = mkBoard([
            [0, 0, 0, 1, 2],
            [1, 2, 1, 2, 1],
            [2, 1, 2, 1, 2],
        ]);
        expect(rule.hasMatchAt(b, 1)).toBe(true);   // środek trójki
        expect(rule.hasMatchAt(b, 4)).toBe(false);  // brak
    });
});

describe('classifyShape', () => {
    const C = 5;
    it('LINE pozioma i pionowa', () => {
        expect(classifyShape([0, 1, 2], C)).toBe('LINE');
        expect(classifyShape([0, 5, 10], C)).toBe('LINE');
    });
    it('SQUARE 2x2', () => {
        expect(classifyShape([0, 1, 5, 6], C)).toBe('SQUARE');
    });
    it('T_SHAPE (plus)', () => {
        // (1,0)(0,1)(1,1)(2,1)(1,2) na siatce cols=3
        expect(classifyShape([1, 3, 4, 5, 7], 3)).toBe('T_SHAPE');
    });
    it('L_SHAPE (róg)', () => {
        // (0,0)(1,0)(2,0)(0,1)(0,2) na siatce cols=3
        expect(classifyShape([0, 1, 2, 3, 6], 3)).toBe('L_SHAPE');
    });
});

describe('CollapseMatchRule — dowód elastyczności (blast)', () => {
    const rule = new CollapseMatchRule(2);

    it('nie usuwa nic automatycznie (findMatches puste)', () => {
        expect(rule.findMatches()).toHaveLength(0);
    });

    it('groupAt zwraca spójną grupę tego samego koloru >= minGroup', () => {
        const b = mkBoard([
            [0, 0, 1],
            [0, 1, 1],
            [2, 2, 1],
        ]);
        const g = rule.groupAt(b, 0); // róg 0,0 typu 0
        expect(g).not.toBeNull();
        expect(g!.typeId).toBe(0);
        expect(sorted(g!.cells)).toEqual([0, 1, 3]); // (0,0)(1,0)(0,1)
    });

    it('groupAt zwraca null poniżej minGroup', () => {
        const b = mkBoard([
            [0, 1, 2],
            [1, 2, 0],
            [2, 0, 1],
        ]);
        expect(rule.groupAt(b, 0)).toBeNull(); // pojedynczy blok
        expect(rule.hasMatchAt(b, 0)).toBe(false);
    });

    it('respektuje wyższy próg minGroup', () => {
        const strict = new CollapseMatchRule(4);
        const b = mkBoard([[0, 0, 1], [0, 1, 1], [2, 2, 1]]);
        expect(strict.groupAt(b, 0)).toBeNull(); // grupa 3 < 4
    });
});
