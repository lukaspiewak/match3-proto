import { type IBlockAction } from './IBlockAction';
import type { BoardLogic } from '../BoardLogic';
import type { ActionManager } from './ActionManager';
import { CellState } from '../Config';
import { BlockRegistry } from '../BlockDef';

export class ExplosionAction implements IBlockAction {
    constructor(private radius: number) {}

    execute(originIdx: number, board: BoardLogic, targetSet: Set<number>, manager: ActionManager): void {
        const cols = board.cols;
        const rows = board.rows;
        const col = originIdx % cols;
        const row = Math.floor(originIdx / cols);

        // Pętla po obszarze wybuchu
        for (let dy = -this.radius; dy <= this.radius; dy++) {
            for (let dx = -this.radius; dx <= this.radius; dx++) {
                const nx = col + dx;
                const ny = row + dy;

                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                    const nIdx = nx + ny * cols;
                    const cell = board.cells[nIdx];

                    // Warunki walidacji celu (typeId >= 0 pomija puste -1 i void -2)
                    if (cell.typeId >= 0 && cell.state !== CellState.FALLING && !targetSet.has(nIdx)) {
                        
                        // Sprawdzenie niezniszczalności
                        const targetDef = BlockRegistry.getById(cell.typeId);
                        if (targetDef && targetDef.isIndestructible) continue;

                        // Dodanie do zniszczenia
                        targetSet.add(nIdx);

                        // --- REAKCJA ŁAŃCUCHOWA (Chain Reaction) ---
                        if (targetDef) {
                            // Jeśli ofiara to blok specjalny LUB ma onMatch3 (Death Rattle)
                            if (cell.typeId === 100 || targetDef.triggers.onMatch3 !== 'NONE') {
                                const reactionAction = (cell.typeId === 100) 
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