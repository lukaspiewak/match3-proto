import { BoardLogic } from './BoardLogic';
import { PlayerController } from './PlayerController';
import { 
    PLAYER_ID_1, TURN_TIME_LIMIT, CellState, AppConfig 
} from './Config';
import { type LevelConfig } from './LevelDef';
import { Resources } from './core/ResourceManager';
// USUNIĘTO import Buildings - GameManager nie musi już o nim wiedzieć!

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    private currentLevel: LevelConfig | null = null;
    private goalProgress: number[] = [];
    private currentScore: number = 0;
    
    private sessionInventory: { [id: number]: number } = {};
    private startInventory: { [id: number]: number } = {};

    // Liczniki bieżące
    public movesLeft: number = 0;
    public timeLeft: number = 0;
    
    // Liczniki początkowe (do obliczania paska postępu w UI)
    public maxMoves: number = 0;
    public maxTime: number = 0;

    public turnTimer: number = 0;
    public get maxTurnTime(): number { return TURN_TIME_LIMIT; }

    private isProcessingTurn: boolean = false; 
    public isGameOver: boolean = false;
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

    // --- UI Helpers ---
    public getSessionResourceAmount(typeId: number): number { return this.sessionInventory[typeId] || 0; }
    public getStartResourceAmount(typeId: number): number { return this.startInventory[typeId] || 0; }
    public get currentLevelMode() { return this.currentLevel ? this.currentLevel.mode : 'STANDARD'; }

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

        // Initialize Limits
        this.movesLeft = level.moveLimit;
        this.maxMoves = level.moveLimit; 

        this.timeLeft = level.timeLimit;
        this.maxTime = level.timeLimit;

        this.goalProgress = level.goals.map(() => 0);
        
        // Initialize Inventory
        if (level.mode === 'CONSTRUCTION') {
            this.sessionInventory = Resources.getAll();
            this.startInventory = { ...this.sessionInventory };
            console.log("🏗️ Construction Start. Inventory:", this.sessionInventory);
        } else {
            this.sessionInventory = {};
            this.startInventory = {};
        }

        console.log(`Loading Level: ${level.id} (${level.mode})`);
        this.logic.initBoard(level.layout, level.availableBlockIds);
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

        if (this.players[this.currentPlayerIndex]) this.players[this.currentPlayerIndex].update(delta);
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

        // 1. CONSTRUCTION: Consume resources
        if (this.currentLevel.mode === 'CONSTRUCTION') {
            if (this.sessionInventory[typeId] === undefined) this.sessionInventory[typeId] = 0;
            this.sessionInventory[typeId]--; 
            
            if (this.sessionInventory[typeId] < 0) {
                this.finishGame(`BANKRUPTCY! (Ran out of Block ${typeId})`, false);
                return;
            }
        } 
        // 2. GATHERING: Collect with limit (ZMIANA: użycie Resources.hasSpace)
        else if (this.currentLevel.mode === 'GATHERING') {
            // Sprawdzamy w Resources czy mamy miejsce, przekazując ile już zebraliśmy w tej sesji
            const sessionAmount = this.sessionInventory[typeId] || 0;
            
            if (Resources.hasSpace(typeId, sessionAmount)) {
                if (!this.sessionInventory[typeId]) this.sessionInventory[typeId] = 0;
                this.sessionInventory[typeId]++;
            } else {
                console.log(`Inventory FULL for block ${typeId}`);
                // Surowiec przepada
            }
        }
        // 3. STANDARD: Collect freely
        else {
            if (!this.sessionInventory[typeId]) this.sessionInventory[typeId] = 0;
            this.sessionInventory[typeId]++;
        }

        // Update Goals
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
        if (this.currentLevel.mode === 'GATHERING') return;

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