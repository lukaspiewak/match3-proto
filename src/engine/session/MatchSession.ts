import { BoardLogic } from '../BoardLogic';
import { CellState, TURN_TIME_LIMIT } from '../Config';
import { type GoalRule } from '../rules/GoalRule';
import { type ReplayMove } from '../replay/Replay';

const REPLAY_MOVE_DELAY = 0.45; // s przerwy między ruchami w odtwarzaniu

/** Minimalny kontrakt gracza widziany przez sesję (bez zależności od warstwy gry). */
export interface SessionPlayer {
    readonly id: number;
    update(delta: number): void;
    onTurnStart(): void;
}

/** Reakcje warstwy gry na zdarzenia sesji (ekonomia, zapis, itd.). */
export interface SessionHooks {
    /** Reakcja na zniszczenie bloku; zwrócenie stringa = natychmiastowa porażka (np. bankructwo). */
    onDestroy?: (typeId: number, score: number) => string | null | void;
    /** Reakcja na dostarczenie bloku na krawędź. */
    onDeliver?: (typeId: number) => void;
    /** Wywoływane przy wygranej (np. zapis postępu). */
    onWin?: () => void;
    onFinished?: (reason: string, win: boolean) => void;
    onDeadlockFixed?: (id: number, type: number) => void;
    onReplayFinished?: () => void;
}

/** Parametry startu sesji — prymitywy, bez typu LevelConfig (agnostyczne wobec gry). */
export interface SessionStart {
    moveLimit: number;
    timeLimit: number;
    goals: GoalRule[];
    checksGoals: boolean;
    layout?: number[][];
    availableBlockIds?: number[];
    spawners?: number[];
}

/**
 * MatchSession — generyczny "runner" rozgrywki match-3.
 *
 * Odpowiada za planszę, tury, limity (ruchy/czas), ocenę wygranej/porażki (cele + brak
 * ruchów + czas + bomby), napęd odtwarzania (replay) i podpięcie zdarzeń planszy.
 * NIE zna ekonomii/miasta — reakcje gry wstrzykuje się przez SessionHooks. Druga gra
 * reużywa tę klasę, dostarczając własne cele i hooki.
 */
export class MatchSession {
    private logic: BoardLogic;
    private hooks: SessionHooks;
    private players: SessionPlayer[] = [];
    private currentPlayerIndex = 0;

    private goals: GoalRule[] = [];
    private checksGoals = true;
    private moveLimit = 0;
    private currentScore = 0;
    public scorePerBlock = 10;
    private started = false;

    public movesLeft = 0;
    public timeLeft = 0;
    public maxMoves = 0;
    public maxTime = 0;
    public turnTimer = TURN_TIME_LIMIT;
    public get maxTurnTime(): number { return TURN_TIME_LIMIT; }

    private isProcessingTurn = false;
    public isGameOver = false;
    public gameStatusText = "";

    private replayMoves: ReplayMove[] | null = null;
    private replayIndex = 0;
    private replayTimer = 0;
    public get isReplaying(): boolean { return this.replayMoves !== null; }

    constructor(logic: BoardLogic, hooks: SessionHooks = {}) {
        this.logic = logic;
        this.hooks = hooks;
    }

    // --- Gettery ---
    public getScore(): number { return this.currentScore; }
    public getGoalProgress(index: number): number { return this.goals[index] ? this.goals[index].progress().current : 0; }

    // --- Gracze ---
    public registerPlayer(player: SessionPlayer) { this.players.push(player); }
    public clearPlayers() { this.players = []; }
    public getCurrentPlayerId(): number { return this.players[this.currentPlayerIndex]?.id ?? -1; }

    public bindEvents() {
        this.logic.off('explode', this.onExplodeHandler);
        this.logic.on('explode', this.onExplodeHandler);
        this.logic.off('delivered', this.onDeliveredHandler);
        this.logic.on('delivered', this.onDeliveredHandler);
    }

    private onExplodeHandler = (data: { typeId: number }) => this.onBlockDestroyed(data.typeId);
    private onDeliveredHandler = (data: { typeId: number }) => this.onBlockDelivered(data.typeId);

    public start(s: SessionStart) {
        this.currentPlayerIndex = 0;
        this.isProcessingTurn = false;
        this.isGameOver = false;
        this.currentScore = 0;
        this.moveLimit = s.moveLimit;
        this.movesLeft = s.moveLimit;
        this.maxMoves = s.moveLimit;
        this.timeLeft = s.timeLimit;
        this.maxTime = s.timeLimit;
        this.goals = s.goals;
        this.checksGoals = s.checksGoals;
        this.replayMoves = null;
        this.started = true;
        this.logic.initBoard(s.layout, s.availableBlockIds, s.spawners);
        this.startTurn();
    }

