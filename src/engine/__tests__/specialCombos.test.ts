import { describe, it, expect } from 'vitest';
import { BoardLogic } from '../BoardLogic';
import { type GameConfig, VOID, CellState } from '../Config';
import { resolveSpecialCombo, DEFAULT_COMBOS } from '../match/SpecialCombos';
import { BlockRegistry } from '../BlockDef';

function cfg(cols: number, rows: number): GameConfig {
    return { cols, rows, blockTypes: 5, gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME', limitMode: 'MOVES', limitValue: 20, seed: 1 };
}
// Ustawia stan planszy bez wywoływania loadState (zachowuje typeId specjalnych >= 100).
function setBoard(b: BoardLogic, types: number[]) {
    for (let i = 0; i < types.length; i++) {
        const c = b.cells[i];
        c.typeId = types[i]; c.hp = 1; c.maxHp = 1; c.state = CellState.IDLE;
        c.x = i % b.cols; c.y = Math.floor(i / b.cols); c.targetX = c.x; c.targetY = c.y; c.velocity = 0; c.timer = 0;
    }
}

describe('SpecialCombos — konfigurowalna tablica', () => {
    it('para jest nieuporządkowana', () => {
        expect(resolveSpecialCombo(100, 101)).toBe(resolveSpecialCombo(101, 100));
    });
    it('domyślne wpisy', () => {
        expect(resolveSpecialCombo(100, 100)).toBe('EXPLODE_BIG');
        expect(resolveSpecialCombo(100, 101)).toBe('CLEAR_COLOR');
        expect(resolveSpecialCombo(101, 101)).toBe('CLEAR_COLOR');
    });
    it('brak wpisu → null', () => {
        expect(resolveSpecialCombo(100, 999)).toBeNull();
    });
    it('można podać własną tablicę', () => {
        expect(resolveSpecialCombo(100, 100, { '100+100': 'MAGIC_BONUS' })).toBe('MAGIC_BONUS');
    });
    it('bloki specjalne są rozpoznawane, zwykłe nie', () => {
        expect(BlockRegistry.getById(100).isSpecial()).toBe(true); // TNT
        expect(BlockRegistry.getById(101).isSpecial()).toBe(true); // Color Bomb
        expect(BlockRegistry.getById(0).isSpecial()).toBe(false);  // Food
    });
});

describe('Aktywacja/łączenie specjalnych przez swap', () => {
    it('specjalny + zwykły: swap jest legalny bez dopasowania koloru', () => {
        const b = new BoardLogic(cfg(5, 5));
        setBoard(b, [
            100, 0, 1, 2, 3,   // TNT w rogu (idx0)
            1, 2, 0, 1, 2,
            2, 0, 1, 2, 0,
            0, 1, 2, 0, 1,
            1, 2, 0, 1, 2,
        ]);
        const res = b.trySwap(0, 1, 0); // zamiana TNT(0) z sąsiadem po prawej — brak matcha kolorów
        expect(res.success).toBe(true); // ale specjalny → legalne
        // TNT eksploduje (obszar wokół sąsiada) — komórki oznaczone jako EXPLODING/zniszczone
        b.resolveInstant();
        expect(b.isSettled()).toBe(true);
        expect(b.hasAnyMatch()).toBe(false);
    });

    it('Color Bomb + zwykły: czyści kolor sąsiada (CLEAR_COLOR w miejscu zwykłego)', () => {
        const b = new BoardLogic(cfg(5, 1));
        // [ColorBomb, 2, 2, 3, 2] — swap CB z sąsiadem typu 2 → wszystkie "2" znikają
        setBoard(b, [101, 2, 2, 3, 2]);
        b.trySwap(0, 1, 0); // CB(idx0) ↔ typ2(idx1)
        // Po detonacji: komórki typu 2 i sam ColorBomb są EXPLODING (hp 0)
        const exploding = b.cells.filter(c => c.state === CellState.EXPLODING);
        const types = exploding.map(c => c.typeId).sort((a, b) => a - b);
        // powinny wybuchnąć: 3x typ2 + ColorBomb(101)
        expect(types).toEqual([2, 2, 2, 101]);
        // typ 3 (idx3) NIE wybucha
        expect(b.cells[3].state).not.toBe(CellState.EXPLODING);
    });

    it('TNT + Color Bomb: combo = CLEAR_COLOR (z tablicy)', () => {
        expect(DEFAULT_COMBOS['100+101']).toBe('CLEAR_COLOR');
        const b = new BoardLogic(cfg(4, 1));
        setBoard(b, [100, 101, 2, 2]);
        // combo CLEAR_COLOR uruchamiane w miejscu obu specjalnych; kolor pod origin to
        // typy specjalne (100/101) — sprawdzamy że swap jest legalny i detonuje co najmniej specjalne
        const res = b.trySwap(0, 1, 0);
        expect(res.success).toBe(true);
        expect(b.cells[0].state).toBe(CellState.EXPLODING);
        expect(b.cells[1].state).toBe(CellState.EXPLODING);
    });

    it('zwykły + zwykły bez matcha: swap nieudany (bez zmian)', () => {
        const b = new BoardLogic(cfg(5, 1));
        setBoard(b, [0, 1, 2, 3, 4]);
        const res = b.trySwap(0, 1, 0);
        expect(res.success).toBe(false);
    });

    it('void nie jest niszczony przez wybuch specjalnego', () => {
        const b = new BoardLogic(cfg(5, 1));
        setBoard(b, [100, 0, VOID, 0, 0]);
        b.trySwap(0, 1, 0); // TNT eksploduje wokół idx1
        expect(b.cells[2].typeId).toBe(VOID); // dziura nienaruszona
    });
});
