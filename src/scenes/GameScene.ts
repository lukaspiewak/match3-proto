import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BoardLogic } from '../BoardLogic';
import { GameManager } from '../GameManager';
import { SoundManager } from '../SoundManager';
import { ScoreUI } from '../ScoreUI';
import { HumanPlayerController, BotPlayerController } from '../PlayerController';
import { Button } from '../ui/Button';
import { BoardRenderer } from '../views/BoardRenderer'; 
import { 
    COLS, ROWS, TILE_SIZE, 
    PLAYER_ID_1, PLAYER_ID_2, AppConfig, CurrentTheme, VisualConfig 
} from '../Config';
import { Random } from '../Random';
import { BlockRegistry } from '../BlockDef';
import { type LevelConfig, LEVEL_1 } from '../LevelDef'; 
import { Resources } from '../core/ResourceManager';
import { Buildings } from '../core/BuildingManager';

export class GameScene extends PIXI.Container implements Scene {
    private app: PIXI.Application;
    private logic: BoardLogic;
    private gameManager: GameManager;
    private soundManager: SoundManager;
    private renderer: BoardRenderer; 
    
    // Elementy HUD
    private hudContainer: PIXI.Container; 
    private scoreUI!: ScoreUI;
    private botScoreUI!: ScoreUI;
    private timerBarBg!: PIXI.Graphics;
    private timerBarFill!: PIXI.Graphics;
    private exitBtn!: Button; 
    
    // Status (opcjonalny, teraz mniej ważny)
    private statusText!: PIXI.Text;
    
    private backToMenuCallback: () => void;
    private pendingLevelConfig: LevelConfig | null = null;

    // Logiczne wymiary samej planszy (do skalowania)
    // Używamy tego do obliczania skali, zamiast pełnego GAME_LOGICAL_WIDTH
    private readonly BOARD_LOGICAL_WIDTH = (COLS * TILE_SIZE);
    private readonly BOARD_LOGICAL_HEIGHT = (ROWS * TILE_SIZE);

    constructor(app: PIXI.Application, backToMenuCallback: () => void) {
        super();
        this.app = app;
        this.backToMenuCallback = backToMenuCallback;

        this.soundManager = new SoundManager();
        this.logic = new BoardLogic();
        
        // 1. Warstwa Gry (Plansza)
        this.renderer = new BoardRenderer(app, this.logic);
        this.addChild(this.renderer); 

        // 2. Warstwa HUD (Interfejs - zawsze na wierzchu)
        this.hudContainer = new PIXI.Container();
        this.addChild(this.hudContainer);

        this.logic.onBadMove = () => { 
            this.soundManager.playBadMove(); 
            if (navigator.vibrate) navigator.vibrate(50); 
            this.renderer.triggerShake(0.2, 3);
        };

        this.gameManager = new GameManager(this.logic);
        this.setupUI();
        
        this.gameManager.onGameFinished = (reason, win) => this.onGameFinished(reason, win);
    }

    public setCurrentLevel(level: LevelConfig) {
        this.pendingLevelConfig = level;
    }

