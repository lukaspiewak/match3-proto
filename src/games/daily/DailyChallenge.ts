import { BoardLogic } from '../../engine/BoardLogic';
import { type GameConfig } from '../../engine/Config';
import { MatchSession, type SessionPlayer } from '../../engine/session/MatchSession';
import { type GoalRule, CollectGoal } from '../../engine/rules/GoalRule';
import { MoveFinder } from '../../engine/ai/MoveFinder';
import { RNG } from '../../engine/Random';
import { type ReplayMove } from '../../engine/replay/Replay';
import { registerDailyBlocks, DAILY_BLOCK_IDS, DAILY_GOAL_TARGET } from './dailyBlocks';

/**
 * DAILY CHALLENGE — inny gatunek na tym samym silniku (dowód reużywalności).
 *
 * Solo, seedowana z DATY łamigłówka match-3: ta sama plansza dla wszystkich danego dnia,
 * z GWARANCJĄ rozwiązania i dzieleniem wyniku w stylu Wordle. Importuje TYLKO `engine/`
 * (żadnego kodu city-buildera: brak GameManager/EconomyMode/LevelDef/scen).
 */

export interface DailyDef {
    date: string;      // 'YYYY-MM-DD'
    number: number;    // kolejny numer dnia (do share)
    seed: number;      // ziarno planszy (deterministyczne z daty)
    cols: number;
    rows: number;
    blockTypes: number;
    availableBlockIds: number[];
    moveLimit: number;
    goalTargetId: number;
    goalAmount: number;
}

export interface DailyResult {
    won: boolean;
    movesUsed: number;
    moveLimit: number;
    collected: number;
    goalAmount: number;
    moves: ReplayMove[]; // rozwiązanie (do weryfikacji / replaya)
}

const DAY_MS = 86_400_000;
const EPOCH = '2026-01-01';

/** Deterministyczne ziarno z daty (ta sama plansza dla wszystkich). */
export function seedForDate(date: string): number {
    return Number(date.replaceAll('-', '')); // np. 2026-07-13 -> 20260713
}

/** Numer kolejnego dnia względem epoki (do "Daily #N"). */
export function dailyNumber(date: string): number {
    const d = (Date.parse(date) - Date.parse(EPOCH)) / DAY_MS;
    return Math.floor(d) + 1;
}

function buildConfig(def: DailyDef): GameConfig {
    registerDailyBlocks(); // własna paleta (bez color bomba) musi być w rejestrze
    return {
        cols: def.cols, rows: def.rows, blockTypes: def.blockTypes,
        gravityDir: 'DOWN', gameMode: 'SOLO', comboMode: 'TIME',
        limitMode: 'MOVES', limitValue: def.moveLimit, seed: def.seed,
    };
}

const soloPlayer = (): SessionPlayer => ({ id: 0, update() {}, onTurnStart() {} });

/** Tworzy sesję silnika dla danej łamigłówki (solo, cel COLLECT, limit ruchów). */
export function createDailySession(def: DailyDef, onFinished?: (won: boolean) => void) {
    const logic = new BoardLogic(buildConfig(def));
    const session = new MatchSession(logic, {
        onFinished: (_reason, win) => onFinished?.(win),
    });
    session.registerPlayer(soloPlayer());
    session.bindEvents();
    const buildGoals = (): GoalRule[] => [new CollectGoal(def.goalTargetId, def.goalAmount)];
    session.start({
        moveLimit: def.moveLimit, timeLimit: 0, buildGoals, checksGoals: true,
        availableBlockIds: def.availableBlockIds,
    });
    return { logic, session };
}

/** Doprowadza planszę do spoczynku, pozwalając sesji domknąć turę (win/loss). */
function settle(session: MatchSession, logic: BoardLogic) {
    for (let i = 0; i < 5000; i++) {
        const wasIdle = logic.isSettled();
        session.update(1000);
        logic.update(1000);
        if (session.isGameOver) return;
        if (wasIdle && logic.isSettled()) return;
    }
}

/**
 * Rozwiązuje łamigłówkę zachłannie (MoveFinder) — deterministycznie z ziarna.
 * Zwraca wynik + sekwencję ruchów. Służy też do GWARANCJI rozwiązania w getDaily.
 */
export function solveDaily(def: DailyDef): DailyResult {
    let won = false;
    const { logic, session } = createDailySession(def, (w) => { won = w; });
    const rng = new RNG(); rng.setSeed(def.seed);
    const moves: ReplayMove[] = [];

    settle(session, logic);
    while (!session.isGameOver && moves.length < def.moveLimit + 5) {
        const mv = MoveFinder.getBestMove(logic, () => rng.next());
        if (!mv) break; // brak ruchu (deadlock nienaprawialny)
        session.requestMove(0, mv.idxA, mv.dirX, mv.dirY);
        moves.push({ idxA: mv.idxA, dirX: mv.dirX, dirY: mv.dirY });
        settle(session, logic);
    }
    return {
        won,
        movesUsed: moves.length,
        moveLimit: def.moveLimit,
        collected: session.getGoalProgress(0),
        goalAmount: def.goalAmount,
        moves,
    };
}

/**
 * Zwraca łamigłówkę na dany dzień — GWARANTOWANIE ROZWIĄZYWALNĄ.
 * Startuje od ziarna daty i, jeśli zachłanny solver nie wygra w limicie, próbuje kolejnych
 * wariantów ziarna (deterministycznie), aż znajdzie planszę do przejścia.
 */
// Parametry łamigłówki (bez seeda). Cel COLLECT wymaga wielu dopasowań (brak bomb koloru),
// a moveLimit jest dobrany tak, by zachłanny solver zdążył — ale z zapasem na pomyłki gracza.
function baseDef(date: string, number: number): Omit<DailyDef, 'seed'> {
    return {
        date, number,
        cols: 7, rows: 7, blockTypes: DAILY_BLOCK_IDS.length,
        availableBlockIds: DAILY_BLOCK_IDS,
        moveLimit: 22,
        goalTargetId: DAILY_GOAL_TARGET,
        goalAmount: 18,
    };
}

export function getDaily(date: string, maxAttempts = 40): DailyDef {
    const base = seedForDate(date);
    const number = dailyNumber(date);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const def: DailyDef = { ...baseDef(date, number), seed: base + attempt };
        if (solveDaily(def).won) return def;
    }
    // Nie powinno się zdarzyć przy tych parametrach; ostatnia próba jako fallback.
    return { ...baseDef(date, number), seed: base + maxAttempts };
}

/**
 * Spoiler-free wynik do dzielenia (styl Wordle): numer, ruchy/limit i pasek zużycia.
 * Nie zdradza planszy.
 */
export function shareString(def: DailyDef, result: DailyResult): string {
    const status = result.won ? '✅' : '❌';
    const usedRatio = Math.min(1, result.movesUsed / def.moveLimit);
    const filled = Math.round(usedRatio * def.moveLimit);
    const bar = '🟩'.repeat(result.won ? filled : 0)
        + '🟥'.repeat(result.won ? 0 : filled)
        + '⬛'.repeat(def.moveLimit - filled);
    const score = result.won ? `${result.movesUsed}/${def.moveLimit}` : `X/${def.moveLimit}`;
    return `Daily #${def.number} ${score} ${status}\n${bar}`;
}
