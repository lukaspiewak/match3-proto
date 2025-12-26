import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { COLS, ROWS, CellState } from '../Config';
import { BlockRegistry, SPECIAL_BLOCK_ID } from '../BlockDef';

export class ExplosionAction implements IBlockAction {
    constructor(private radius: number) {}

    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, manager: ActionManager): void {
        const col = originIdx % COLS;
        const row = Math.floor(originIdx / COLS);

        // Pętla po obszarze wybuchu
        for (let dy = -this.radius; dy <= this.radius; dy++) {
            for (let dx = -this.radius; dx <= this.radius; dx++) {
                const nx = col + dx;
                const ny = row + dy;

                if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                    const nIdx = nx + ny * COLS;
                    const cell = board.cells[nIdx];

                    // Warunki walidacji celu
                    if (cell.typeId !== -1 && cell.state !== CellState.FALLING && !targetSet.has(nIdx)) {
                        
                        // Sprawdzenie niezniszczalności
                        const targetDef = BlockRegistry.getById(cell.typeId);
                        if (targetDef && targetDef.isIndestructible) continue;

                        // Dodanie do zniszczenia
                        targetSet.add(nIdx);

                        // --- REAKCJA ŁAŃCUCHOWA (Chain Reaction) ---
                        if (targetDef) {
                            // Jeśli ofiara to blok specjalny LUB ma onMatch3 (Death Rattle)
                            if (cell.typeId === SPECIAL_BLOCK_ID || targetDef.triggers.onMatch3 !== 'NONE') {
                                const reactionAction = (cell.typeId === SPECIAL_BLOCK_ID) 
                                    ? 'EXPLODE_BIG' 
                                    : targetDef.triggers.onMatch3;
                                    
                                if (reactionAction !== 'NONE') {
                                    // Rekurencyjne wywołanie innej akcji
                                    manager.execute(reactionAction, nIdx, board, targetSet);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}