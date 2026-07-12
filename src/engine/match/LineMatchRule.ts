import { CellState } from '../Config';
import { BlockRegistry } from '../BlockDef';
import { type MatchRule, type MatchBoard, type MatchGroup, floodFill, classifyShape } from './MatchRule';

/**
 * Domyślna mechanika match-3: dopasowania to poziome/pionowe linie >= minLen
 * tego samego, matchowalnego typu. Sąsiadujące linie tego samego koloru
 * (kształty L/T/+) są scalane w jedną grupę (flood-fill) — zachowanie 1:1
 * z pierwotnym MatchEngine.
 */
export class LineMatchRule implements MatchRule {
    readonly id = 'line';
    constructor(private readonly minLen: number = 3) {}

    private isMatchable(board: MatchBoard, idx: number): boolean {
        const cell = board.cells[idx];
        if (cell.typeId === -1 || cell.state !== CellState.IDLE) return false;
        const def = BlockRegistry.getById(cell.typeId);
        return !!def && def.isMatchable;
    }

    findMatches(board: MatchBoard): MatchGroup[] {
        const { cols, rows, cells } = board;
        const initial = new Set<number>();

        // Skan poziomy
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - (this.minLen - 1); c++) {
                const idx = c + r * cols;
                if (!this.isMatchable(board, idx)) continue;
                const type = cells[idx].typeId;
                let len = 1;
                while (c + len < cols && cells[c + len + r * cols].typeId === type && cells[c + len + r * cols].state === CellState.IDLE) len++;
                if (len >= this.minLen) {
                    for (let k = 0; k < len; k++) initial.add((c + k) + r * cols);
                    c += len - 1;
                }
            }
        }
        // Skan pionowy
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows - (this.minLen - 1); r++) {
                const idx = c + r * cols;
                if (!this.isMatchable(board, idx)) continue;
                const type = cells[idx].typeId;
                let len = 1;
                while (r + len < rows && cells[c + (r + len) * cols].typeId === type && cells[c + (r + len) * cols].state === CellState.IDLE) len++;
                if (len >= this.minLen) {
                    for (let k = 0; k < len; k++) initial.add(c + (r + k) * cols);
                    r += len - 1;
                }
            }
        }

        // Scalanie w spójne grupy (flood-fill po zbiorze dopasowanych)
        const visited = new Set<number>();
        const groups: MatchGroup[] = [];
        for (const idx of initial) {
            if (visited.has(idx)) continue;
            const cellsInGroup = floodFill(board, idx, (n) => initial.has(n));
            for (const g of cellsInGroup) visited.add(g);
            groups.push({
                typeId: cells[idx].typeId,
                cells: cellsInGroup,
                size: cellsInGroup.length,
                shape: classifyShape(cellsInGroup, cols),
            });
        }
        return groups;
    }

    hasMatchAt(board: MatchBoard, idx: number): boolean {
        const { cols, rows, cells } = board;
        const cell = cells[idx];
        const type = cell.typeId;
        if (type === -1) return false;
        const def = BlockRegistry.getById(type);
        if (!def || !def.isMatchable) return false;

        const col = idx % cols; const row = Math.floor(idx / cols);
        let countH = 1, i = 1;
        while (col - i >= 0 && cells[idx - i].typeId === type && cells[idx - i].state === CellState.IDLE) { countH++; i++; }
        i = 1;
        while (col + i < cols && cells[idx + i].typeId === type && cells[idx + i].state === CellState.IDLE) { countH++; i++; }
        if (countH >= this.minLen) return true;

        let countV = 1; i = 1;
        while (row - i >= 0 && cells[idx - i * cols].typeId === type && cells[idx - i * cols].state === CellState.IDLE) { countV++; i++; }
        i = 1;
        while (row + i < rows && cells[idx + i * cols].typeId === type && cells[idx + i * cols].state === CellState.IDLE) { countV++; i++; }
        if (countV >= this.minLen) return true;

        return false;
    }
}
