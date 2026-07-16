import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { CellState } from '../Config';
import { BlockRegistry } from '../BlockDef';

/**
 * Color bomb — usuwa z planszy WSZYSTKIE bloki tego samego typu co blok źródłowy.
 * Odpowiednik "color bomb" z gier match-3 (np. dopasowanie prostej linii >=5).
 * Reaguje łańcuchowo na trafione bloki specjalne (jak ExplosionAction).
 */
export class ClearColorAction implements IBlockAction {
    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, manager: ActionManager): void {
        const targetType = board.cells[originIdx].typeId;
        if (targetType === -1) return;

        for (let i = 0; i < board.cells.length; i++) {
            const cell = board.cells[i];
            if (cell.typeId !== targetType) continue;
            if (cell.state === CellState.FALLING) continue;
            if (targetSet.has(i)) continue;

            const def = BlockRegistry.getById(cell.typeId);
            if (def && def.isIndestructible) continue;

            targetSet.add(i);

            // Reakcja łańcuchowa: jeśli usuwany blok ma własny efekt onMatch3 (death rattle).
            if (def && def.triggers.onMatch3 !== 'NONE') {
                manager.execute(def.triggers.onMatch3, i, board, targetSet);
            }
        }
    }
}
