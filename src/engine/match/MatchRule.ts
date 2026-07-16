import type { Cell } from '../Config';

/**
 * MatchRule — wymienna MECHANIKA DOPASOWANIA (detekcja).
 *
 * To jedyny element decydujący "co jest dopasowaniem". Efekty (akcje specjalne,
 * hp/obrażenia, combo, kaskady) są generyczne i żyją w MatchEngine. Dzięki temu
 * na jednym silniku można zbudować różne gatunki: klasyczne match-3 (linie),
 * collapse/blast (grupy tego samego koloru), a w przyszłości connect/heksy.
 */

/** Minimalny, tylko-do-odczytu widok planszy potrzebny do detekcji. */
export interface MatchBoard {
    readonly cols: number;
    readonly rows: number;
    readonly cells: readonly Cell[];
}

export type MatchShape = 'LINE' | 'L_SHAPE' | 'T_SHAPE' | 'SQUARE' | 'BLOB';

export interface MatchGroup {
    typeId: number;
    cells: number[];
    size: number;
    /** Kształt grupy — dostępny dla triggerów zależnych od kształtu (np. wrapped candy). */
    shape: MatchShape;
}

export interface MatchRule {
    readonly id: string;
    /** Wszystkie grupy dopasowań obecne na planszy (do automatycznego usunięcia). */
    findMatches(board: MatchBoard): MatchGroup[];
    /** Czy w danej komórce istnieje/powstałoby dopasowanie (walidacja ruchu, hint). */
    hasMatchAt(board: MatchBoard, idx: number): boolean;
    /** Grupa aktywowana ręcznie w danej komórce (collapse/tap) lub null. Opcjonalne. */
    groupAt?(board: MatchBoard, idx: number): MatchGroup | null;
}

/** Flood-fill: spójna (ortogonalnie) grupa komórek tego samego typu co start, spełniająca predykat. */
export function floodFill(
    board: MatchBoard,
    startIdx: number,
    accept: (idx: number) => boolean
): number[] {
    const { cols, rows, cells } = board;
    const typeId = cells[startIdx].typeId;
    const group = [startIdx];
    const stack = [startIdx];
    const visited = new Set<number>([startIdx]);
    while (stack.length) {
        const cur = stack.pop()!;
        const c = cur % cols; const r = Math.floor(cur / cols);
        const neighbors: [number, number][] = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
        for (const [nc, nr] of neighbors) {
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
            const nIdx = nc + nr * cols;
            if (!visited.has(nIdx) && cells[nIdx].typeId === typeId && accept(nIdx)) {
                visited.add(nIdx); stack.push(nIdx); group.push(nIdx);
            }
        }
    }
    return group;
}

/** Klasyfikuje kształt grupy: LINE (prosta), SQUARE (2x2), T/L (zgięte), BLOB. */
export function classifyShape(cells: number[], cols: number): MatchShape {
    if (cells.length === 0) return 'BLOB';
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const i of cells) {
        const c = i % cols, r = Math.floor(i / cols);
        if (c < minC) minC = c; if (c > maxC) maxC = c;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
    }
    const w = maxC - minC + 1, h = maxR - minR + 1;
    if (w === 1 || h === 1) return 'LINE';
    if (cells.length === 4 && w === 2 && h === 2) return 'SQUARE';

    // Analiza stopni węzłów: T/+ ma węzeł o stopniu >=3; czyste L ma same stopnie <=2.
    const set = new Set(cells);
    let maxDeg = 0;
    for (const i of cells) {
        const c = i % cols, r = Math.floor(i / cols);
        let deg = 0;
        if (c + 1 < cols && set.has((c + 1) + r * cols)) deg++;
        if (c - 1 >= 0 && set.has((c - 1) + r * cols)) deg++;
        if (set.has(c + (r + 1) * cols)) deg++;
        if (r - 1 >= 0 && set.has(c + (r - 1) * cols)) deg++;
        if (deg > maxDeg) maxDeg = deg;
    }
    if (maxDeg >= 3) return 'T_SHAPE';
    return 'L_SHAPE';
}
