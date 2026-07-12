/**
 * Publiczne API silnika match-3.
 *
 * Silnik jest generyczny i nie ma żadnej wiedzy o konkretnej grze
 * (ekonomii, mieście, budynkach). Konfiguruje się go per-instancja przez
 * GameConfig, dzięki czemu można na nim budować różne warianty gier i łamigłówek.
 *
 * Warstwa gry importuje TYLKO stąd: `import { BoardLogic, ... } from '../engine'`.
 */

// Konfiguracja i typy planszy
export {
    type GameConfig,
    type GameMode, type LimitMode, type ComboMode, type GravityDir,
    type Cell,
    CellState,
    AppConfig, VisualConfig,
    TILE_SIZE, GAP, COLS, ROWS,
    TURN_TIME_LIMIT, COMBO_BONUS_SECONDS,
    PLAYER_ID_NONE, PLAYER_ID_1, PLAYER_ID_2,
    CurrentTheme,
} from './Config';

// Rdzeń logiki
export { BoardLogic, type MoveResult } from './BoardLogic';

// Definicje bloków (rejestr sterowany danymi)
export { BlockRegistry, BlockDefinition, type SpecialAction, type BlockTriggers } from './BlockDef';

// Deterministyczny RNG (potrzebny do powtarzalnych plansz / walidacji łamigłówek)
export { Random } from './Random';

// AI: wyszukiwarka najlepszego ruchu (generyczna, headless)
export { MoveFinder, type BestMove } from './ai/MoveFinder';

// System akcji specjalnych (Strategy)
export { ActionManager } from './actions/ActionManager';
export { type IBlockAction } from './actions/IBlockAction';

// Reguły / cele poziomu (pluginowalne)
export { type GoalRule, type GoalProgress, CollectGoal, ScoreGoal } from './rules/GoalRule';
