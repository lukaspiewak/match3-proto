import { describe, it, expect } from 'vitest';
import { generateSolvableBoard, validateBoard, ensureHasMove } from '../puzzle/PuzzleTools';
import { BoardLogic } from '../BoardLogic';
import { type GameConfig } from '../Config';

function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}

describe('PuzzleTools — generator z gwarantowanym rozwiązaniem', () => {
    it('wygenerowana plansza jest grywalna (settled, bez dopasowań, z ruchem)', () => {
        for (let seed = 1; seed <= 25; seed++) {
            const board = generateSolvableBoard(cfg(7, 9, seed));
            const v = validateBoard(board);
            expect(v.playable, `seed ${seed}`).toBe(true);
            expect(v.hasMove).toBe(true);
            expect(v.matchesPresent).toBe(false);
        }
    });

    it('generator jest deterministyczny dla tego samego ziarna', () => {
        const a = generateSolvableBoard(cfg(7, 9, 123)).getState();
        const b = generateSolvableBoard(cfg(7, 9, 123)).getState();
        expect(a.cells).toEqual(b.cells);
    });

    it('działa dla nietypowych rozmiarów planszy', () => {
        for (const [c, r] of [[5, 5], [6, 10], [9, 12]] as const) {
            const board = generateSolvableBoard(cfg(c, r, 4));
            expect(validateBoard(board).playable).toBe(true);
        }
    });
});

describe('PuzzleTools — ensureHasMove naprawia deadlock', () => {
    it('po ensureHasMove istnieje legalny ruch', () => {
        const board = new BoardLogic(cfg(7, 9, 8));
        // sztuczny, silnie jednorodny układ może być deadlockiem; wymuszamy naprawę
        expect(ensureHasMove(board)).toBe(true);
        expect(board.findHint()).not.toBeNull();
    });
});
