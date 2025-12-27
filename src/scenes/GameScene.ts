import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BoardLogic } from '../BoardLogic';
import { GameManager } from '../GameManager';
import { SoundManager } from '../SoundManager';
import { HumanPlayerController, BotPlayerController } from '../PlayerController';
import { BoardRenderer } from '../views/BoardRenderer'; 
import { GameHUD, type BarMetric } from '../views/GameHUD'; // Importujemy nowy HUD
import { 
    COLS, ROWS, TILE_SIZE, 
    PLAYER_ID_1, PLAYER_ID_2, AppConfig, CurrentTheme 
} from '../Config';
import { Random } from '../Random';
import { BlockRegistry } from '../BlockDef';
import { type LevelConfig, LEVEL_1 } from '../LevelDef'; 

export class GameScene extends PIXI.Container implements Scene {
    private app: PIXI.Application;
    private logic: BoardLogic;
    private gameManager: GameManager;
    private soundManager: SoundManager;
    private renderer: BoardRenderer; 
    
    // Zamiast luźnych zmiennych, mamy jedną klasę HUD
    private hud: GameHUD;
    
    private backToMenuCallback: () => void;
    private pendingLevelConfig: LevelConfig | null = null;

    private readonly BOARD_LOGICAL_WIDTH = (COLS * TILE_SIZE);
    private readonly BOARD_LOGICAL_HEIGHT = (ROWS * TILE_SIZE);

    constructor(app: PIXI.Application, backToMenuCallback: () => void) {
        super();
        this.app = app;
        this.backToMenuCallback = backToMenuCallback;

        this.soundManager = new SoundManager();
        this.logic = new BoardLogic();
        
        // 1. Warstwa Gry
        this.renderer = new BoardRenderer(app, this.logic);
        this.addChild(this.renderer); 

        // 2. Warstwa HUD (GameHUD dziedziczy po Container)
        // Przekazujemy callback do wyjścia już w konstruktorze
        this.hud = new GameHUD(() => {
            this.gameManager.resetGame();
            this.backToMenuCallback();
        });
        this.addChild(this.hud);

        this.logic.onBadMove = () => { 
            this.soundManager.playBadMove(); 
            if (navigator.vibrate) navigator.vibrate(50); 
            this.renderer.triggerShake(0.2, 3);
        };

        this.gameManager = new GameManager(this.logic);
        // setupUI() usunięte, bo robi to GameHUD w konstruktorze
        
        this.gameManager.onGameFinished = (reason, win) => this.onGameFinished(reason, win);
    }

    public setCurrentLevel(level: LevelConfig) {
        this.pendingLevelConfig = level;
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        const activeBlocks = BlockRegistry.getAll().slice(0, AppConfig.blockTypes);
        const activeBlockIds = activeBlocks.map(b => b.id);
        
        // Inicjalizacja HUD (tworzenie slotów dla surowców)
        this.hud.init(activeBlockIds);

        // Setup Graczy
        const inputContainer = this.renderer.getInputContainer();
        const human = new HumanPlayerController(PLAYER_ID_1, this.gameManager, this.logic, inputContainer, this.soundManager);
        this.gameManager.registerPlayer(human);

        if (AppConfig.gameMode === 'VS_AI') {
            const bot = new BotPlayerController(PLAYER_ID_2, this.gameManager, this.logic);
            this.gameManager.registerPlayer(bot);
        }

        this.renderer.initVisuals();

        const levelToLoad = this.pendingLevelConfig || LEVEL_1; 
        this.gameManager.startLevel(levelToLoad); 

        // Konfiguracja przycisku i wartości początkowych w HUD
        const mode = this.gameManager.currentLevelMode;

        if (mode === 'GATHERING') {
            this.hud.updateExitButton("🚚", () => this.gameManager.finishExpedition());
        } else if (mode === 'CONSTRUCTION') {
            this.hud.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
        } else {
            this.hud.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
        }
        
        // Inicjalne wartości pasków
        this.hud.updateScoresForMode(mode, 
            (id) => this.gameManager.getSessionResourceAmount(id), 
            (id) => this.gameManager.getStartResourceAmount(id), 
            activeBlockIds
        );

        // Ukrywanie bota w solo
        if (AppConfig.gameMode === 'SOLO') {
            this.hud.botScoreUI.container.visible = false;
        } else {
            this.hud.botScoreUI.container.visible = true;
            this.hud.botScoreUI.reset();
        }

        this.logic.removeAllListeners(); 
        this.renderer.bindEvents(); 
        this.gameManager.bindEvents();
        this.gameManager.onDeadlockFixed = (id, type) => this.onDeadlockFixed(id, type);
        
        // --- GAME LOOP UPDATE ---
        this.logic.on('explode', (data: { id: number, typeId: number, x: number, y: number }) => {
            const currentId = this.gameManager.getCurrentPlayerId();
            
            // Jeśli to tura bota, aktualizujemy jego UI
            if (AppConfig.gameMode === 'VS_AI' && currentId === PLAYER_ID_2) {
                // Tutaj uproszczenie: bot w trybie construction/gathering działałby tak samo jak gracz
                // W trybie standard po prostu +1
                this.hud.updateScore(data.typeId, this.gameManager.getSessionResourceAmount(data.typeId), 1.0, true);
            } else {
                // Aktualizacja UI gracza (używamy helpera z HUD)
                this.hud.updateScoresForMode(mode, 
                    (id) => this.gameManager.getSessionResourceAmount(id), 
                    (id) => this.gameManager.getStartResourceAmount(id), 
                    [data.typeId] // Aktualizujemy tylko ten jeden typ
                );
            }

            this.soundManager.playPop();
            if (navigator.vibrate) navigator.vibrate(20);
        });

        this.logic.on('hint', (indices: number[]) => { this.renderer.setHints(indices); });
        this.logic.on('deadlock', (fix: { id: number, targetType: number }) => {
             this.logic.cells[fix.id].typeId = fix.targetType;
             this.onDeadlockFixed(fix.id, fix.targetType);
        });

        // Wymuszamy resize
        this.resize(this.app.screen.width, this.app.screen.height);
    }

