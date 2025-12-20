import { BoardLogic } from './BoardLogic';
import { PlayerController } from './PlayerController';
import { 
    type GameMode, PLAYER_ID_1, TURN_TIME_LIMIT, CellState, 
    GAME_LIMIT_MODE, GAME_LIMIT_VALUE 
} from './Config';

export class GameManager {
    private logic: BoardLogic;
    private players: PlayerController[] = [];
    private currentPlayerIndex: number = 0;

    // Stan Tury
    public turnTimer: number = 0;
    private isProcessingTurn: boolean = false; 

    // Stan Gry Globalny
    public isGameOver: boolean = false;
    public globalMovesMade: number = 0;
    public globalTimeElapsed: number = 0;
    
    // Status do UI
    public gameStatusText: string = "";

    // Callbacki dla main.ts (wizualizacja)
    public onGameFinished: ((reason: string) => void) | null = null;
    public onDeadlockFixed: ((id: number, type: number) => void) | null = null;

    constructor(logic: BoardLogic) {
        this.logic = logic;
        this.turnTimer = TURN_TIME_LIMIT;
    }

    public registerPlayer(player: PlayerController) {
        this.players.push(player);
    }

    public startGame() {
        this.currentPlayerIndex = 0;
        this.turnTimer = TURN_TIME_LIMIT;
        this.isProcessingTurn = false;
        this.isGameOver = false;
        
        // Reset limitów
        this.globalMovesMade = 0;
        this.globalTimeElapsed = 0;

        console.log("=== GAME STARTED ===");
        this.startTurn();
    }

    public update(delta: number) {
        if (this.isGameOver) return;

        // 1. Sprawdzenie Globalnego Limitu Czasu Gry
        if (GAME_LIMIT_MODE === 'TIME') {
            this.globalTimeElapsed += delta / 60.0;
            if (this.globalTimeElapsed >= GAME_LIMIT_VALUE) {
                this.finishGame("TIME_LIMIT_REACHED");
                return;
            }
        }

        // 2. Jeśli plansza pracuje -> czekamy
        if (!this.logic.cells.every(c => c.state === CellState.IDLE)) {
            this.isProcessingTurn = true;
            return; 
        }

        // 3. Koniec animacji -> Zakończ turę
        if (this.isProcessingTurn) {
            this.isProcessingTurn = false;
            this.endTurn(); 
            return;
        }

        // 4. Odliczanie czasu tury
        const dt = delta / 60.0;
        this.turnTimer -= dt;

        if (this.turnTimer <= 0) {
            console.log("⏰ TURN TIME OUT! Skipped.");
            this.endTurn();
            return;
        }

        // 5. Update bota (jeśli jego tura)
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer) {
            currentPlayer.update(delta);
        }

        // Info do UI
        const turnOwner = this.currentPlayerIndex === 0 ? "PLAYER 1" : "PLAYER 2 (BOT)";
        this.gameStatusText = `${turnOwner}\nTurn Time: ${this.turnTimer.toFixed(1)}s`;
    }

    public isMyTurn(playerId: number): boolean {
        if (this.isGameOver) return false;
        const boardIdle = this.logic.cells.every(c => c.state === CellState.IDLE);
        return boardIdle && this.players[this.currentPlayerIndex].id === playerId;
    }

    public requestMove(playerId: number, idxA: number, dirX: number, dirY: number) {
        if (!this.isMyTurn(playerId)) return;

        const result = this.logic.trySwap(idxA, dirX, dirY);

        if (result.success) {
            // Jeśli to tura Gracza 1, to zliczamy to do Globalnego Limitu Ruchów
            // (Zwykle w VS liczymy po prostu "tury", ale tutaj liczmy ruchy P1)
            if (playerId === PLAYER_ID_1 && GAME_LIMIT_MODE === 'MOVES') {
                this.globalMovesMade++;
                if (this.globalMovesMade >= GAME_LIMIT_VALUE) {
                    this.finishGame("MOVE_LIMIT_REACHED");
                    return;
                }
            }
        }
    }

    private startTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        // Ustawiamy flagę w Logic, czy zliczać statystyki
        this.logic.statsEnabled = (currentPlayer.id === PLAYER_ID_1);

        console.log(`▶ Start Turn: Player ${currentPlayer.id}`);

        // --- OBSŁUGA DEADLOCKA (Niezależnie od gracza) ---
        // Sprawdzamy, czy jest ruch. Jeśli nie - naprawiamy.
        const hint = this.logic.findHint();
        if (!hint) {
            console.log("🔒 DEADLOCK DETECTED at Turn Start! Fixing...");
            const fix = this.logic.findDeadlockFix();
            
            if (fix) {
                // Aplikujemy naprawę logiczną
                this.logic.cells[fix.id].typeId = fix.targetType;
                
                // Powiadamiamy main.ts o efektach wizualnych
                if (this.onDeadlockFixed) {
                    this.onDeadlockFixed(fix.id, fix.targetType);
                }
                
                // Po naprawie, gracz może kontynuować turę
            } else {
                // Sytuacja ekstremalna - shuffle (tu pomijamy dla uproszczenia)
                console.log("💀 Fatal Deadlock.");
            }
        }

        this.turnTimer = TURN_TIME_LIMIT;
        currentPlayer.onTurnStart();
    }

    private endTurn() {
        if (this.isGameOver) return;

        // Sprawdzamy Bonus (Extra Turn)
        const groupSize = this.logic.getLastMoveGroupSize();
        if (groupSize >= 4) {
            console.log("✨ EXTRA TURN! (Match 4+)");
            this.startTurn(); // Ta sama osoba rusza jeszcze raz
            return;
        }

        // Zmiana gracza
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