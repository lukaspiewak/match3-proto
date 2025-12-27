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
    
    // --- UI ELEMENTS ---
    private hudContainer: PIXI.Container; 
    private scoreUI!: ScoreUI;
    private botScoreUI!: ScoreUI; // UI dla drugiego gracza/bota
    private timerBarBg!: PIXI.Graphics;
    private timerBarFill!: PIXI.Graphics;
    private exitBtn!: Button; 
    private statusText!: PIXI.Text;
    
    // --- PANELE ---
    private panelLeft: PIXI.Container;
    private panelRight: PIXI.Container;
    private panelLeftBg: PIXI.Graphics;
    private panelRightBg: PIXI.Graphics;

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

        // 2. Warstwa Paneli
        this.panelLeft = new PIXI.Container();
        this.panelRight = new PIXI.Container();
        this.panelLeftBg = new PIXI.Graphics();
        this.panelRightBg = new PIXI.Graphics();
        
        this.panelLeft.addChild(this.panelLeftBg);
        this.panelRight.addChild(this.panelRightBg);
        
        this.addChild(this.panelLeft);
        this.addChild(this.panelRight);

        // 3. Warstwa HUD
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
        // --- HUD (tylko pasek i przycisk) ---
        this.timerBarBg = new PIXI.Graphics();
        this.timerBarBg.rect(0, 0, 100, 6); 
        this.timerBarBg.fill({ color: 0x000000, alpha: 0.5 });
        this.hudContainer.addChild(this.timerBarBg);

        this.timerBarFill = new PIXI.Graphics();
        this.hudContainer.addChild(this.timerBarFill);

        this.exitBtn = new Button("⏏️", 50, 50, 0x000000, () => {
            this.gameManager.resetGame();
            this.backToMenuCallback();
        }, true); 
        this.hudContainer.addChild(this.exitBtn);

        this.statusText = new PIXI.Text({
            text: '',
            style: { fontFamily: 'Arial', fontSize: 12, fill: CurrentTheme.textMuted, align: 'center' }
        });
        this.statusText.visible = false; 
        this.hudContainer.addChild(this.statusText);
        
        // Wstępne tła paneli (dla testów, w finalnej wersji można zrobić alpha 0 lub stylizować)
        // Tutaj dajemy przezroczyste tło, bo ScoreUI ma swoje
        const drawBg = (g: PIXI.Graphics) => {
            g.clear(); 
            g.rect(0,0,10,10); 
            // g.fill({ color: 0x000000, alpha: 0.0 }); // Całkowicie przezroczyste
        };
        drawBg(this.panelLeftBg);
        drawBg(this.panelRightBg);
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        const activeBlocks = BlockRegistry.getAll().slice(0, AppConfig.blockTypes);
        const activeBlockIds = activeBlocks.map(b => b.id);
        
        // Czyścimy stare UI
        if (this.scoreUI) {
            this.panelLeft.removeChild(this.scoreUI.container);
            this.scoreUI.container.destroy();
        }
        if (this.botScoreUI) {
            this.panelRight.removeChild(this.botScoreUI.container);
            this.botScoreUI.container.destroy();
        }

        // Tworzymy ScoreUI (bez podawania pozycji, bo pozycjonuje je panel)
        this.scoreUI = new ScoreUI(activeBlockIds);
        this.panelLeft.addChild(this.scoreUI.container);

        // UI dla bota / gracza 2
        this.botScoreUI = new ScoreUI(activeBlockIds);
        this.botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');
        this.panelRight.addChild(this.botScoreUI.container);

        // ... Setup graczy ...
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

        // Konfiguracja trybu i wstępne wartości pasków
        const mode = this.gameManager.currentLevelMode;

        // Pomocnicza funkcja do aktualizacji stanu pasków
        const initBars = (isBot: boolean, ui: ScoreUI) => {
             activeBlockIds.forEach(id => {
                // Dla bota możemy używać innych danych w przyszłości, 
                // na razie bot używa tego samego systemu co gracz (co jest uproszczeniem)
                // W trybie VS zasoby są wspólne lub osobne - tu zakładamy że patrzymy na gracza
                // TODO: Rozdzielić inventory dla gracza 2
                
                let current = 0, max = 1;
                if (mode === 'GATHERING') {
                     current = Resources.getAmount(id);
                     max = Buildings.getResourceCapacity(id);
                } else if (mode === 'CONSTRUCTION') {
                     current = this.gameManager.getSessionResourceAmount(id);
                     const start = this.gameManager.getStartResourceAmount(id);
                     max = start > 0 ? start : 1;
                } else {
                     current = this.gameManager.getSessionResourceAmount(id);
                     max = 1; // Standard rośnie
                }
                
                const ratio = mode === 'STANDARD' ? 1.0 : (max > 0 ? current / max : 0);
                ui.updateState(id, current, ratio);
            });
        };

        if (mode === 'GATHERING') {
            this.updateExitButton("🚚", () => this.gameManager.finishExpedition());
            initBars(false, this.scoreUI);
        } else if (mode === 'CONSTRUCTION') {
            this.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
            initBars(false, this.scoreUI);
        } else {
            this.updateExitButton("🏳️", () => { this.gameManager.resetGame(); this.backToMenuCallback(); });
            this.scoreUI.reset(); 
        }
        
        // Ukrywamy UI bota jeśli gramy solo
        if (AppConfig.gameMode === 'SOLO') {
            this.botScoreUI.container.visible = false;
        } else {
            this.botScoreUI.container.visible = true;
            this.botScoreUI.reset(); // Bot startuje od zera
        }

        this.logic.removeAllListeners(); 
        this.renderer.bindEvents(); 
        this.gameManager.bindEvents();
        this.gameManager.onDeadlockFixed = (id, type) => this.onDeadlockFixed(id, type);
        
        this.logic.on('explode', (data: { id: number, typeId: number, x: number, y: number }) => {
            const currentId = this.gameManager.getCurrentPlayerId();
            
            // Określ, które UI aktualizujemy
            let targetUI = this.scoreUI;
            if (AppConfig.gameMode === 'VS_AI' && currentId === PLAYER_ID_2) {
                targetUI = this.botScoreUI;
            }
            
            // Logika aktualizacji wartości (taka sama jak przy init)
            if (mode === 'GATHERING') {
                 const total = Resources.getAmount(data.typeId) + this.gameManager.getSessionResourceAmount(data.typeId);
                 const max = Buildings.getResourceCapacity(data.typeId);
                 targetUI.updateState(data.typeId, total, max > 0 ? total/max : 0);
            } else if (mode === 'CONSTRUCTION') {
                 const amount = this.gameManager.getSessionResourceAmount(data.typeId);
                 const start = this.gameManager.getStartResourceAmount(data.typeId);
                 targetUI.updateState(data.typeId, amount, start > 0 ? amount/start : 0);
            } else {
                 const amount = this.gameManager.getSessionResourceAmount(data.typeId);
                 targetUI.updateState(data.typeId, amount, 1.0);
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

    private updateExitButton(text: string, callback: () => void) {
        this.hudContainer.removeChild(this.exitBtn);
        this.exitBtn = new Button(text, 50, 50, 0x000000, callback, true);
        this.hudContainer.addChild(this.exitBtn);
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

        this.timerBarFill.rect(0, 0, width * percent, 6); // Ostre krawędzie
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
        this.x = 0; this.y = 0; this.scale.set(1);

        const HEADER_HEIGHT = 50; 
        const BOTTOM_PADDING = 20;
        const PANEL_GAP = 10; 

        const isPortrait = height > width;

        let reservedPanelHeight = 0; 
        if (isPortrait) {
            reservedPanelHeight = Math.max(120, height * 0.20); // 20% ekranu na panele w pionie
        }

        // HUD Resize
        this.timerBarBg.clear();
        this.timerBarBg.rect(0, 0, width, 6);
        this.timerBarBg.fill({ color: 0x000000, alpha: 0.5 });
        this.updateTimeBar();

        if (this.exitBtn) {
            this.exitBtn.x = width - 40; 
            this.exitBtn.y = 35;
        }

        // Board Resize
        const availableWidth = isPortrait ? width : width * 0.5; // W poziomie plansza węższa (50%)
        const availableHeight = height - HEADER_HEIGHT - BOTTOM_PADDING - reservedPanelHeight;

        const scale = Math.min(
            (availableWidth - 20) / this.BOARD_LOGICAL_WIDTH, 
            availableHeight / this.BOARD_LOGICAL_HEIGHT
        );
        
        this.renderer.scale.set(scale);
        this.renderer.x = (width - (this.BOARD_LOGICAL_WIDTH * scale)) / 2;
        this.renderer.y = height - (this.BOARD_LOGICAL_HEIGHT * scale) - BOTTOM_PADDING;

        // Panel Layout
        if (isPortrait) {
            // PIONOWO: Panele nad planszą
            const panelY = HEADER_HEIGHT;
            const panelH = this.renderer.y - HEADER_HEIGHT - PANEL_GAP;
            const panelW = (width - 20) / 2; 

            // Panel L (Player 1)
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear();
            // this.panelLeftBg.rect(0, 0, panelW, panelH); // Opcjonalne tło debug
            
            // Aktualizacja układu ScoreUI
            if (this.scoreUI) this.scoreUI.layout(panelW);
            // Centrowanie kontenera z paskami wewnątrz panelu
            if (this.scoreUI) {
                // Pionowo centrujemy
                // const uiHeight = this.scoreUI.container.height; // To w pixi bywa tricky bez bounds update
                this.scoreUI.container.y = 10; 
            }

            // Panel R (Player 2 / Bot)
            this.panelRight.x = 10 + panelW + 0; // Stykają się lub mały odstęp
            this.panelRight.y = panelY;
            this.panelRightBg.clear();
            
            if (this.botScoreUI) this.botScoreUI.layout(panelW);
            if (this.botScoreUI) this.botScoreUI.container.y = 10;

        } else {
            // POZIOMO: Panele po bokach
            const panelY = HEADER_HEIGHT;
            const panelH = height - HEADER_HEIGHT - BOTTOM_PADDING;
            
            const leftSpace = this.renderer.x - 20;
            const rightSpace = width - (this.renderer.x + this.renderer.width) - 20;

            // Panel L
            const wL = Math.max(0, leftSpace);
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear();
            
            if (this.scoreUI) this.scoreUI.layout(wL);
            if (this.scoreUI) this.scoreUI.container.y = 20;

            // Panel R
            const wR = Math.max(0, rightSpace);
            this.panelRight.x = this.renderer.x + this.renderer.width + 10;
            this.panelRight.y = panelY;
            this.panelRightBg.clear();

            if (this.botScoreUI) this.botScoreUI.layout(wR);
            if (this.botScoreUI) this.botScoreUI.container.y = 20;
        }
    }
}