import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { COLS, ROWS } from '../Config';
import { BlockRegistry } from '../BlockDef';

export class LineClearAction implements IBlockAction {
    constructor(private direction: 'HORIZONTAL' | 'VERTICAL') {}

    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, _manager: ActionManager): void {
        const col = originIdx % COLS;
        const row = Math.floor(originIdx / COLS);

        if (this.direction === 'HORIZONTAL') {
            for (let c = 0; c < COLS; c++) {
                this.tryDestroy(c + row * COLS, board, targetSet);
            }
        } else {
            for (let r = 0; r < ROWS; r++) {
                this.tryDestroy(col + r * COLS, board, targetSet);
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