import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig, type GravityDir, CellState, EMPTY } from '../Config';

function cfg(cols: number, rows: number, gravityDir: GravityDir, seed = 5): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir, gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}
const eq = (a: BoardState, b: BoardState) => JSON.stringify(a.cells) === JSON.stringify(b.cells);

// Czy pozycja (targetX,targetY) leży na krawędzi docelowej danego kierunku.
function onTargetEdge(dir: GravityDir, x: number, y: number, cols: number, rows: number): boolean {
    return (dir === 'DOWN' && y === rows - 1) || (dir === 'UP' && y === 0)
        || (dir === 'RIGHT' && x === cols - 1) || (dir === 'LEFT' && x === 0);
}

describe('Wykrywanie krawędzi — wszystkie kierunki grawitacji', () => {
    it.each<GravityDir>(['DOWN', 'UP', 'LEFT', 'RIGHT'])('reachEdge odpala TYLKO na krawędzi (%s)', (dir) => {
        const b = new BoardLogic(cfg(6, 7, dir));
        // Opróżniamy planszę → bloki muszą wpaść z wlotu i dojechać do krawędzi docelowej.
        for (const c of b.cells) { c.typeId = EMPTY; c.state = CellState.IDLE; }
        let count = 0, wrong = 0;
        b.on('reachEdge', ({ id }: { id: number }) => {
            count++;
            const c = b.cells[id];
            if (!onTargetEdge(dir, c.targetX, c.targetY, b.cols, b.rows)) wrong++;
        });
        b.resolveInstant();
        expect(count).toBeGreaterThan(0);   // coś dojechało do krawędzi
        expect(wrong).toBe(0);              // każde zdarzenie było na właściwej krawędzi
    });
});

describe('Zmiana grawitacji w locie', () => {
    it('changeGravity aktualizuje kierunek i snapuje komórki do spoczynku', () => {
        const b = new BoardLogic(cfg(6, 7, 'DOWN'));
        b.resolveInstant();
        b.changeGravity('RIGHT');
        expect(b.gravityDir).toBe('RIGHT');
        // Po snapie nic nie jest w ruchu.
        expect(b.cells.every(c => c.state === CellState.IDLE)).toBe(true);
    });

    it('po zmianie grawitacji plansza ponownie się stabilizuje (pełna, bez dopasowań)', () => {
        const b = new BoardLogic(cfg(6, 7, 'DOWN'));
        b.resolveInstant();
        b.changeGravity('RIGHT');
        b.resolveInstant();
        expect(b.isSettled()).toBe(true);
        expect(b.hasAnyMatch()).toBe(false);
        expect(b.getState().cells.every(c => c.typeId >= 0)).toBe(true); // dolane z nowego wlotu
    });

    it('zmiana grawitacji jest deterministyczna', () => {
        const run = () => {
            const b = new BoardLogic(cfg(6, 7, 'DOWN', 33));
            b.resolveInstant();
            b.changeGravity('LEFT');
            b.resolveInstant();
            return b.getState();
        };
        expect(eq(run(), run())).toBe(true);
    });

    it('getter gravityDir odzwierciedla fizykę, nie statyczny config', () => {
        const b = new BoardLogic(cfg(6, 7, 'DOWN'));
        expect(b.gravityDir).toBe('DOWN');
        b.changeGravity('UP');
        expect(b.gravityDir).toBe('UP');
        expect(b.config.gravityDir).toBe('DOWN'); // config pozostaje wartością startową
    });
});
