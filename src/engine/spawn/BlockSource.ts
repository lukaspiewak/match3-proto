import { RNG } from '../Random';
import { BlockRegistry } from '../BlockDef';

/**
 * BlockSource — wymienne, PEEKOWALNE źródło nowych bloków dla spawnu.
 *
 * Kluczowe dla podglądu kolejnych bloków: peek() pokazuje przyszłe bloki bez ich
 * zużycia, a next() je konsumuje. Gwarancja: peek(lane, n)[i] to dokładnie blok,
 * który wpadnie jako (i+1)-szy w danym torze (kolumnie/rzędzie).
 *
 * Można podmienić na źródło „reżyserowane" (skryptowana sekwencja) do łamigłówek.
 */
export interface BlockSource {
    /** Podgląd n następnych bloków w torze `lane` (bez konsumpcji). */
    peek(lane: number, n: number): number[];
    /** Pobiera i konsumuje następny blok w torze `lane`. */
    next(lane: number): number;
    /** Reset wszystkich torów (np. przy ładowaniu poziomu). */
    reset(): void;
}

/**
 * Domyślne źródło: każdy tor ma NIEZALEŻNY, deterministyczny strumień RNG
 * (seedowany z bazowego ziarna i indeksu toru). Dzięki temu podgląd danego toru
 * jest stabilny niezależnie od tego, ile bloków zużyją inne tory.
 * Respektuje wagi bloków (przez BlockRegistry.getRandomBlockIdFromList).
 */
export class SeededColumnSource implements BlockSource {
    private streams = new Map<number, RNG>();
    private queues = new Map<number, number[]>();

    constructor(private baseSeed: number, private allowedIds: number[]) {}

    private laneSeed(lane: number): number {
        // Mieszanie, by sąsiednie tory nie były skorelowane (LCG źle znosi bliskie ziarna).
        const mixed = ((this.baseSeed * 73856093) ^ (lane * 19349663)) >>> 0;
        return mixed === 0 ? 1 : mixed;
    }

    private rngFor(lane: number): RNG {
        let rng = this.streams.get(lane);
        if (!rng) {
            rng = new RNG();
            rng.setSeed(this.laneSeed(lane));
            this.streams.set(lane, rng);
        }
        return rng;
    }

    private ensure(lane: number, n: number): number[] {
        let q = this.queues.get(lane);
        if (!q) { q = []; this.queues.set(lane, q); }
        if (q.length < n) {
            const rng = this.rngFor(lane);
            while (q.length < n) {
                q.push(BlockRegistry.getRandomBlockIdFromList(this.allowedIds, () => rng.next()));
            }
        }
        return q;
    }

    peek(lane: number, n: number): number[] {
        if (n <= 0) return [];
        return this.ensure(lane, n).slice(0, n);
    }

    next(lane: number): number {
        return this.ensure(lane, 1).shift()!;
    }

    reset(): void {
        this.streams.clear();
        this.queues.clear();
    }
}
