/**
 * GoalRule — pluginowalny cel poziomu.
 *
 * Silnik śledzi cele generycznie (przez zdarzenie "zniszczono blok" i bieżący
 * wynik). Konkretne typy celów są klasami implementującymi ten interfejs, więc
 * dodanie nowego typu celu = nowa klasa, bez dotykania rdzenia ani switchy.
 */

export interface GoalProgress {
    kind: string;
    targetId?: number;
    current: number;
    target: number;
    met: boolean;
}

export interface GoalRule {
    readonly kind: string;
    /** Reaguje na zniszczenie bloku danego typu. `score` = bieżący wynik gry. */
    onBlockDestroyed(typeId: number, score: number): void;
    isMet(): boolean;
    progress(): GoalProgress;
    reset(): void;
}

/** Zbierz N bloków danego typu. */
export class CollectGoal implements GoalRule {
    readonly kind = 'COLLECT';
    private current = 0;
    constructor(private readonly targetId: number, private readonly amount: number) {}

    onBlockDestroyed(typeId: number, _score: number): void {
        if (typeId === this.targetId) this.current++;
    }
    isMet(): boolean { return this.current >= this.amount; }
    progress(): GoalProgress {
        return { kind: this.kind, targetId: this.targetId, current: this.current, target: this.amount, met: this.isMet() };
    }
    reset(): void { this.current = 0; }
}

/** Osiągnij próg punktowy. */
export class ScoreGoal implements GoalRule {
    readonly kind = 'SCORE';
    private current = 0;
    constructor(private readonly amount: number) {}

    onBlockDestroyed(_typeId: number, score: number): void { this.current = score; }
    isMet(): boolean { return this.current >= this.amount; }
    progress(): GoalProgress {
        return { kind: this.kind, current: this.current, target: this.amount, met: this.isMet() };
    }
    reset(): void { this.current = 0; }
}
