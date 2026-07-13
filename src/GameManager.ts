import { BoardLogic } from './engine/BoardLogic';
import { PlayerController } from './PlayerController';
import {
    TURN_TIME_LIMIT, CellState, AppConfig
} from './engine/Config';
import { type GoalRule, CollectGoal, ScoreGoal, DeliverGoal } from './engine/rules/GoalRule';
import { type ReplayMove } from './engine/replay/Replay';
import { type LevelConfig, type LevelGoal } from './LevelDef';

const REPLAY_MOVE_DELAY = 0.45; // s przerwy między ruchami w odtwarzaniu
import { type EconomyMode, type Inventory, resolveEconomyMode } from './economy/EconomyMode';

/** Buduje pluginowalne cele z deklaratywnej konfiguracji poziomu. */
function buildGoals(goals: LevelGoal[]): GoalRule[] {
    return goals.map(g => {
        if (g.type === 'COLLECT') return new CollectGoal(g.targetId ?? -1, g.amount);
        if (g.type === 'DELIVER') return new DeliverGoal(g.targetId ?? -1, g.amount);
        return new ScoreGoal(g.amount);
    });
}

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    private currentLevel: LevelConfig | null = null;
    private goalRules: GoalRule[] = [];
    private currentScore: number = 0;

    private economyMode: EconomyMode = resolveEconomyMode('STANDARD');
    private sessionInventory: Inventory = {};
    private startInventory: Inventory = {};

    public movesLeft: number = 0;
    public timeLeft: number = 0;
    
    public maxMoves: number = 0;
    public maxTime: number = 0;

    public turnTimer: number = 0;
    public get maxTurnTime(): number { return TURN_TIME_LIMIT; }

    private isProcessingTurn: boolean = false; 
    public isGameOver: boolean = false;
    public gameStatusText: string = ""; 

    public onGameFinished: ((reason: string, win: boolean) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;

    // --- ODTWARZANIE (replay) ---
    private replayMoves: ReplayMove[] | null = null;
    private replayIndex = 0;
    private replayTimer = 0;
    public onReplayFinished: (() => void) | null = null;
    public get isReplaying(): boolean { return this.replayMoves !== null; }

    /** Startuje poziom w trybie odtwarzania: silnik sam podaje nagrane ruchy. */
    public startReplay(level: LevelConfig, moves: ReplayMove[]) {
        this.startLevel(level);
        this.replayMoves = moves;
        this.replayIndex = 0;
        this.replayTimer = REPLAY_MOVE_DELAY;
    }

    private driveReplay(dt: number) {
        if (!this.replayMoves) return;
        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        if (!boardIdle || this.isProcessingTurn || this.isGameOver) return;

        this.replayTimer -= dt;
        if (this.replayTimer > 0) return;

        if (this.replayIndex >= this.replayMoves.length) {
            this.replayMoves = null;
            if (this.onReplayFinished) this.onReplayFinished();
            return;
        }
        const m = this.replayMoves[this.replayIndex++];
        const res = this.logic.trySwap(m.idxA, m.dirX, m.dirY);
        if (res.success && this.currentLevel && this.currentLevel.moveLimit > 0) this.movesLeft--;
        this.replayTimer = REPLAY_MOVE_DELAY;
    }

    constructor(logic: BoardLogic) {
        this.logic = logic;
        this.turnTimer = TURN_TIME_LIMIT;
    }

    public bindEvents() {
        this.logic.off('explode', this.onExplodeHandler);
        this.logic.on('explode', this.onExplodeHandler);
        this.logic.off('delivered', this.onDeliveredHandler);
        this.logic.on('delivered', this.onDeliveredHandler);
    }

    private onExplodeHandler = (data: { id: number, typeId: number }) => {
        this.onBlockDestroyed(data.typeId);
    };

    private onDeliveredHandler = (data: { id: number, typeId: number }) => {
        this.onBlockDelivered(data.typeId);
    };

    private onBlockDelivered(typeId: number) {
        if (!this.currentLevel || this.isGameOver) return;
        this.goalRules.forEach(g => g.onDelivered?.(typeId));
        this.checkWinLossCondition();
    }

    // --- UI Helpers & Getters ---
    public getSessionResourceAmount(typeId: number): number { return this.sessionInventory[typeId] || 0; }
    public getStartResourceAmount(typeId: number): number { return this.startInventory[typeId] || 0; }
    public getScore(): number { return this.currentScore; }
    public get currentLevelMode() { return this.currentLevel ? this.currentLevel.mode : 'STANDARD'; }
    
    // NOWOŚĆ: Gettery dla UI celów
    public getCurrentGoals(): LevelGoal[] { return this.currentLevel ? this.currentLevel.goals : []; }
    public getGoalProgress(index: number): number { return this.goalRules[index] ? this.goalRules[index].progress().current : 0; }

    // --- Core Logic ---
    public registerPlayer(player: PlayerController) { this.players.push(player); }
    public clearPlayers() { this.players = []; }
    public getCurrentPlayerId(): number { if (!this.players[this.currentPlayerIndex]) return -1; return this.players[this.currentPlayerIndex].id; }

    public startLevel(level: LevelConfig) {
        this.currentLevel = level;
        this.currentPlayerIndex = 0;
        this.isProcessingTurn = false;
        this.isGameOver = false;
        this.currentScore = 0;

        this.movesLeft = level.moveLimit;
        this.maxMoves = level.moveLimit; 

        this.timeLeft = level.timeLimit;
        this.maxTime = level.timeLimit;

        this.economyMode = resolveEconomyMode(level.mode);
        this.goalRules = buildGoals(level.goals);

        this.sessionInventory = this.economyMode.initInventory();
        this.startInventory = { ...this.sessionInventory };

        console.log(`Loading Level: ${level.id} (${level.mode})`);
        this.logic.initBoard(level.layout, level.availableBlockIds, level.spawners);
        this.startTurn();
    }

    public finishExpedition() {
        if (!this.currentLevel || this.isGameOver) return;
        if (this.currentLevel.mode === 'GATHERING') {
            this.finishGame("EXPEDITION COMPLETE", true);
        } else {
            this.finishGame("SURRENDERED", false);
        }
    }

    public startGame() { this.logic.initBoard(); this.startTurn(); }
    public resetGame() { this.isGameOver = true; this.players = []; this.currentLevel = null; }
    
    public update(delta: number) {
        if (this.isGameOver || !this.currentLevel) return;
        const dt = delta / 60.0;

        if (this.currentLevel.timeLimit > 0) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.checkWinLossCondition();
                if (!this.isGameOver) this.finishGame("TIME UP", false);
                return;
            }
        }

        if (!this.logic.cells.every(c => c.state === CellState.IDLE)) {
            this.isProcessingTurn = true;
        } else if (this.isProcessingTurn) {
            this.isProcessingTurn = false;
            this.endTurn(); 
        }

        if (AppConfig.gameMode !== 'SOLO' && !this.isProcessingTurn) {
             this.turnTimer -= dt;
             if (this.turnTimer <= 0) this.endTurn();
        }

        // Tryb odtwarzania: silnik sam podaje kolejne ruchy (input gracza zablokowany).
        if (this.replayMoves) { this.driveReplay(dt); return; }

        if (this.players[this.currentPlayerIndex]) this.players[this.currentPlayerIndex].update(delta);
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver || this.isReplaying) return false;
        if (AppConfig.gameMode === 'SOLO') {
             const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
             return boardIdle && this.players[this.currentPlayerIndex].id === playerId;
        }
        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        return boardIdle && this.players[this.currentPlayerIndex].id === playerId;
    }

    public requestMove(playerId: number, idxA: number, dirX: number, dirY: number) {
        if (!this.isMyTurn(playerId)) return;
        const result = this.logic.trySwap(idxA, dirX, dirY);
        if (result.success) {
            if (this.currentLevel && this.currentLevel.moveLimit > 0) {
                this.movesLeft--;
            }
        }
    }

    private onBlockDestroyed(typeId: number) {
        if (!this.currentLevel || this.isGameOver) return;
        this.currentScore += 10;

        // Efekt uboczny trybu (inwentarz); może zwrócić powód porażki (np. bankructwo).
        const failReason = this.economyMode.collect(typeId, this.sessionInventory);
        if (failReason) {
            this.finishGame(failReason, false);
            return;
        }

        // Aktualizacja pluginowalnych celów.
        this.goalRules.forEach(goal => goal.onBlockDestroyed(typeId, this.currentScore));

        this.checkWinLossCondition();
    }

    private checkWinLossCondition() {
        if (!this.currentLevel || this.isGameOver) return;
        if (!this.economyMode.checksGoals) return;

        if (this.goalRules.every(g => g.isMet())) {
            this.finishGame("LEVEL COMPLETE!", true);
            return;
        }
        if (this.currentLevel.moveLimit > 0 && this.movesLeft <= 0 && !this.isProcessingTurn) {
            this.finishGame("OUT OF MOVES", false);
        }
    }

    private finishGame(reason: string, win: boolean) {
        this.isGameOver = true;
        this.gameStatusText = win ? "VICTORY!" : "DEFEAT";

        if (win && this.currentLevel) {
            this.economyMode.saveOnWin(this.sessionInventory, this.currentLevel);
            console.log("💾 Progress Saved.");
        } else {
            console.log("❌ No Progress Saved (Defeat/Bankruptcy).");
        }

        console.log(`🏁 GAME OVER: ${reason}`);
        if (this.onGameFinished) this.onGameFinished(reason, win);
    }

    private startTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.logic.statsEnabled = true;
        const hint = this.logic.findHint();
        if (!hint) {
            const fix = this.logic.findDeadlockFix();
            if (fix) {
                this.logic.cells[fix.id].typeId = fix.targetType;
                if (this.onDeadlockFixed) this.onDeadlockFixed(fix.id, fix.targetType);
            }
        }
        this.turnTimer = TURN_TIME_LIMIT;
        if (currentPlayer) currentPlayer.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;
        this.checkWinLossCondition();
        if (this.isGameOver) return;

        // Bomby: 1 tyknięcie na ruch; osiągnięcie 0 = przegrana (chyba że wcześniej wygrana).
        const expired = this.logic.tickCountdowns();
        if (expired.length > 0) {
            this.finishGame("BOMB EXPLODED!", false);
            return;
        }

        if (AppConfig.gameMode === 'VS_AI') {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }
        this.startTurn();
    }
}