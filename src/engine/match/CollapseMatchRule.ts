import { CellState } from '../Config';
import { BlockRegistry } from '../BlockDef';
import { type MatchRule, type MatchBoard, type MatchGroup, floodFill, classifyShape } from './MatchRule';

/**
 * Mechanika collapse/blast (Toon Blast, Toy Blast): dopasowanie to spójna grupa
 * co najmniej `minGroup` bloków tego samego koloru, usuwana po KLIKNIĘCIU (nie po
 * zamianie). Brak automatycznego usuwania — findMatches() zwraca [], a grupę
 * pobiera się przez groupAt(idx).
 *
 * Ta sama pętla efektów silnika (grawitacja, dolosowania, kaskady) działa bez zmian.
 */
export class CollapseMatchRule implements MatchRule {
    readonly id = 'collapse';
    constructor(private readonly minGroup: number = 2) {}

    private isClearable(board: MatchBoard, idx: number): boolean {
        const cell = board.cells[idx];
        if (cell.typeId === -1 || cell.state !== CellState.IDLE) return false;
        const def = BlockRegistry.getById(cell.typeId);
        return !!def && def.isMatchable;
    }

    /** Collapse nie usuwa nic automatycznie — usuwanie następuje na klik (groupAt). */
    findMatches(): MatchGroup[] {
        return [];
    }

    hasMatchAt(board: MatchBoard, idx: number): boolean {
        return this.groupAt(board, idx) !== null;
    }

    groupAt(board: MatchBoard, idx: number): MatchGroup | null {
        if (!this.isClearable(board, idx)) return null;
        const cells = floodFill(board, idx, (n) => this.isClearable(board, n));
        if (cells.length < this.minGroup) return null;
        return {
            typeId: board.cells[idx].typeId,
            cells,
            size: cells.length,
            shape: classifyShape(cells, board.cols),
        };
    }
}
