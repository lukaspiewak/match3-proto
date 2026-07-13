import { BoardLogic } from './engine/BoardLogic';
import { PlayerController } from './PlayerController';
import { type GoalRule, CollectGoal, ScoreGoal, DeliverGoal } from './engine/rules/GoalRule';
import { type ReplayMove } from './engine/replay/Replay';
import { MatchSession, type SessionStart } from './engine/session/MatchSession';
import { type LevelConfig, type LevelGoal } from './LevelDef';
import { type EconomyMode, type Inventory, resolveEconomyMode } from './economy/EconomyMode';

/** Buduje pluginowalne cele z deklaratywnej konfiguracji poziomu. */
function buildGoals(goals: LevelGoal[]): GoalRule[] {
    return goals.map(g => {
        if (g.type === 'COLLECT') return new CollectGoal(g.targetId ?? -1, g.amount);
        if (g.type === 'DELIVER') return new DeliverGoal(g.targetId ?? -1, g.amount);
        return new ScoreGoal(g.amount);
    });
}

/**
 * GameManager — adapter gry (city builder) nad generycznym MatchSession.
 *
 * MatchSession (silnik) prowadzi rozgrywkę (tury/limity/win-loss/replay/bomby).
 * Tu dokładamy TYLKO to, co miejskie: ekonomię (EconomyMode), inwentarz i zapis.
 * Publiczne API zachowane 1:1 dla GameScene (delegacja do sesji).
 */
export class GameManager {
    private session: MatchSession;

    private currentLevel: LevelConfig | null = null;
    private economyMode: EconomyMode = resolveEconomyMode('STANDARD');
    private sessionInventory: Inventory = {};
    private startInventory: Inventory = {};

    public onGameFinished: ((reason: string, win: boolean) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;
    public onReplayFinished: (() => void) | null = null;

    constructor(logic: BoardLogic) {
        this.session = new MatchSession(logic, {
            onDestroy: (typeId) => this.economyMode.collect(typeId, this.sessionInventory),
            onWin: () => {
                if (this.currentLevel) {
                    this.economyMode.saveOnWin(this.sessionInventory, this.currentLevel);
                    console.log("💾 Progress Saved.");
                }
            },
            onFinished: (reason, win) => this.onGameFinished?.(reason, win),
            onDeadlockFixed: (id, type) => this.onDeadlockFixed?.(id, type),
            onReplayFinished: () => this.onReplayFinished?.(),
        });
    }

    // --- Delegacja stanu (czytane przez GameScene/HUD) ---
    public get movesLeft(): number { return this.session.movesLeft; }
    public get maxMoves(): number { return this.session.maxMoves; }
    public get timeLeft(): number { return this.session.timeLeft; }
    public get maxTime(): number { return this.session.maxTime; }
    public get turnTimer(): number { return this.session.turnTimer; }
    public get maxTurnTime(): number { return this.session.maxTurnTime; }
    public get isGameOver(): boolean { return this.session.isGameOver; }
    public get gameStatusText(): string { return this.session.gameStatusText; }
    public get isReplaying(): boolean { return this.session.isReplaying; }

    // --- Delegacja metod generycznych ---
    public registerPlayer(player: PlayerController) { this.session.registerPlayer(player); }
    public clearPlayers() { this.session.clearPlayers(); }
    public getCurrentPlayerId(): number { return this.session.getCurrentPlayerId(); }
    public isMyTurn(playerId: number): boolean { return this.session.isMyTurn(playerId); }
    public requestMove(playerId: number, idxA: number, dirX: number, dirY: number) { this.session.requestMove(playerId, idxA, dirX, dirY); }
    public update(delta: number) { this.session.update(delta); }
    public bindEvents() { this.session.bindEvents(); }
    public getScore(): number { return this.session.getScore(); }
    public getGoalProgress(index: number): number { return this.session.getGoalProgress(index); }

    // --- Warstwa gry (ekonomia / cele UI) ---
    public getSessionResourceAmount(typeId: number): number { return this.sessionInventory[typeId] || 0; }
    public getStartResourceAmount(typeId: number): number { return this.startInventory[typeId] || 0; }
    public get currentLevelMode() { return this.currentLevel ? this.currentLevel.mode : 'STANDARD'; }
    public getCurrentGoals(): LevelGoal[] { return this.currentLevel ? this.currentLevel.goals : []; }

    // --- Start / zakończenie ---
    private prepare(level: LevelConfig): SessionStart {
        this.currentLevel = level;
        this.economyMode = resolveEconomyMode(level.mode);
        this.sessionInventory = this.economyMode.initInventory();
        this.startInventory = { ...this.sessionInventory };
        console.log(`Loading Level: ${level.id} (${level.mode})`);
        return {
            moveLimit: level.moveLimit,
            timeLimit: level.timeLimit,
            goals: buildGoals(level.goals),
            checksGoals: this.economyMode.checksGoals,
            layout: level.layout,
            availableBlockIds: level.availableBlockIds,
            spawners: level.spawners,
        };
    }

    public startLevel(level: LevelConfig) { this.session.start(this.prepare(level)); }
    public startReplay(level: LevelConfig, moves: ReplayMove[]) { this.session.startReplay(this.prepare(level), moves); }

    public resetGame() { this.session.reset(); this.currentLevel = null; }

    public finishExpedition() {
        if (!this.currentLevel || this.isGameOver) return;
        if (this.currentLevel.mode === 'GATHERING') this.session.finish("EXPEDITION COMPLETE", true);
        else this.session.finish("SURRENDERED", false);
    }
}
