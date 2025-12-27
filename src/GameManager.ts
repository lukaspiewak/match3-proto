import { BoardLogic } from './BoardLogic';
import { PlayerController } from './PlayerController';
import {
    PLAYER_ID_1, TURN_TIME_LIMIT, CellState, AppConfig
} from './Config';
import { type LevelConfig } from './LevelDef'; // Import definicji

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    // Stan Levelu
    private currentLevel: LevelConfig | null = null;
    private goalProgress: number[] = [];
    private currentScore: number = 0;

    // Liczniki
    public movesLeft: number = 0;
    public timeLeft: number = 0;

    public turnTimer: number = 0;
    private isProcessingTurn: boolean = false;

    public isGameOver: boolean = false;
    public globalMovesMade: number = 0; // Legacy (dla statystyk ogólnych)
    public globalTimeElapsed: number = 0;

    public gameStatusText: string = "";

    // ZMIANA: Callback przyjmuje teraz info o wygranej
    public onGameFinished: ((reason: string, win: boolean) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;

    constructor(logic: BoardLogic) {
        this.logic = logic;
        this.turnTimer = TURN_TIME_LIMIT;

        // Podpinamy nasłuchiwanie wybuchów do celów (COLLECT/SCORE)
        this.logic.on('explode', (data: { id: number, typeId: number }) => {
            this.onBlockDestroyed(data.typeId);
        });
    }

    public registerPlayer(player: PlayerController) {
        this.players.push(player);
    }

    public clearPlayers() {
        this.players = [];
    }

    public getCurrentPlayerId(): number {
        if (!this.players[this.currentPlayerIndex]) return -1;
        return this.players[this.currentPlayerIndex].id;
    }

    // --- NOWA METODA STARTU ---
    public startLevel(level: LevelConfig) {
        this.currentLevel = level;
        this.currentPlayerIndex = 0;
        this.isProcessingTurn = false;
        this.isGameOver = false;
        this.currentScore = 0;

        // Reset liczników z configu poziomu
        this.movesLeft = level.moveLimit;
        this.timeLeft = level.timeLimit;

        // Reset postępu celów
        this.goalProgress = level.goals.map(() => 0);

        // Przekazujemy układ do logiki!
        // Przekazujemy układ ORAZ listę dozwolonych bloków
        console.log(`Loading Level: ${level.id}`);
        this.logic.initBoard(level.layout, level.availableBlockIds);

        this.updateStatusText();
        console.log("=== LEVEL STARTED ===");
        this.startTurn();
    }

    // Stara metoda (zostawiamy dla kompatybilności lub usuwamy)
    public startGame() {
        console.warn("Use startLevel() instead of startGame()");
        this.logic.initBoard(); // Pusta/Losowa plansza
        this.startTurn();
    }

    public resetGame() {
        this.isGameOver = true;
        this.players = [];
        this.currentLevel = null;
    }

    public update(delta: number) {
        if (this.isGameOver || !this.currentLevel) return;

        const currentPlayer = this.players[this.currentPlayerIndex];
        const dt = delta / 60.0;

        // 1. Limit Czasu Levelu
        if (this.currentLevel.timeLimit > 0) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.checkWinLossCondition();
                if (!this.isGameOver) this.finishGame("TIME UP", false);
                return;
            }
        }

        // 2. Obsługa tury (czekanie na animacje)
        if (!this.logic.cells.every(c => c.state === CellState.IDLE)) {
            this.isProcessingTurn = true;
        } else if (this.isProcessingTurn) {
            this.isProcessingTurn = false;
            this.endTurn();
        }

        // Timer tury (opcjonalny, np. dla PvP)
        if (AppConfig.gameMode !== 'SOLO' && !this.isProcessingTurn) {
            this.turnTimer -= dt;
            if (this.turnTimer <= 0) {
                this.endTurn();
            }
        }

        if (currentPlayer) {
            currentPlayer.update(delta);
        }

        this.updateStatusText();
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver) return false;
        // W trybie SOLO zawsze jest tura gracza (chyba że animacje trwają)
        if (AppConfig.gameMode === 'SOLO') {
            // Blokujemy input tylko jak coś się dzieje na planszy
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
            // Odejmujemy ruch tylko jeśli był udany i mamy limit
            if (this.currentLevel && this.currentLevel.moveLimit > 0) {
                this.movesLeft--;
            }
        }
    }

    // --- LOGIKA CELÓW ---
    private onBlockDestroyed(typeId: number) {
        if (!this.currentLevel || this.isGameOver) return;

        this.currentScore += 10;

        // Aktualizacja celów
        this.currentLevel.goals.forEach((goal, index) => {
            if (goal.type === 'COLLECT' && goal.targetId === typeId) {
                this.goalProgress[index]++;
            } else if (goal.type === 'SCORE') {
                this.goalProgress[index] = this.currentScore;
            }
        });

        this.checkWinLossCondition();
    }

    private checkWinLossCondition() {
        if (!this.currentLevel || this.isGameOver) return;

        // Czy wygrał?
        let allGoalsMet = true;
        this.currentLevel.goals.forEach((goal, index) => {
            if (this.goalProgress[index] < goal.amount) allGoalsMet = false;
        });

        if (allGoalsMet) {
            this.finishGame("LEVEL COMPLETE!", true);
            return;
        }

        // Czy przegrał (brak ruchów)?
        if (this.currentLevel.moveLimit > 0 && this.movesLeft <= 0 && !this.isProcessingTurn) {
            this.finishGame("OUT OF MOVES", false);
        }
    }

    private finishGame(reason: string, win: boolean) {
        this.isGameOver = true;
        this.gameStatusText = win ? "VICTORY!" : "DEFEAT";
        console.log(`🏁 GAME OVER: ${reason} (Win: ${win})`);
        if (this.onGameFinished) this.onGameFinished(reason, win);
    }

    private updateStatusText() {
        if (!this.currentLevel) return;
        let status = "";

        // Cele
        this.currentLevel.goals.forEach((goal, i) => {
            const current = this.goalProgress[i];
            const max = goal.amount;
            if (goal.type === 'COLLECT') status += `Collect ID ${goal.targetId}: ${current}/${max}\n`;
            else status += `Score: ${current}/${max}\n`;
        });

        // Limity
        if (this.currentLevel.moveLimit > 0) status += `Moves: ${this.movesLeft}`;
        else if (this.currentLevel.timeLimit > 0) status += `Time: ${Math.ceil(this.timeLeft)}s`;

        this.gameStatusText = status;
    }

    private startTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.logic.statsEnabled = true;

        // Sprawdzenie deadlocka na początku tury
        const hint = this.logic.findHint();
        if (!hint) {
            console.log("Fixing Deadlock...");
            const fix = this.logic.findDeadlockFix();
            if (fix) {
                this.logic.cells[fix.id].typeId = fix.targetType;
                if (this.onDeadlockFixed) this.onDeadlockFixed(fix.id, fix.targetType);
            }
        }
        this.turnTimer = TURN_TIME_LIMIT;
        currentPlayer.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;
        this.checkWinLossCondition();
        if (!this.isGameOver) {
            // W trybie SOLO tura jest ciągła, w VS zmieniamy gracza
            if (AppConfig.gameMode === 'VS_AI') {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            }
            this.startTurn();
        }
    }
}