    public startReplay(s: SessionStart, moves: ReplayMove[]) {
        this.start(s);
        this.replayMoves = moves;
        this.replayIndex = 0;
        this.replayTimer = REPLAY_MOVE_DELAY;
    }

    public reset() { this.isGameOver = true; this.players = []; this.started = false; }

    public finish(reason: string, win: boolean) {
        this.isGameOver = true;
        this.gameStatusText = win ? "VICTORY!" : "DEFEAT";
        if (win) this.hooks.onWin?.();
        console.log(`🏁 GAME OVER: ${reason}`);
        this.hooks.onFinished?.(reason, win);
    }

    public update(delta: number) {
        if (this.isGameOver || !this.started) return;
        const dt = delta / 60.0;

        if (this.maxTime > 0) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.checkWinLossCondition();
                if (!this.isGameOver) this.finish("TIME UP", false);
                return;
            }
        }

        if (!this.logic.cells.every(c => c.state === CellState.IDLE)) {
            this.isProcessingTurn = true;
        } else if (this.isProcessingTurn) {
            this.isProcessingTurn = false;
            this.endTurn();
        }

        if (this.logic.config.gameMode !== 'SOLO' && !this.isProcessingTurn) {
            this.turnTimer -= dt;
            if (this.turnTimer <= 0) this.endTurn();
        }

        if (this.replayMoves) { this.driveReplay(dt); return; }

        this.players[this.currentPlayerIndex]?.update(delta);
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver || this.isReplaying) return false;
        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        return boardIdle && this.players[this.currentPlayerIndex]?.id === playerId;
    }

    public requestMove(playerId: number, idxA: number, dirX: number, dirY: number) {
        if (!this.isMyTurn(playerId)) return;
        const result = this.logic.trySwap(idxA, dirX, dirY);
        if (result.success && this.moveLimit > 0) this.movesLeft--;
    }

    private driveReplay(dt: number) {
        if (!this.replayMoves) return;
        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        if (!boardIdle || this.isProcessingTurn || this.isGameOver) return;

        this.replayTimer -= dt;
        if (this.replayTimer > 0) return;

        if (this.replayIndex >= this.replayMoves.length) {
            this.replayMoves = null;
            this.hooks.onReplayFinished?.();
            return;
        }
        const m = this.replayMoves[this.replayIndex++];
        const res = this.logic.trySwap(m.idxA, m.dirX, m.dirY);
        if (res.success && this.moveLimit > 0) this.movesLeft--;
        this.replayTimer = REPLAY_MOVE_DELAY;
    }

    private onBlockDestroyed(typeId: number) {
        if (!this.started || this.isGameOver) return;
        this.currentScore += this.scorePerBlock;

        const failReason = this.hooks.onDestroy?.(typeId, this.currentScore);
        if (failReason) { this.finish(failReason, false); return; }

        this.goals.forEach(g => g.onBlockDestroyed(typeId, this.currentScore));
        this.checkWinLossCondition();
    }

    private onBlockDelivered(typeId: number) {
        if (!this.started || this.isGameOver) return;
        this.hooks.onDeliver?.(typeId);
        this.goals.forEach(g => g.onDelivered?.(typeId));
        this.checkWinLossCondition();
    }

    private checkWinLossCondition() {
        if (!this.started || this.isGameOver) return;
        if (!this.checksGoals) return;

        if (this.goals.every(g => g.isMet())) { this.finish("LEVEL COMPLETE!", true); return; }
        if (this.moveLimit > 0 && this.movesLeft <= 0 && !this.isProcessingTurn) {
            this.finish("OUT OF MOVES", false);
        }
    }

    private startTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.logic.statsEnabled = true;
        const hint = this.logic.findHint();
        if (!hint) {
            const fix = this.logic.findDeadlockFix();
            if (fix) {
                this.logic.cells[fix.id].typeId = fix.targetType;
                this.hooks.onDeadlockFixed?.(fix.id, fix.targetType);
            }
        }
        this.turnTimer = TURN_TIME_LIMIT;
        currentPlayer?.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;
        this.checkWinLossCondition();
        if (this.isGameOver) return;

        const expired = this.logic.tickCountdowns();
        if (expired.length > 0) { this.finish("BOMB EXPLODED!", false); return; }

        if (this.logic.config.gameMode === 'VS_AI') {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }
        this.startTurn();
    }
}
