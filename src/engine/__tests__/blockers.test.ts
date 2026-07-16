import { describe, it, expect } from 'vitest';
import { BoardLogic, type BoardState } from '../BoardLogic';
import { type GameConfig, CellState } from '../Config';

function cfg(cols: number, rows: number, seed = 1): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed };
}

// 5x3: pozioma trójka typu 0 w rzędzie 1 (idx 5,6,7); bloker na idx 8 (sąsiad idx7).
function boardWithBlockerAt8(blockerId: number, countdown = 0): BoardState {
    const t = (id: number) => ({ typeId: id, hp: 1, maxHp: 1, countdown: 0 });
    const hp = blockerId === 202 ? 2 : 1;
    const cells = [
        t(1), t(2), t(1), t(2), t(1),                                   // rząd 0: idx 0-4
        t(0), t(0), t(0), { typeId: blockerId, hp, maxHp: hp, countdown }, t(2), // rząd 1: idx 5-9 (bloker=8)
        t(2), t(1), t(2), t(1), t(2),                                   // rząd 2: idx 10-14
    ];
    return { cols: 5, rows: 3, cells };
}

/** Wykonuje dokładnie JEDEN skan dopasowań na ustawionej planszy. */
function oneScan(b: BoardLogic) {
    b.needsMatchCheck = true;
    b.update(1000);
}

describe('Blokery — obrażenia od sąsiedniego matcha', () => {
    it('skrzynia (hp1) niszczona jednym sąsiednim matchem', () => {
        const b = new BoardLogic(cfg(5, 3));
        b.loadState(boardWithBlockerAt8(201));
        oneScan(b);
        expect(b.cells[8].hp).toBeLessThanOrEqual(0);
        expect(b.cells[8].state).toBe(CellState.EXPLODING);
    });

    it('frosting (hp2) wymaga dwóch matchy — po jednym tylko uszkodzony', () => {
        const b = new BoardLogic(cfg(5, 3));
        b.loadState(boardWithBlockerAt8(202));
        oneScan(b);
        expect(b.cells[8].typeId).toBe(202);      // wciąż frosting
        expect(b.cells[8].hp).toBe(1);             // 2 → 1
        expect(b.cells[8].state).toBe(CellState.IDLE);
    });

    it('kłódka odsłania klocek (revealTypeId=0) po zbiciu', () => {
        const b = new BoardLogic(cfg(5, 3));
        b.loadState(boardWithBlockerAt8(203));
        oneScan(b);
        expect(b.cells[8].typeId).toBe(0);         // odsłonięty Food
        expect(b.cells[8].state).toBe(CellState.IDLE);
    });

    it('bomba jest rozbrajana (niszczona) sąsiednim matchem', () => {
        const b = new BoardLogic(cfg(5, 3));
        b.loadState(boardWithBlockerAt8(210, 5));
        oneScan(b);
        expect(b.cells[8].state).toBe(CellState.EXPLODING); // rozbrojona
    });
});

describe('Bomby — licznik ruchów', () => {
    it('tickCountdowns odlicza i zgłasza wygaśnięcie przy 0', () => {
        const b = new BoardLogic(cfg(3, 3));
        const s = b.getState();
        s.cells[4] = { typeId: 210, hp: 1, maxHp: 1, countdown: 3 }; // bomba w środku
        b.loadState(s);
        expect(b.tickCountdowns()).toEqual([]); // 3 → 2
        expect(b.tickCountdowns()).toEqual([]); // 2 → 1
        expect(b.tickCountdowns()).toEqual([4]); // 1 → 0: wybuch
        expect(b.tickCountdowns()).toEqual([]); // już 0, brak dalszych zgłoszeń
    });

    it('plansza bez bomb: tick nic nie zgłasza', () => {
        const b = new BoardLogic(cfg(5, 5, 3));
        expect(b.tickCountdowns()).toEqual([]);
    });

    it('licznik bomby jest serializowany (getState/loadState)', () => {
        const b = new BoardLogic(cfg(3, 3));
        const s = b.getState();
        s.cells[0] = { typeId: 210, hp: 1, maxHp: 1, countdown: 7 };
        b.loadState(s);
        expect(b.getState().cells[0].countdown).toBe(7);
    });
});
