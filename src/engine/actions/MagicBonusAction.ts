import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';

export class MagicBonusAction implements IBlockAction {
    execute(_originIdx: number, board: BoardLogic, _targetSet: Set<number>, _manager: ActionManager): void {
        // Logika bonusu
        board.comboTimer += 2.0; 
        console.log("✨ Magic Bonus Applied!");
    }
}