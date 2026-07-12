import { BoardLogic } from '../BoardLogic';
import type { GameConfig } from '../Config';
import { Random } from '../Random';

/**
 * Narzędzia do łamigłówek: walidacja pozycji i generowanie plansz z gwarantowanym
 * rozwiązaniem. Opiera się na deterministycznej symulacji headless silnika
 * (resolveInstant + findHint), więc wyniki są powtarzalne przy ustalonym ziarnie.
 */

export interface BoardValidation {
    /** Plansza w spoczynku (nic nie animuje, brak oczekujących dopasowań). */
    settled: boolean;
    /** Czy są nierozwiązane dopasowania (grywalna pozycja startowa nie powinna ich mieć). */
    matchesPresent: boolean;
    /** Czy istnieje co najmniej jeden legalny ruch (brak deadlocka). */
    hasMove: boolean;
    /** Pozycja jest poprawną, grywalną planszą startową. */
    playable: boolean;
}

/** Ocena, czy dana plansza to poprawna, grywalna pozycja startowa. */
export function validateBoard(board: BoardLogic): BoardValidation {
    const settled = board.isSettled();
    const matchesPresent = board.hasAnyMatch();
    const hasMove = board.findHint() !== null;
    return { settled, matchesPresent, hasMove, playable: settled && !matchesPresent && hasMove };
}

/**
 * Gwarantuje, że plansza ma co najmniej jeden legalny ruch (nie jest deadlockiem).
 * Najpierw próbuje naprawy pojedynczą zmianą (findDeadlockFix), w ostateczności
 * przebudowuje planszę. Zwraca true, jeśli udało się osiągnąć grywalny stan.
 */
export function ensureHasMove(board: BoardLogic, maxAttempts: number = 200): boolean {
    let attempts = 0;
    while (board.findHint() === null) {
        if (attempts++ >= maxAttempts) return false;
        const fix = board.findDeadlockFix();
        if (fix) {
            board.cells[fix.id].typeId = fix.targetType;
        } else {
            board.initBoard(); // brak naprawy jednym ruchem — losujemy od nowa
        }
    }
    return true;
}

/**
 * Generuje planszę z gwarantowanym rozwiązaniem (istnieje legalny ruch, brak
 * początkowych dopasowań). Deterministyczne dla danego config.seed.
 * `layout`/`availableBlockIds` są opcjonalne (jak w BoardLogic.initBoard).
 */
export function generateSolvableBoard(
    config: GameConfig,
    layout?: number[][],
    availableBlockIds?: number[]
): BoardLogic {
    Random.setSeed(config.seed);
    const board = new BoardLogic(config);
    board.initBoard(layout, availableBlockIds); // initBoard unika początkowych trójek
    ensureHasMove(board);
    return board;
}