    private setupUI() {
        // Wszystko dodajemy do hudContainer
        
        // 1. Pasek czasu/ruchów (na samej górze)
        this.timerBarBg = new PIXI.Graphics();
        // Rysujemy wstępnie, resize to poprawi
        this.timerBarBg.rect(0, 0, 100, 6); 
        this.timerBarBg.fill({ color: 0x000000, alpha: 0.5 });
        this.hudContainer.addChild(this.timerBarBg);

        this.timerBarFill = new PIXI.Graphics();
        this.hudContainer.addChild(this.timerBarFill);

        // 2. Przycisk wyjścia (wstępnie)
        this.exitBtn = new Button("⏏️", 50, 50, 0x000000, () => {
            this.gameManager.resetGame();
            this.backToMenuCallback();
        }, true); 
        this.hudContainer.addChild(this.exitBtn);

        // 3. Status text (opcjonalny debug)
        this.statusText = new PIXI.Text({
            text: '',
            style: { fontFamily: 'Arial', fontSize: 12, fill: CurrentTheme.textMuted, align: 'center' }
        });
        this.statusText.anchor.set(0.5, 0);
        this.statusText.visible = false; 
        this.hudContainer.addChild(this.statusText);
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        const activeBlocks = BlockRegistry.getAll().slice(0, AppConfig.blockTypes);
        const activeBlockIds = activeBlocks.map(b => b.id);
        
        // Reset Score UI
        if (this.scoreUI) this.hudContainer.removeChild(this.scoreUI.container);
        if (this.botScoreUI) this.hudContainer.removeChild(this.botScoreUI.container);

        // Tworzymy ScoreUI
        this.scoreUI = new ScoreUI(activeBlockIds, 0, 0);
        this.hudContainer.addChild(this.scoreUI.container);

        // Bot UI
        this.botScoreUI = new ScoreUI(activeBlockIds, 0, 0);
        this.botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');
        this.hudContainer.addChild(this.botScoreUI.container);

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

        // --- KONFIGURACJA PRZYCISKU EXIT I PASKÓW ---
        const mode = this.gameManager.currentLevelMode;

        if (mode === 'GATHERING') {
            this.updateExitButton("🚚", () => this.gameManager.finishExpedition());
            activeBlockIds.forEach(id => {
                const current = Resources.getAmount(id);
                const max = Buildings.getResourceCapacity(id);
                this.scoreUI.updateState(id, current, max > 0 ? current / max : 0);
            });
        } else if (mode === 'CONSTRUCTION') {
            this.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
            activeBlockIds.forEach(id => {
                const amount = this.gameManager.getSessionResourceAmount(id);
                const start = this.gameManager.getStartResourceAmount(id);
                const ratio = start > 0 ? amount / start : 0;
                this.scoreUI.updateState(id, amount, ratio);
            });
        } else {
            this.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
            this.scoreUI.reset(100); 
        }

        this.logic.removeAllListeners(); 
        this.renderer.bindEvents(); 
        this.gameManager.bindEvents();
        this.gameManager.onDeadlockFixed = (id, type) => this.onDeadlockFixed(id, type);
        
        this.logic.on('explode', (data: { id: number, typeId: number, x: number, y: number }) => {
            const currentId = this.gameManager.getCurrentPlayerId();
            
            if (this.gameManager.currentLevelMode === 'GATHERING') {
                const global = Resources.getAmount(data.typeId);
                const session = this.gameManager.getSessionResourceAmount(data.typeId);
                const total = global + session;
                const max = Buildings.getResourceCapacity(data.typeId);
                this.scoreUI.updateState(data.typeId, total, max > 0 ? total / max : 0);
            } else if (this.gameManager.currentLevelMode === 'CONSTRUCTION') {
                const amount = this.gameManager.getSessionResourceAmount(data.typeId);
                const start = this.gameManager.getStartResourceAmount(data.typeId);
                const ratio = start > 0 ? amount / start : 0;
                this.scoreUI.updateState(data.typeId, amount, ratio);
            } else {
                const amount = this.gameManager.getSessionResourceAmount(data.typeId);
                this.scoreUI.updateState(data.typeId, amount, 1.0); 
            }
            this.soundManager.playPop();
            if (navigator.vibrate) navigator.vibrate(20);
        });

        this.logic.on('hint', (indices: number[]) => { this.renderer.setHints(indices); });
        this.logic.on('deadlock', (fix: { id: number, targetType: number }) => {
             this.logic.cells[fix.id].typeId = fix.targetType;
             this.onDeadlockFixed(fix.id, fix.targetType);
        });

        // Wymuszamy resize, żeby wszystko się ułożyło
        this.resize(this.app.screen.width, this.app.screen.height);
    }

