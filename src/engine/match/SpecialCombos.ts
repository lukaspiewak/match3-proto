import type { SpecialAction } from '../BlockDef';

/**
 * SpecialCombos — KONFIGUROWALNA tablica łączenia bloków specjalnych.
 *
 * Klucz to nieuporządkowana para id typów (mniejsze-większe), np. "100+100".
 * Wartość to akcja uruchamiana w miejscu OBU zamienianych bloków (nakładające
 * się efekty dają wzmocniony rezultat). Brak wpisu → każdy specjalny aktywuje
 * własne onActivate osobno (fallback w BoardLogic.resolveSpecialSwap).
 *
 * Dodanie nowego combo = jeden wpis tutaj; zero zmian w logice silnika.
 */
export type SpecialComboTable = Record<string, SpecialAction>;

function key(a: number, b: number): string {
    return a <= b ? `${a}+${b}` : `${b}+${a}`;
}

export const DEFAULT_COMBOS: SpecialComboTable = {
    // TNT + TNT → podwójny duży wybuch (nakłada się w dwóch punktach = większy zasięg).
    '100+100': 'EXPLODE_BIG',
    // TNT + Color Bomb → czyści cały kolor (spektakularne).
    '100+101': 'CLEAR_COLOR',
    // Color Bomb + Color Bomb → także CLEAR_COLOR w obu punktach (silne czyszczenie).
    '101+101': 'CLEAR_COLOR',
};

/** Zwraca akcję combo dla pary typów specjalnych, albo null (brak wpisu). */
export function resolveSpecialCombo(
    typeA: number,
    typeB: number,
    table: SpecialComboTable = DEFAULT_COMBOS
): SpecialAction | null {
    return table[key(typeA, typeB)] ?? null;
}
