import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig, VOID, EMPTY, CellState } from '../Config';
import { Random } from '../Random';

function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}

describe('Topologia — dziury (VOID) definiują kształt planszy', () => {
    it('layout z VOID tworzy trwałe niegrywalne pola', () => {
        const R = EMPTY, V = VOID;
        const b = new BoardLogic(cfg(3, 3));
        b.initBoard([[R, R, R], [R, V, R], [R, R, R]]);
        expect(b.cells[4].typeId).toBe(VOID);              // środek = dziura
        const voids = b.cells.filter(c => c.typeId === VOID).length;
        expect(voids).toBe(1);
        expect(b.cells.filter(c => c.typeId >= 0).length).toBe(8); // reszta wypełniona
    });

    it('void nie jest matchowalny i nie psuje detekcji', () => {
        Random.setSeed(11);
        const b = new BoardLogic(cfg(5, 5));
        b.initBoard([[VOID, VOID, VOID, VOID, VOID], [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
                     [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
                     [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]]);
        // Górny rząd to 5 voidów (jednakowy typeId) — NIE mogą liczyć się jako dopasowanie.
        expect(b.hasAnyMatch()).toBe(false);
    });
});

describe('Topologia — grawitacja respektuje void', () => {
    it('blok stoi na voidzie i nie przechodzi przez niego; kieszeń pod voidem nie dolewa', () => {
        Random.setSeed(3);
        const b = new BoardLogic(cfg(1, 4, 3));
        b.initBoard(); // spawnery domyślne (cała krawędź)
        // Kolumna (top→bottom): pusto, Water(2), VOID, pusto
        const state: BoardState = { cols: 1, rows: 4, cells: [
            { typeId: EMPTY, hp: 0, maxHp: 0 },
            { typeId: 2, hp: 1, maxHp: 1 },
            { typeId: VOID, hp: 0, maxHp: 0 },
            { typeId: EMPTY, hp: 0, maxHp: 0 },
        ]};
        b.loadState(state);
        b.resolveInstant();

        expect(b.cells[2].typeId).toBe(VOID);      // void nienaruszony
        expect(b.cells[1].typeId).toBe(2);         // blok spoczął na voidzie (nie spadł niżej)
        expect(b.cells[0].typeId).toBeGreaterThanOrEqual(0); // góra dolana ze spawnu
        expect(b.cells[3].typeId).toBe(EMPTY);     // kieszeń pod voidem — brak dostępu, pusto
        expect(b.isSettled()).toBe(true);
    });
});

describe('Topologia — spawnery bramkują dolewanie', () => {
    it('tylko kolumna ze spawnerem się odnawia', () => {
        Random.setSeed(5);
        const b = new BoardLogic(cfg(3, 5, 5));
        b.initBoard(undefined, undefined, [0]); // spawner tylko na (col0,row0) = index 0

        // Opróżniamy kolumnę 0 (ze spawnerem) i kolumnę 1 (bez spawnera).
        for (let r = 0; r < 5; r++) {
            for (const col of [0, 1]) {
                const c = b.cells[col + r * 3];
                c.typeId = EMPTY; c.state = CellState.IDLE;
            }
        }
        b.resolveInstant();

        const col0 = [0, 1, 2, 3, 4].map(r => b.cells[0 + r * 3].typeId);
        const col1 = [0, 1, 2, 3, 4].map(r => b.cells[1 + r * 3].typeId);
        expect(col0.every(t => t >= 0)).toBe(true);       // spawner → pełna
        expect(col1.every(t => t === EMPTY)).toBe(true);  // brak spawnera → pusta
    });

    it('brak zdefiniowanych spawnerów = klasyczne dolewanie na całej krawędzi', () => {
        Random.setSeed(6);
        const b = new BoardLogic(cfg(3, 5, 6));
        b.initBoard(); // brak spawnerów
        for (let i = 0; i < b.cells.length; i++) { b.cells[i].typeId = EMPTY; b.cells[i].state = CellState.IDLE; }
        b.resolveInstant();
        expect(b.getState().cells.every(c => c.typeId >= 0)).toBe(true); // cała plansza dolana
    });
});
