import type { SpecialAction } from '../BlockDef';
import type { IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';

// Importy strategii
import { ExplosionAction } from './ExplosionAction';
import { LineClearAction } from './LineClearAction';
import { MagicBonusAction } from './MagicBonusAction';
import { CreateBlockAction } from './CreateBlockAction'; // NOWOŚĆ

export class ActionManager {
    private strategies: Map<SpecialAction, IBlockAction> = new Map();

    constructor() {
        this.registerStrategies();
    }

    private registerStrategies() {
        this.strategies.set('EXPLODE_SMALL', new ExplosionAction(1));
        this.strategies.set('EXPLODE_BIG', new ExplosionAction(2));

        this.strategies.set('LINE_CLEAR_H', new LineClearAction('HORIZONTAL'));
        this.strategies.set('LINE_CLEAR_V', new LineClearAction('VERTICAL'));

        this.strategies.set('MAGIC_BONUS', new MagicBonusAction());

        // --- NOWOŚĆ: Rejestracja akcji tworzenia bloków ---
        // Ujednolicamy CREATE_SPECIAL z innymi
        this.strategies.set('CREATE_SPECIAL', new CreateBlockAction([100])); // Gwiazda
        this.strategies.set('CREATE_WALL', new CreateBlockAction([200])); // Kamień
        this.strategies.set('CREATE_ORE', new CreateBlockAction([30, 31])); // Ruda
        this.strategies.set('CREATE_ICE', new CreateBlockAction([300])); // Lód

        this.strategies.set('NONE', { execute: () => { } });
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