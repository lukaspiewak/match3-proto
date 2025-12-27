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
    private botScoreUI!: ScoreUI;
    
    // Paski postępu (Główny i Drugorzędny)
    private primaryBarBg!: PIXI.Graphics;
    private primaryBarFill!: PIXI.Graphics;
    
    private secondaryBarBg!: PIXI.Graphics;
    private secondaryBarFill!: PIXI.Graphics;

    private exitBtn!: Button; 
    private statusText!: PIXI.Text;
    
    // --- NOWE PANELE BOCZNE/ŚRODKOWE ---
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
        
        // 1. Warstwa Gry (Plansza)
        this.renderer = new BoardRenderer(app, this.logic);
        this.addChild(this.renderer); 

        // 2. Warstwa Paneli (L/R)
        this.panelLeft = new PIXI.Container();
        this.panelRight = new PIXI.Container();
        this.panelLeftBg = new PIXI.Graphics();
        this.panelRightBg = new PIXI.Graphics();
        
        this.panelLeft.addChild(this.panelLeftBg);
        this.panelRight.addChild(this.panelRightBg);
        
        this.addChild(this.panelLeft);
        this.addChild(this.panelRight);

        // 3. Warstwa HUD (Interfejs - zawsze na wierzchu)
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
        // --- HUD ---
        // 1. Pasek Główny (Góra)
        this.primaryBarBg = new PIXI.Graphics();
        this.primaryBarBg.rect(0, 0, 100, 6); 
        this.primaryBarBg.fill({ color: 0x000000, alpha: 0.5 });
        this.hudContainer.addChild(this.primaryBarBg);
        this.primaryBarFill = new PIXI.Graphics();
        this.hudContainer.addChild(this.primaryBarFill);

        // 2. Pasek Drugorzędny (Pod głównym)
        this.secondaryBarBg = new PIXI.Graphics();
        this.secondaryBarBg.rect(0, 0, 100, 6); 
        this.secondaryBarBg.fill({ color: 0x000000, alpha: 0.3 }); // Nieco jaśniejszy/mniej ważny
        this.hudContainer.addChild(this.secondaryBarBg);
        this.secondaryBarFill = new PIXI.Graphics();
        this.hudContainer.addChild(this.secondaryBarFill);

        // 3. Przycisk wyjścia
        this.exitBtn = new Button("⏏️", 50, 50, 0x000000, () => {
            this.gameManager.resetGame();
            this.backToMenuCallback();
        }, true); 
        this.hudContainer.addChild(this.exitBtn);

        // 4. Status text
        this.statusText = new PIXI.Text({
            text: '',
            style: { fontFamily: 'Arial', fontSize: 12, fill: CurrentTheme.textMuted, align: 'center' }
        });
        this.statusText.anchor.set(0.5, 0);
        this.statusText.visible = false; 
        this.hudContainer.addChild(this.statusText);

        // --- PANELE (DEBUG VISUALS) ---
        const drawPlaceholder = (g: PIXI.Graphics, label: string) => {
            g.clear();
            g.rect(0, 0, 100, 100); 
            g.fill({ color: 0x000000, alpha: 0.3 }); 
            g.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.2 });
        };
        drawPlaceholder(this.panelLeftBg, "L");
        drawPlaceholder(this.panelRightBg, "R");
        
        const lText = new PIXI.Text({ text: "L", style: { fill: 0xFFFFFF, fontSize: 32, alpha: 0.2 }});
        lText.anchor.set(0.5); lText.x = 50; lText.y = 50; 
        this.panelLeft.addChild(lText);
        this.panelLeft['debugText'] = lText; 

        const rText = new PIXI.Text({ text: "R", style: { fill: 0xFFFFFF, fontSize: 32, alpha: 0.2 }});
        rText.anchor.set(0.5); rText.x = 50; rText.y = 50;
        this.panelRight.addChild(rText);
        this.panelRight['debugText'] = rText;
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        const activeBlocks = BlockRegistry.getAll().slice(0, AppConfig.blockTypes);
        const activeBlockIds = activeBlocks.map(b => b.id);
        
        if (this.scoreUI) this.hudContainer.removeChild(this.scoreUI.container);
        if (this.botScoreUI) this.hudContainer.removeChild(this.botScoreUI.container);

        this.scoreUI = new ScoreUI(activeBlockIds, 0, 0);
        this.hudContainer.addChild(this.scoreUI.container);

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
        
        this.updateBars();
        
        const human = this.gameManager['players'].find(p => p.id === PLAYER_ID_1) as HumanPlayerController; 
        const selectedId = human ? human.getSelectedId() : -1;
        this.renderer.update(delta, selectedId);
    }

    // --- NOWOŚĆ: Logika wyświetlania dwóch pasków ---
    private updateBars() {
        this.primaryBarFill.clear();
        this.secondaryBarFill.clear();
        const width = this.app.screen.width; 

        // Dane z GameManagera
        const turnTimer = this.gameManager.turnTimer;
        const maxTurn = this.gameManager.maxTurnTime;
        const levelTime = this.gameManager.timeLeft;
        const maxLevelTime = this.gameManager.maxTime;
        const moves = this.gameManager.movesLeft;
        const maxMoves = this.gameManager.maxMoves;

        const isVs = AppConfig.gameMode !== 'SOLO';
        const hasTimeLimit = maxLevelTime > 0;
        const hasMoveLimit = maxMoves > 0;

        // Lista aktywnych metryk
        const metrics: { percent: number, color: number, label?: string }[] = [];

        // 1. Priorytet: Czas Tury (tylko w VS/Bot)
        if (isVs) {
            let p = turnTimer / maxTurn;
            let c = 0x00AAFF; // Niebieski (Turn)
            if (p < 0.3) c = 0xFF0000;
            metrics.push({ percent: p, color: c });
        }

        // 2. Priorytet: Czas Poziomu
        if (hasTimeLimit) {
            let p = levelTime / maxLevelTime;
            let c = 0x00FF00; // Zielony (Time)
            if (p < 0.2) c = 0xFF0000;
            else if (p < 0.5) c = 0xFFA500;
            metrics.push({ percent: p, color: c });
        }

        // 3. Priorytet: Ruchy (jeśli nie nieskończone)
        if (hasMoveLimit) {
            let p = moves / maxMoves;
            let c = 0xFFA500; // Pomarańczowy (Moves)
            if (p < 0.2) c = 0xFF0000;
            metrics.push({ percent: p, color: c });
        } else if (moves < 0 && metrics.length === 0) {
            // Freeplay (Infinite) - pokaż pełny niebieski pasek jeśli nie ma nic innego
            metrics.push({ percent: 1.0, color: 0x00AAFF });
        }

        // Rysowanie paska 1
        if (metrics.length > 0) {
            this.primaryBarBg.visible = true;
            this.primaryBarFill.rect(0, 0, width * metrics[0].percent, 6);
            this.primaryBarFill.fill(metrics[0].color);
        } else {
            this.primaryBarBg.visible = false;
        }

        // Rysowanie paska 2
        if (metrics.length > 1) {
            this.secondaryBarBg.visible = true;
            this.secondaryBarFill.rect(0, 6, width * metrics[1].percent, 6); // Offset Y = 6
            this.secondaryBarFill.fill(metrics[1].color);
        } else {
            this.secondaryBarBg.visible = false;
        }
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
        this.x = 0;
        this.y = 0;
        this.scale.set(1);

        const HEADER_HEIGHT = 60; 
        const BOTTOM_PADDING = 20;
        const PANEL_GAP = 10; 

        // 1. Orientacja
        const isPortrait = height > width;

        let reservedPanelHeight = 0; 
        if (isPortrait) {
            reservedPanelHeight = Math.max(120, height * 0.15);
        } else {
            reservedPanelHeight = 0;
        }

        // 2. HUD
        this.primaryBarBg.clear();
        this.primaryBarBg.rect(0, 0, width, 6);
        this.primaryBarBg.fill({ color: 0x000000, alpha: 0.5 });
        
        this.secondaryBarBg.clear();
        this.secondaryBarBg.rect(0, 6, width, 6);
        this.secondaryBarBg.fill({ color: 0x000000, alpha: 0.3 });

        if (this.scoreUI) {
            this.scoreUI.container.x = 10;
            this.scoreUI.container.y = 20; // Pod paskami (6+6=12)
        }
        if (this.exitBtn) {
            this.exitBtn.x = width - 40; 
            this.exitBtn.y = 40;
        }
        if (this.botScoreUI && this.botScoreUI.container.visible) {
            this.botScoreUI.container.x = width - 250; 
            this.botScoreUI.container.y = 20;
        }

        // 3. Plansza
        const availableWidth = isPortrait ? width : width * 0.6; 
        const availableHeight = height - HEADER_HEIGHT - BOTTOM_PADDING - reservedPanelHeight;

        const scale = Math.min(
            (availableWidth - 20) / this.BOARD_LOGICAL_WIDTH, 
            availableHeight / this.BOARD_LOGICAL_HEIGHT
        );
        
        this.renderer.scale.set(scale);
        this.renderer.x = (width - (this.BOARD_LOGICAL_WIDTH * scale)) / 2;
        this.renderer.y = height - (this.BOARD_LOGICAL_HEIGHT * scale) - BOTTOM_PADDING;

        // 4. Panele
        if (isPortrait) {
            const panelY = HEADER_HEIGHT;
            const panelH = this.renderer.y - HEADER_HEIGHT - PANEL_GAP;
            const panelW = (width - 30) / 2; 

            this.panelLeftBg.clear();
            this.panelLeftBg.roundRect(0, 0, panelW, panelH, 10);
            this.panelLeftBg.fill({ color: 0x000000, alpha: 0.2 }); 
            this.panelLeftBg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 }); 
            
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;

            this.panelRightBg.clear();
            this.panelRightBg.roundRect(0, 0, panelW, panelH, 10);
            this.panelRightBg.fill({ color: 0x000000, alpha: 0.2 });
            this.panelRightBg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 });

            this.panelRight.x = 10 + panelW + 10; 
            this.panelRight.y = panelY;
            
            if (this.panelLeft['debugText']) {
                this.panelLeft['debugText'].x = panelW / 2; this.panelLeft['debugText'].y = panelH / 2;
            }
            if (this.panelRight['debugText']) {
                this.panelRight['debugText'].x = panelW / 2; this.panelRight['debugText'].y = panelH / 2;
            }

        } else {
            const panelY = HEADER_HEIGHT;
            const panelH = height - HEADER_HEIGHT - BOTTOM_PADDING;
            
            const leftSpace = this.renderer.x - 20;
            const rightSpace = width - (this.renderer.x + this.renderer.width) - 20;

            const wL = Math.max(0, leftSpace);
            this.panelLeftBg.clear();
            this.panelLeftBg.roundRect(0, 0, wL, panelH, 10);
            this.panelLeftBg.fill({ color: 0x000000, alpha: 0.2 });
            this.panelLeftBg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 });

            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;

            const wR = Math.max(0, rightSpace);
            this.panelRightBg.clear();
            this.panelRightBg.roundRect(0, 0, wR, panelH, 10);
            this.panelRightBg.fill({ color: 0x000000, alpha: 0.2 });
            this.panelRightBg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 });

            this.panelRight.x = this.renderer.x + this.renderer.width + 10;
            this.panelRight.y = panelY;

            if (this.panelLeft['debugText']) {
                this.panelLeft['debugText'].x = wL / 2; this.panelLeft['debugText'].y = panelH / 2;
            }
            if (this.panelRight['debugText']) {
                this.panelRight['debugText'].x = wR / 2; this.panelRight['debugText'].y = panelH / 2;
            }
        }
    }
}