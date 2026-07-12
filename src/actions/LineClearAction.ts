import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { BlockRegistry } from '../BlockDef';

export class LineClearAction implements IBlockAction {
    constructor(private direction: 'HORIZONTAL' | 'VERTICAL') {}

    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, _manager: ActionManager): void {
        const cols = board.cols;
        const rows = board.rows;
        const col = originIdx % cols;
        const row = Math.floor(originIdx / cols);

        if (this.direction === 'HORIZONTAL') {
            for (let c = 0; c < cols; c++) {
                this.tryDestroy(c + row * cols, board, targetSet);
            }
        } else {
            for (let r = 0; r < rows; r++) {
                this.tryDestroy(col + r * cols, board, targetSet);
            }
        }
    }

    private tryDestroy(idx: number, board: BoardLogic, targetSet: Set<number>) {
        const cell = board.cells[idx];
        if (cell.typeId !== -1 && !targetSet.has(idx)) {
            const def = BlockRegistry.getById(cell.typeId);
            if (def && !def.isIndestructible) {
                targetSet.add(idx);
                // Tu można dodać Chain Reaction w przyszłości, jeśli chcesz, 
                // by laser też detonował bomby. Na razie proste niszczenie.
            }
        }
    }
}