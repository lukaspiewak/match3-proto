import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';

export interface IBlockAction {
    /**
     * Wykonuje akcję specjalną.
     * @param originIdx Indeks klocka, który wywołał akcję (źródło)
     * @param board Referencja do logiki planszy (dostęp do cells, configu)
     * @param targetSet Zbiór indeksów do zniszczenia (akcja dopisuje tu swoje cele)
     * @param manager Referencja do managera akcji (dla rekurencji/chain reactions)
     */
    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, manager: ActionManager): void;
}