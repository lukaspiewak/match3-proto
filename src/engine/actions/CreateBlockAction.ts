import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { BlockRegistry } from '../BlockDef';
import { CellState } from '../Config';

export class CreateBlockAction implements IBlockAction {
    constructor(private targetBlockId: number[]) { }

    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, _manager: ActionManager): void {
        const cell = board.cells[originIdx];
        const randomIndex = Math.floor(Math.random() * this.targetBlockId.length);
    
        const def = BlockRegistry.getById(this.targetBlockId[randomIndex]);

        if (!def) {
            console.warn(`CreateBlockAction: Unknown block ID ${this.targetBlockId}`);
            return;
        }

        // Transformacja klocka
        cell.typeId = this.targetBlockId[randomIndex];
        cell.state = CellState.IDLE;
        cell.hp = def.initialHp;
        cell.maxHp = def.initialHp;

        // KLUCZOWE: Usuwamy ten klocek z listy do zniszczenia/uszkodzenia!
        // Dzięki temu przetrwa turę jako nowy blok.
        targetSet.delete(originIdx);

        console.log(`✨ Created ${def.name} at index ${originIdx}`);
    }
}