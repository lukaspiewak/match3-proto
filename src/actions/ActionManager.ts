import type { SpecialAction } from '../BlockDef';
import type { IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';

// Importy konkretnych strategii
import { ExplosionAction } from './ExplosionAction';
import { LineClearAction } from './LineClearAction';
import { MagicBonusAction } from './MagicBonusAction';

export class ActionManager {
    private strategies: Map<SpecialAction, IBlockAction> = new Map();

    constructor() {
        this.registerStrategies();
    }

    private registerStrategies() {
        this.strategies.set('EXPLODE_SMALL', new ExplosionAction(1)); // Promień 1 (3x3)
        this.strategies.set('EXPLODE_BIG',   new ExplosionAction(2)); // Promień 2 (5x5)
        
        this.strategies.set('LINE_CLEAR_H',  new LineClearAction('HORIZONTAL'));
        this.strategies.set('LINE_CLEAR_V',  new LineClearAction('VERTICAL'));
        
        this.strategies.set('MAGIC_BONUS',   new MagicBonusAction());
        
        // CREATE_SPECIAL jest obsługiwane specyficznie w BoardLogic (transformacja), 
        // ale możemy dodać pustą strategię, żeby nie rzucało błędem.
        this.strategies.set('CREATE_SPECIAL', { execute: () => {} }); 
        this.strategies.set('NONE', { execute: () => {} });
    }

    public execute(actionType: SpecialAction, originIdx: number, board: BoardLogic, targetSet: Set<number>) {
        const strategy = this.strategies.get(actionType);
        if (strategy) {
            strategy.execute(originIdx, board, targetSet, this);
        } else {
            console.warn(`ActionManager: Unknown action type '${actionType}'`);
        }
    }
}