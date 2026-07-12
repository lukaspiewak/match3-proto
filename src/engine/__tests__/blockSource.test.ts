import { describe, it, expect } from 'vitest';
import { SeededColumnSource } from '../spawn/BlockSource';
import { BoardLogic } from '../BoardLogic';
import { type GameConfig, EMPTY, CellState } from '../Config';

const allowed = [0, 1, 2, 3, 4];
function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}

describe('SeededColumnSource — kontrakt peek/next', () => {
    it('peek nie konsumuje, a next zwraca dokładnie to co peek', () => {
        const s = new SeededColumnSource(123, allowed);
        const preview = s.peek(0, 3);
        expect(preview).toHaveLength(3);
        expect(s.peek(0, 3)).toEqual(preview);          // powtórny peek stabilny
        expect([s.next(0), s.next(0), s.next(0)]).toEqual(preview); // next == peek, w kolejności
        // po konsumpcji podgląd przesuwa się dalej
        expect(s.peek(0, 1)[0]).not.toBeUndefined();
    });

    it('tory są niezależne — konsumpcja jednego nie rusza podglądu drugiego', () => {
        const s = new SeededColumnSource(123, allowed);
        const col0 = s.peek(0, 3);
        s.next(1); s.next(1); s.next(1); // konsumujemy tor 1
        expect(s.peek(0, 3)).toEqual(col0); // tor 0 nietknięty
    });

    it('różne ziarna → różne sekwencje (zwykle)', () => {
        const a = new SeededColumnSource(1, allowed).peek(0, 5);
        const b = new SeededColumnSource(2, allowed).peek(0, 5);
        expect(a).not.toEqual(b);
    });

    it('reset zaczyna sekwencję od nowa', () => {
        const s = new SeededColumnSource(9, allowed);
        const first = s.peek(0, 3);
        s.next(0);
        s.reset();
        expect(s.peek(0, 3)).toEqual(first);
    });
});

describe('Podgląd wpięty w BoardLogic', () => {
    it('getColumnPreview jest deterministyczny dla tego samego ziarna', () => {
        const a = new BoardLogic(cfg(7, 9, 42)).getColumnPreview(2, 3);
        const b = new BoardLogic(cfg(7, 9, 42)).getColumnPreview(2, 3);
        expect(a).toEqual(b);
        expect(a).toHaveLength(3);
    });

    it('podgląd = bloki, które FAKTYCZNIE wpadną (kolejność wejścia)', () => {
        // Kolumna 1x2 nie może utworzyć dopasowania (brak trójki) — czysty test spawnu.
        const b = new BoardLogic(cfg(1, 2, 77));
        const preview = b.getColumnPreview(0, 2); // [a, b]
        // Opróżniamy kolumnę i rozwiązujemy — spawn konsumuje kolejkę toru 0.
        b.cells[0].typeId = EMPTY; b.cells[0].state = CellState.IDLE;
        b.cells[1].typeId = EMPTY; b.cells[1].state = CellState.IDLE;
        b.resolveInstant();
        // Pierwszy z kolejki wchodzi najgłębiej (dół), drugi nad nim.
        expect(b.cells[1].typeId).toBe(preview[0]); // dół = pierwszy wpadający
        expect(b.cells[0].typeId).toBe(preview[1]); // góra = drugi
    });

    it('domyślnie wyłączony brak crashu (getColumnPreview zawsze bezpieczne)', () => {
        const b = new BoardLogic(cfg(5, 5, 1));
        expect(() => b.getColumnPreview(0, 0)).not.toThrow();
        expect(b.getColumnPreview(0, 0)).toEqual([]);
    });
});
