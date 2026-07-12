import { BoardLogic, type BoardState } from '../engine/BoardLogic';
import { MoveFinder } from '../engine/ai/MoveFinder';
import { Random } from '../engine/Random';
import { AppConfig, VOID, type GameConfig } from '../engine/Config';
import { GameManager } from '../GameManager';
import { PlayerController } from '../PlayerController';
import { type LevelConfig } from '../LevelDef';

/**
 * Headless symulator/walidator poziomów.
 *
 * Auto-gra poziom przez PRAWDZIWY GameManager (cele, limity, ekonomia, bomby, blokery)
 * używając zachłannej polityki (MoveFinder), i raportuje:
 *  - czy poziom da się ukończyć (WIN) i w ilu ruchach,
 *  - czy zachowuje się poprawnie (niezmienniki: void nienaruszony, brak zawieszonych
 *    dopasowań, brak zawieszenia/nieskończonej pętli),
 *  - postęp celów i wynik.
 *
 * Zakres: waliduje logikę RUCHÓW/celów/blokerów. Presja czasu (timeLimit) jest domyślnie
 * pomijana (osobny wymiar zależny od szybkości gracza). Polityka jest zachłanna —
 * poziom wygrywalny tylko perfekcyjną grą może zostać zaraportowany jako niewygrany.
 */

/** Bezczynny gracz — potrzebny tylko, by isMyTurn() przepuszczał ruchy symulatora. */
class SimPlayer extends PlayerController {
    public update(): void {}
    public onTurnStart(): void {}
}

export interface SimGoal { kind: string; current: number; target: number; met: boolean; }

export interface SimReport {
    result: 'WIN' | 'LOSS' | 'STUCK' | 'MOVE_CAP';
    reason: string;
    won: boolean;
    movesUsed: number;
    score: number;
    goals: SimGoal[];
    /** Naruszenia niezmienników (pusta lista = poziom zachowuje się poprawnie). */
    issues: string[];
    finalState: BoardState;
}

export interface SimOptions {
    seed?: number;
    maxMoves?: number;   // twardy limit ruchów symulatora (anty-zawieszenie)
    ignoreTime?: boolean; // domyślnie true — pomija limit czasu
}

/** Dopędza planszę do spoczynku i pozwala GameManagerowi domknąć turę (endTurn/bomby/win-loss). */
function settle(gm: GameManager, logic: BoardLogic, cap = 4000): void {
    for (let i = 0; i < cap; i++) {
        gm.update(1000);
        logic.update(1000);
        if (gm.isGameOver) return;
        if (logic.isSettled()) {
            // Jeszcze jeden tick, by GameManager wykrył idle i domknął turę.
            gm.update(1000);
            logic.update(1000);
            if (gm.isGameOver) return;
            if (logic.isSettled()) return;
        }
    }
}

export function simulateLevel(level: LevelConfig, opts: SimOptions = {}): SimReport {
    const seed = opts.seed ?? AppConfig.seed;
    const maxMoves = opts.maxMoves ?? 300;
    const ignoreTime = opts.ignoreTime ?? true;

    const simLevel: LevelConfig = ignoreTime ? { ...level, timeLimit: 0 } : level;
    const config: GameConfig = { ...AppConfig, seed };

    // GameManager.update czyta globalny AppConfig.gameMode — wymuszamy SOLO na czas symulacji.
    const prevMode = AppConfig.gameMode;
    AppConfig.gameMode = 'SOLO';

    try {
        Random.setSeed(seed);
        const logic = new BoardLogic(config);
        const gm = new GameManager(logic);

        let finished = false, finishReason = '', finishWin = false;
        gm.onGameFinished = (reason, win) => { finished = true; finishReason = reason; finishWin = win; };

        gm.bindEvents();
        gm.registerPlayer(new SimPlayer(0, gm, logic));
        gm.startLevel(simLevel);

        const issues: string[] = [];
        const cols = logic.cols;
        const checkInvariants = () => {
            for (let i = 0; i < logic.cells.length; i++) {
                const r = Math.floor(i / cols), c = i % cols;
                const isVoidCell = simLevel.layout[r]?.[c] === VOID;
                if (isVoidCell && logic.cells[i].typeId !== VOID) issues.push(`void zniszczony @${i}`);
                if (!isVoidCell && logic.cells[i].typeId === VOID) issues.push(`nieoczekiwany void @${i}`);
            }
            // Uwaga: po zakończeniu gry plansza jest zamrożona w połowie kaskady — nie sprawdzamy.
            if (!gm.isGameOver && logic.isSettled() && logic.hasAnyMatch()) {
                issues.push('nierozwiązane dopasowanie w spoczynku');
            }
        };

        let movesUsed = 0;
        let stuck = false;

        settle(gm, logic);
        checkInvariants();

        while (!finished && movesUsed < maxMoves) {
            const move = MoveFinder.getBestMove(logic);
            if (!move) { stuck = true; break; }
            gm.requestMove(0, move.idxA, move.dirX, move.dirY);
            movesUsed++;
            settle(gm, logic);
            checkInvariants();
        }

        const result: SimReport['result'] =
            finished ? (finishWin ? 'WIN' : 'LOSS') : stuck ? 'STUCK' : 'MOVE_CAP';

        const goals: SimGoal[] = simLevel.goals.map((g, i) => {
            const current = gm.getGoalProgress(i);
            return { kind: g.type, current, target: g.amount, met: current >= g.amount };
        });

        return {
            result,
            reason: finishReason || result,
            won: finishWin,
            movesUsed,
            score: gm.getScore(),
            goals,
            issues: [...new Set(issues)],
            finalState: logic.getState(),
        };
    } finally {
        AppConfig.gameMode = prevMode;
    }
}
