import { BoardLogic } from './BoardLogic';
import { PlayerController } from './PlayerController';
import { 
    PLAYER_ID_1, TURN_TIME_LIMIT, CellState, AppConfig 
} from './Config';
import { type LevelConfig } from './LevelDef';
import { Resources } from './core/ResourceManager';

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    private currentLevel: LevelConfig | null = null;
    private goalProgress: number[] = [];
    private currentScore: number = 0;
    
    // Obecny stan zasobów w trakcie gry
    private sessionInventory: { [id: number]: number } = {};
    // NOWOŚĆ: Stan zasobów na początku poziomu (jako punkt odniesienia dla pasków)
    private startInventory: { [id: number]: number } = {};

    public movesLeft: number = 0;
    public timeLeft: number = 0;
    public turnTimer: number = 0;
    private isProcessingTurn: boolean = false; 
    public isGameOver: boolean = false;
    public globalMovesMade: number = 0; 
    public globalTimeElapsed: number = 0;
    public gameStatusText: string = "";

    public onGameFinished: ((reason: string, win: boolean) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;

    constructor(logic: BoardLogic) {
        this.logic = logic;
        this.turnTimer = TURN_TIME_LIMIT;
    }

    public bindEvents() {
        this.logic.off('explode', this.onExplodeHandler);
        this.logic.on('explode', this.onExplodeHandler);
    }

    private onExplodeHandler = (data: { id: number, typeId: number }) => {
        this.onBlockDestroyed(data.typeId);
    };

    // --- NOWE METODY POMOCNICZE DLA UI ---
    
    public getSessionResourceAmount(typeId: number): number {
        return this.sessionInventory[typeId] || 0;
    }

    // Zwraca ilość zasobu, jaką mieliśmy na starcie poziomu (do obliczania skali paska)
    public getStartResourceAmount(typeId: number): number {
        return this.startInventory[typeId] || 0;
    }

    public get currentLevelMode(): 'STANDARD' | 'CONSTRUCTION' {
        return this.currentLevel ? this.currentLevel.mode : 'STANDARD';
    }

    // ... (metody registerPlayer, clearPlayers, getCurrentPlayerId bez zmian) ...
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
        this.timeLeft = level.timeLimit;
        this.goalProgress = level.goals.map(() => 0);
        
        if (level.mode === 'CONSTRUCTION') {
            this.sessionInventory = Resources.getAll();
            // NOWOŚĆ: Kopiujemy stan początkowy
            this.startInventory = { ...this.sessionInventory };
            console.log("🏗️ Construction Mode: Loaded inventory:", this.sessionInventory);
        } else {
            this.sessionInventory = {};
            this.startInventory = {};
            console.log("🎒 Standard Mode: Loot bag empty.");
        }

        console.log(`Loading Level: ${level.id} (${level.mode})`);
        this.logic.initBoard(level.layout, level.availableBlockIds);

        this.updateStatusText();
        this.startTurn();
    }

    // ... (reszta metod bez zmian logicznych, skrócona dla czytelności) ...
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
        if (this.players[this.currentPlayerIndex]) this.players[this.currentPlayerIndex].update(delta);
        this.updateStatusText();
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver) return false;
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

        if (this.currentLevel.mode === 'CONSTRUCTION') {
            if (!this.sessionInventory[typeId]) this.sessionInventory[typeId] = 0;
            this.sessionInventory[typeId]--; 
            
            if (this.sessionInventory[typeId] < 0) {
                this.finishGame(`BANKRUPTCY! (Missing Block ${typeId})`, false);
                return;
            }
        } else {
            if (!this.sessionInventory[typeId]) this.sessionInventory[typeId] = 0;
            this.sessionInventory[typeId]++;
        }

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
        let allGoalsMet = true;
        this.currentLevel.goals.forEach((goal, index) => {
            if (this.goalProgress[index] < goal.amount) allGoalsMet = false;
        });
        if (allGoalsMet) {
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
            if (this.currentLevel.mode === 'CONSTRUCTION') {
                Resources.setInventory(this.sessionInventory);
            } else {
                for (const [id, amount] of Object.entries(this.sessionInventory)) {
                    Resources.addResource(parseInt(id), amount);
                }
            }
        }
        if (this.onGameFinished) this.onGameFinished(reason, win);
    }

    private updateStatusText() {
        if (!this.currentLevel) return;
        let status = "";
        if (this.currentLevel.mode === 'CONSTRUCTION') status += "[CONSTRUCTION MODE]\n";
        this.currentLevel.goals.forEach((goal, i) => {
            const current = this.goalProgress[i];
            const max = goal.amount;
            const label = this.currentLevel?.mode === 'CONSTRUCTION' && goal.type === 'COLLECT' ? 'Spend ID' : (goal.type === 'COLLECT' ? 'Collect ID' : 'Score');
            if (goal.type === 'COLLECT') status += `${label} ${goal.targetId}: ${current}/${max}\n`;
            else status += `${label}: ${current}/${max}\n`;
        });
        if (this.currentLevel.moveLimit > 0) status += `Moves: ${this.movesLeft}`;
        else if (this.currentLevel.timeLimit > 0) status += `Time: ${Math.ceil(this.timeLeft)}s`;
        this.gameStatusText = status;
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
        currentPlayer.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;
        this.checkWinLossCondition();
        if (!this.isGameOver) {
            if (AppConfig.gameMode === 'VS_AI') {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            }
            this.startTurn();
        }
    }
}