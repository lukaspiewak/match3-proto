import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig, CellState } from '../Config';
import { Random } from '../Random';

function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}

function hasAnyMatch(s: BoardState): boolean {
    const { cols, rows, cells } = s;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 2; c++) {
        const t = cells[c + r * cols].typeId;
        if (t !== -1 && t === cells[c + 1 + r * cols].typeId && t === cells[c + 2 + r * cols].typeId) return true;
    }
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows - 2; r++) {
        const t = cells[c + r * cols].typeId;
        if (t !== -1 && t === cells[c + (r + 1) * cols].typeId && t === cells[c + (r + 2) * cols].typeId) return true;
    }
    return false;
}

describe('BoardLogic — wymiary per-instancja', () => {
    it('domyślny rozmiar 7x9 = 63 komórki', () => {
        const b = new BoardLogic();
        expect(b.cols).toBe(7);
        expect(b.rows).toBe(9);
        expect(b.cells.length).toBe(63);
    });

    it.each([[5, 6, 30], [12, 14, 168], [8, 8, 64]])('rozmiar %ix%i = %i komórek', (c, r, n) => {
        expect(new BoardLogic(cfg(c, r)).cells.length).toBe(n);
    });

    it('instancje różnych rozmiarów są niezależne', () => {
        const a = new BoardLogic(cfg(5, 6));
        const b = new BoardLogic(cfg(10, 10));
        expect(a.cells.length).toBe(30);
        expect(b.cells.length).toBe(100);
    });

    it('initBoard nie tworzy początkowych dopasowań', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const b = new BoardLogic(cfg(7, 9, seed));
            expect(hasAnyMatch(b.getState())).toBe(false);
        }
    });
});

describe('BoardLogic — stan logiczny i symulacja headless', () => {
    it('getState zwraca tylko dane logiczne (bez pól wizualnych)', () => {
        const snap = new BoardLogic(cfg(5, 6)).getState();
        expect(snap.cells[0]).toHaveProperty('typeId');
        expect(snap.cells[0]).not.toHaveProperty('x');
        expect(snap.cells[0]).not.toHaveProperty('velocity');
    });

    it('round-trip getState → loadState zachowuje stan', () => {
        const a = new BoardLogic(cfg(5, 6, 3));
        a.resolveInstant();
        const snap = a.getState();
        const b = new BoardLogic(cfg(5, 6, 3));
        b.loadState(snap);
        expect(b.getState().cells).toEqual(snap.cells);
    });

    it('loadState odrzuca niezgodne wymiary', () => {
        const b = new BoardLogic(cfg(5, 6));
        const wrong: BoardState = { cols: 4, rows: 4, cells: [] };
        expect(() => b.loadState(wrong)).toThrow();
    });

    it('resolveInstant zbiega do planszy bez dopasowań i bez pustych', () => {
        const b = new BoardLogic(cfg(6, 7, 5));
        const iters = b.resolveInstant();
        expect(iters).toBeLessThan(1000);
        expect(b.isSettled()).toBe(true);
        expect(b.hasAnyMatch()).toBe(false);
        expect(b.getState().cells.every(c => c.typeId !== -1)).toBe(true);
        expect(b.cells.every(c => c.state === CellState.IDLE)).toBe(true);
    });

    it('symulacja jest deterministyczna dla tego samego ziarna', () => {
        const run = () => {
            Random.setSeed(7);
            const b = new BoardLogic(cfg(6, 7, 7));
            b.resolveInstant();
            return b.getState().cells;
        };
        expect(run()).toEqual(run());
    });
});