    public update(delta: number) {
        this.gameManager.update(delta);
        this.logic.update(delta);
        
        if (this.hud.scoreUI) this.hud.scoreUI.update(delta);
        this.updateBars(); // Oblicza metryki i wysyła do HUD
        
        const human = this.gameManager['players'].find(p => p.id === PLAYER_ID_1) as HumanPlayerController; 
        const selectedId = human ? human.getSelectedId() : -1;
        this.renderer.update(delta, selectedId);
    }

    private updateBars() {
        const turnTimer = this.gameManager.turnTimer;
        const maxTurn = this.gameManager.maxTurnTime;
        const levelTime = this.gameManager.timeLeft;
        const maxLevelTime = this.gameManager.maxTime;
        const moves = this.gameManager.movesLeft;
        const maxMoves = this.gameManager.maxMoves;

        const isVs = AppConfig.gameMode !== 'SOLO';
        const hasTimeLimit = maxLevelTime > 0;
        const hasMoveLimit = maxMoves > 0;

        const metrics: BarMetric[] = [];

        // 1. Priorytet: Czas Tury
        if (isVs) {
            let p = turnTimer / maxTurn;
            let c = 0x00AAFF; 
            if (p < 0.3) c = 0xFF0000;
            metrics.push({ percent: p, color: c });
        } else if (hasTimeLimit) {
            let p = levelTime / maxLevelTime;
            let c = 0x00FF00; 
            if (p < 0.2) c = 0xFF0000; else if (p < 0.5) c = 0xFFA500;
            metrics.push({ percent: p, color: c });
        }

        // 2. Priorytet: Ruchy
        if (hasMoveLimit) {
            let p = moves / maxMoves;
            let c = 0xFFA500; 
            if (p < 0.2) c = 0xFF0000;
            metrics.push({ percent: p, color: c });
        } else if (isVs && hasTimeLimit) {
            let p = levelTime / maxLevelTime;
            let c = 0x00FF00;
            metrics.push({ percent: p, color: c });
        } else if (moves < 0 && metrics.length === 0) {
            // Freeplay
            metrics.push({ percent: 1.0, color: 0x00AAFF });
        }

        // Wysyłamy do HUD
        this.hud.updateTimeBars(metrics, this.app.screen.width);
    }

    private onDeadlockFixed(id: number, type: number) {
        this.soundManager.playPop();
        this.renderer.setHints([]);
    }

    private onGameFinished(reason: string, win: boolean) {
        const width = this.app.screen.width;
        const height = this.app.screen.height;

        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, width, height);
        overlay.fill({ color: 0x000000, alpha: 0.85 });
        this.addChild(overlay); 
        
        const color = win ? 0x00FF00 : 0xFF0000;
        const title = win ? "VICTORY!" : "GAME OVER";
        const isGathering = this.gameManager.currentLevelMode === 'GATHERING';
        const displayTitle = isGathering ? "EXPEDITION ENDED" : title;
        const displayColor = isGathering ? 0xD97706 : color;

        const text = new PIXI.Text({ 
            text: `${displayTitle}\n${reason}\n\nClick to Menu`, 
            style: { fill: displayColor, fontSize: 36, fontWeight: 'bold', align: 'center', stroke: { color: 0xFFFFFF, width: 4 } }
        });
        text.anchor.set(0.5);
        text.x = width / 2; text.y = height / 2;
        this.addChild(text);

        text.eventMode = 'static';
        text.cursor = 'pointer';
        text.on('pointerdown', () => {
            this.removeChild(overlay);
            this.removeChild(text);
            this.backToMenuCallback();
        });
    }

    public resize(width: number, height: number) {
        this.x = 0; this.y = 0; this.scale.set(1);

        // 1. Zlecamy HUDowi ułożenie swoich elementów
        this.hud.resize(width, height);

        // 2. Pobieramy od HUDa bezpieczny obszar dla planszy
        const safeArea = this.hud.safeBoardArea;
        
        // 3. Skalujemy i centrujemy planszę w tym obszarze
        const availableWidth = height > width ? width : width * 0.5; // W poziomie ograniczamy szerokość
        const availableHeight = safeArea.height;

        const scale = Math.min(
            (availableWidth - 20) / this.BOARD_LOGICAL_WIDTH, 
            availableHeight / this.BOARD_LOGICAL_HEIGHT
        );
        
        this.renderer.scale.set(scale);
        this.renderer.x = (width - (this.BOARD_LOGICAL_WIDTH * scale)) / 2;
        // Plansza zawsze przyklejona do dołu bezpiecznego obszaru (minus margines)
        this.renderer.y = (safeArea.y + safeArea.height) - (this.BOARD_LOGICAL_HEIGHT * scale);
        
        // Fix: Jeśli plansza "ucieka" za wysoko w poziomie, centrujemy ją w Y
        if (width > height) {
             this.renderer.y = safeArea.y + (safeArea.height - (this.BOARD_LOGICAL_HEIGHT * scale)) / 2;
        }
    }
}