    private updateExitButton(text: string, callback: () => void) {
        this.hudContainer.removeChild(this.exitBtn);
        this.exitBtn = new Button(text, 50, 50, 0x000000, callback, true);
        this.hudContainer.addChild(this.exitBtn);
        // Pozycja zostanie nadana w resize() (wywołane w onShow)
    }

    public update(delta: number) {
        this.gameManager.update(delta);
        this.logic.update(delta);
        if (this.scoreUI) this.scoreUI.update(delta);
        
        this.updateTimeBar();
        
        const human = this.gameManager['players'].find(p => p.id === PLAYER_ID_1) as HumanPlayerController; 
        const selectedId = human ? human.getSelectedId() : -1;
        this.renderer.update(delta, selectedId);
    }

    private updateTimeBar() {
        this.timerBarFill.clear();
        const width = this.app.screen.width; 
        
        let percent = 0;
        let color = 0x00FF00;

        if (this.gameManager.movesLeft < 0) {
            percent = 1.0;
            color = 0x00AAFF; 
        } else if (this.gameManager.maxMoves > 0) {
            percent = this.gameManager.movesLeft / this.gameManager.maxMoves;
        } else if (this.gameManager.maxTime > 0) {
            percent = this.gameManager.timeLeft / this.gameManager.maxTime;
        }

        if (percent <= 0.2) color = 0xFF0000; 
        else if (percent <= 0.5) color = 0xFFA500; 

        this.timerBarFill.rect(0, 0, width * percent, 6);
        this.timerBarFill.fill(color);
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
        // 1. Reset pozycji kontenera (przyklejamy do lewej góry)
        this.x = 0;
        this.y = 0;
        this.scale.set(1);

        const HEADER_HEIGHT = 60; // Zarezerwowane miejsce na HUD
        const PADDING = 10;
        const BOTTOM_PADDING = 20; // Odstęp planszy od dołu ekranu

        // --- 2. Pozycjonowanie HUD (Przyklejone do góry) ---
        
        // Pasek czasu na pełną szerokość
        this.timerBarBg.clear();
        this.timerBarBg.rect(0, 0, width, 6);
        this.timerBarBg.fill({ color: 0x000000, alpha: 0.5 });
        this.updateTimeBar();

        // ScoreUI (Lewy Górny róg)
        if (this.scoreUI) {
            this.scoreUI.container.x = PADDING;
            this.scoreUI.container.y = 15; // Trochę pod paskiem czasu
        }

        // Exit Button (Prawy Górny róg)
        if (this.exitBtn) {
            this.exitBtn.x = width - 40; 
            this.exitBtn.y = 35; // Wycentrowane w pionie HUDa
        }

        // Bot UI (obok Exit Button)
        if (this.botScoreUI && this.botScoreUI.container.visible) {
            this.botScoreUI.container.x = width - 250; 
            this.botScoreUI.container.y = 15;
        }

        // --- 3. Pozycjonowanie PLANSZY (Przyklejone do dołu) ---
        
        const availableWidth = width;
        // Dostępna wysokość to wszystko pod HUD-em, minus margines dolny
        const availableHeight = height - HEADER_HEIGHT - BOTTOM_PADDING; 
        
        // Obliczamy skalę, żeby plansza zmieściła się w dostępnym obszarze
        // (zarówno na szerokość jak i na wysokość)
        const scale = Math.min(
            (availableWidth - 20) / this.BOARD_LOGICAL_WIDTH, 
            availableHeight / this.BOARD_LOGICAL_HEIGHT
        ); 
        
        this.renderer.scale.set(scale);

        // Centrowanie w poziomie (X)
        this.renderer.x = (width - (this.BOARD_LOGICAL_WIDTH * scale)) / 2;
        
        // Przyciąganie do dołu (Y)
        // Pozycja Y = Wysokość ekranu - Wysokość planszy po skalowaniu - Margines dolny
        this.renderer.y = height - (this.BOARD_LOGICAL_HEIGHT * scale) - BOTTOM_PADDING;
    }
}