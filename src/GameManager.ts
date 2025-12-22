import { BoardLogic } from './BoardLogic';
import { PlayerController } from './PlayerController';
import { 
    PLAYER_ID_1, TURN_TIME_LIMIT, CellState, AppConfig 
} from './Config';

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    public turnTimer: number = 0;
    private isProcessingTurn: boolean = false; 

    public isGameOver: boolean = false;
    public globalMovesMade: number = 0;
    public globalTimeElapsed: number = 0;
    
    public gameStatusText: string = "";

    public onGameFinished: ((reason: string) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;

    constructor(logic: BoardLogic) {
        this.logic = logic;
        this.turnTimer = TURN_TIME_LIMIT;
    }

    public registerPlayer(player: PlayerController) {
        this.players.push(player);
    }

    public clearPlayers() {
        this.players = [];
    }

    public startGame() {
        this.currentPlayerIndex = 0;
        this.turnTimer = TURN_TIME_LIMIT;
        this.isProcessingTurn = false;
        this.isGameOver = false;
        this.globalMovesMade = 0;
        this.globalTimeElapsed = 0;
        
        // Reset planszy (fizyki)
        this.logic.initBoard();

        console.log("=== GAME STARTED ===");
        this.startTurn();
    }

    // Nowa metoda do resetu przy wyjściu do menu
    public resetGame() {
        this.isGameOver = true;
        this.players = [];
    }

    public update(delta: number) {
        if (this.isGameOver) return;

        const currentPlayer = this.players[this.currentPlayerIndex];

        // 1. Globalny Czas Gry (jeśli włączony)
        if (AppConfig.limitMode === 'TIME') {
            // Czas globalny płynie tylko podczas tury gracza (chyba że to Solo)
            if (currentPlayer.id === PLAYER_ID_1) {
                this.globalTimeElapsed += delta / 60.0;
                if (this.globalTimeElapsed >= AppConfig.limitValue) {
                    this.finishGame("TIME_LIMIT_REACHED");
                    return;
                }
            }
        }

        if (AppConfig.gameMode !== 'SOLO') {
            if (!this.logic.cells.every(c => c.state === CellState.IDLE)) {
                this.isProcessingTurn = true;
                return; 
            }
            if (this.isProcessingTurn) {
                this.isProcessingTurn = false;
                this.endTurn(); 
                return;
            }
            const dt = delta / 60.0;
            this.turnTimer -= dt;
            
            if (this.turnTimer <= 0) {
                console.log("⏰ TURN TIME OUT! Skipped.");
                
                // --- POPRAWKA: Timeout też zużywa ruch w trybie MOVES ---
                if (currentPlayer.id === PLAYER_ID_1 && AppConfig.limitMode === 'MOVES') {
                    this.globalMovesMade++;
                    // Sprawdzamy czy to nie był ostatni ruch
                    if (this.globalMovesMade >= AppConfig.limitValue) {
                        this.finishGame("MOVE_LIMIT_REACHED");
                        return;
                    }
                }

                this.endTurn();
                return;
            }
        }

        if (currentPlayer) {
            currentPlayer.update(delta);
        }

        if (AppConfig.gameMode === 'SOLO') {
            this.gameStatusText = "SOLO MODE\n(Active)";
        } else {
            const turnOwner = this.currentPlayerIndex === 0 ? "PLAYER 1" : "PLAYER 2 (BOT)";
            this.gameStatusText = `${turnOwner}\nTurn Time: ${this.turnTimer.toFixed(1)}s`;
        }
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver) return false;
        
        if (AppConfig.gameMode === 'SOLO') {
            return this.players[this.currentPlayerIndex].id === playerId;
        }

        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        return boardIdle && this.players[this.currentPlayerIndex].id === playerId;
    }

    public requestMove(playerId: number, idxA: number, dirX: number, dirY: number) {
        if (!this.isMyTurn(playerId)) return;

        const result = this.logic.trySwap(idxA, dirX, dirY);

        if (result.success) {
            if (playerId === PLAYER_ID_1 && AppConfig.limitMode === 'MOVES') {
                this.globalMovesMade++;
                if (this.globalMovesMade >= AppConfig.limitValue) {
                    this.finishGame("MOVE_LIMIT_REACHED");
                    return;
                }
            }
        }
    }

    private startTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        if (AppConfig.gameMode === 'SOLO') {
            this.logic.statsEnabled = true;
        } else {
            this.logic.statsEnabled = (currentPlayer.id === PLAYER_ID_1);
        }

        console.log(`▶ Start Turn: Player ${currentPlayer.id}`);

        const hint = this.logic.findHint();
        if (!hint) {
            console.log("🔒 DEADLOCK DETECTED at Turn Start! Fixing...");
            const fix = this.logic.findDeadlockFix();
            if (fix) {
                this.logic.cells[fix.id].typeId = fix.targetType;
                if (this.onDeadlockFixed) {
                    this.onDeadlockFixed(fix.id, fix.targetType);
                }
            } else {
                console.log("💀 Fatal Deadlock.");
            }
        }

        this.turnTimer = TURN_TIME_LIMIT;
        currentPlayer.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;

        const groupSize = this.logic.getLastMoveGroupSize();
        if (groupSize >= 4) {
            console.log("✨ EXTRA TURN! (Match 4+)");
            this.startTurn(); 
            return;
        }

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.startTurn();
    }

    private finishGame(reason: string) {
        this.isGameOver = true;
        this.gameStatusText = "GAME OVER";
        console.log(`🏁 GAME OVER: ${reason}`);
        if (this.onGameFinished) this.onGameFinished(reason);
    }
}