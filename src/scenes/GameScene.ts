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
// Importujemy typ, ale nie konkretny poziom (ten przyjdzie z zewnątrz)
import { type LevelConfig, LEVEL_1 } from '../LevelDef'; 

export class GameScene extends PIXI.Container implements Scene {
    private app: PIXI.Application;
    private logic: BoardLogic;
    private gameManager: GameManager;
    private soundManager: SoundManager;
    private renderer: BoardRenderer; 
    
    private scoreUI!: ScoreUI;
    private botScoreUI!: ScoreUI;
    private timerValueText!: PIXI.Text;
    private timerLabel!: PIXI.Text;
    private statusText!: PIXI.Text;
    
    private backToMenuCallback: () => void;
    // NOWOŚĆ: Przechowujemy wybrany poziom
    private pendingLevelConfig: LevelConfig | null = null;

    private readonly GAME_LOGICAL_WIDTH = (COLS * TILE_SIZE) + 20;
    private readonly GAME_LOGICAL_HEIGHT = (ROWS * TILE_SIZE) + 150 + 20;

    constructor(app: PIXI.Application, backToMenuCallback: () => void) {
        super();
        this.app = app;
        this.backToMenuCallback = backToMenuCallback;

        this.soundManager = new SoundManager();
        this.logic = new BoardLogic();
        this.renderer = new BoardRenderer(app, this.logic);
        this.addChild(this.renderer); 

        this.logic.onBadMove = () => { 
            this.soundManager.playBadMove(); 
            if (navigator.vibrate) navigator.vibrate(50); 
            this.renderer.triggerShake(0.2, 3);
        };

        this.gameManager = new GameManager(this.logic);
        this.setupUI();
        
        this.gameManager.onGameFinished = (reason, win) => this.onGameFinished(reason, win);
    }

    // Metoda wywoływana przez main.ts przed pokazaniem sceny
    public setCurrentLevel(level: LevelConfig) {
        this.pendingLevelConfig = level;
    }

    private setupUI() {
        const UI_CENTER_X = this.GAME_LOGICAL_WIDTH / 2;

        const timerContainer = new PIXI.Container();
        timerContainer.x = UI_CENTER_X;
        timerContainer.y = 45; 
        this.addChild(timerContainer);

        const timerBg = new PIXI.Graphics();
        timerBg.circle(0, 0, 30); 
        timerBg.fill({ color: CurrentTheme.panelBg });
        timerBg.stroke({ width: 3, color: CurrentTheme.accent }); 
        timerContainer.addChild(timerBg);

        this.timerValueText = new PIXI.Text({
            text: '0',
            style: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'center' }
        });
        this.timerValueText.anchor.set(0.5);
        timerContainer.addChild(this.timerValueText);

        this.timerLabel = new PIXI.Text({
            text: 'LIMIT',
            style: { fontFamily: 'Arial', fontSize: 10, fill: CurrentTheme.textMuted, align: 'center' }
        });
        this.timerLabel.anchor.set(0.5);
        this.timerLabel.y = 20; 
        timerContainer.addChild(this.timerLabel);

        const menuBtn = new Button("☰", 50, 50, 0x444444, () => {
            this.gameManager.resetGame();
            this.backToMenuCallback();
        });
        menuBtn.x = this.GAME_LOGICAL_WIDTH - 10 - 25; 
        menuBtn.y = 45; 
        this.addChild(menuBtn);

        this.statusText = new PIXI.Text({
            text: '',
            style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'left', stroke: { color: 0x000000, width: 3 } }
        });
        this.statusText.anchor.set(0, 0); 
        this.statusText.x = 10; 
        this.statusText.y = 75;      
        this.addChild(this.statusText);
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        const activeBlocks = BlockRegistry.getAll().slice(0, AppConfig.blockTypes);
        const activeBlockIds = activeBlocks.map(b => b.id);
        
        if (this.scoreUI) this.removeChild(this.scoreUI.container);
        if (this.botScoreUI) this.removeChild(this.botScoreUI.container);

        this.scoreUI = new ScoreUI(activeBlockIds, 0, 100);
        this.scoreUI.container.x = 10;
        this.scoreUI.container.y = 20;
        this.addChild(this.scoreUI.container);

        this.botScoreUI = new ScoreUI(activeBlockIds, 0, 100);
        this.botScoreUI.container.x = this.GAME_LOGICAL_WIDTH - 10 - this.scoreUI.container.width; 
        this.botScoreUI.container.y = 20;
        this.botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');
        this.addChild(this.botScoreUI.container);

        const inputContainer = this.renderer.getInputContainer();
        const human = new HumanPlayerController(PLAYER_ID_1, this.gameManager, this.logic, inputContainer, this.soundManager);
        this.gameManager.registerPlayer(human);

        if (AppConfig.gameMode === 'VS_AI') {
            const bot = new BotPlayerController(PLAYER_ID_2, this.gameManager, this.logic);
            this.gameManager.registerPlayer(bot);
        }

        this.renderer.initVisuals();

        // --- ZMIANA: Używamy poziomu wybranego w menu ---
        const levelToLoad = this.pendingLevelConfig || LEVEL_1; // Fallback
        this.gameManager.startLevel(levelToLoad); 

        // --- ZMIANA: Inicjalizacja PASKÓW w trybie Construction ---
        if (this.gameManager.currentLevelMode === 'CONSTRUCTION') {
            activeBlockIds.forEach(id => {
                const amount = this.gameManager.getSessionResourceAmount(id);
                const startAmount = this.gameManager.getStartResourceAmount(id);
                
                // Ustawiamy etykietę tekstową ("50")
                this.scoreUI.setStockLabel(id, amount);
                
                // Ustawiamy wysokość paska (Aktualna / Początkowa)
                // Na starcie będzie 1.0 (pełny), chyba że startAmount = 0
                this.scoreUI.updateBarValue(id, amount, startAmount);
            });
        }

        this.logic.removeAllListeners(); 
        this.renderer.bindEvents(); 
        this.gameManager.bindEvents();

        this.gameManager.onDeadlockFixed = (id, type) => this.onDeadlockFixed(id, type);
        
        this.logic.on('explode', (data: { id: number, typeId: number, x: number, y: number }) => {
            const currentId = this.gameManager.getCurrentPlayerId();
            
            // Tryb STANDARD: Pasek rośnie od 0 do 100 (tak jak było)
            if (this.gameManager.currentLevelMode === 'STANDARD') {
                if (currentId === PLAYER_ID_1) this.scoreUI.addScore(data.typeId);
            }

            // Tryb CONSTRUCTION: Pasek maleje
            if (this.gameManager.currentLevelMode === 'CONSTRUCTION') {
                const newAmount = this.gameManager.getSessionResourceAmount(data.typeId);
                const startAmount = this.gameManager.getStartResourceAmount(data.typeId);
                
                // Aktualizujemy tekst
                this.scoreUI.setStockLabel(data.typeId, newAmount);
                
                // Aktualizujemy pasek (zmniejszamy go)
                this.scoreUI.updateBarValue(data.typeId, newAmount, startAmount);
            }

            this.soundManager.playPop();
            if (navigator.vibrate) navigator.vibrate(20);
        });

        this.logic.on('hint', (indices: number[]) => {
            this.renderer.setHints(indices);
        });

        this.logic.on('deadlock', (fix: { id: number, targetType: number }) => {
             this.logic.cells[fix.id].typeId = fix.targetType;
             this.onDeadlockFixed(fix.id, fix.targetType);
        });
    }

    public update(delta: number) {
        this.gameManager.update(delta);
        this.logic.update(delta);
        
        if (this.scoreUI) this.scoreUI.update(delta);
        if (this.botScoreUI && this.botScoreUI.container.visible) this.botScoreUI.update(delta);

        this.updateUI();
        
        const human = this.gameManager['players'].find(p => p.id === PLAYER_ID_1) as HumanPlayerController; 
        const selectedId = human ? human.getSelectedId() : -1;
        this.renderer.update(delta, selectedId);
    }

    private updateUI() {
        this.statusText.text = this.gameManager.gameStatusText;
        
        if (this.gameManager.timeLeft > 0) {
            this.timerLabel.text = 'TIME';
            this.timerValueText.text = Math.ceil(this.gameManager.timeLeft).toString();
        } else {
            this.timerLabel.text = 'MOVES';
            this.timerValueText.text = this.gameManager.movesLeft.toString();
        }
        
        if (this.gameManager.movesLeft <= 3 && this.gameManager.timeLeft === 0) this.statusText.style.fill = CurrentTheme.danger; 
        else this.statusText.style.fill = CurrentTheme.textMain;
    }

    private onDeadlockFixed(id: number, type: number) {
        this.soundManager.playPop();
        if (navigator.vibrate) navigator.vibrate(20);
        this.renderer.setHints([]);
    }

    private onGameFinished(reason: string, win: boolean) {
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.GAME_LOGICAL_WIDTH, this.GAME_LOGICAL_HEIGHT);
        overlay.fill({ color: 0x000000, alpha: 0.85 });
        this.addChild(overlay); 
        
        const color = win ? 0x00FF00 : 0xFF0000;
        const title = win ? "VICTORY!" : "GAME OVER";

        const text = new PIXI.Text({ 
            text: `${title}\n${reason}\n\nClick to Menu`, 
            style: { fill: color, fontSize: 36, fontWeight: 'bold', align: 'center', stroke: { color: 0xFFFFFF, width: 4 } }
        });
        text.anchor.set(0.5);
        text.x = this.GAME_LOGICAL_WIDTH / 2; text.y = this.GAME_LOGICAL_HEIGHT / 2;
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
        const scale = Math.min(width / this.GAME_LOGICAL_WIDTH, height / this.GAME_LOGICAL_HEIGHT); 
        this.scale.set(scale);
        
        const baseX = (width - this.GAME_LOGICAL_WIDTH * scale) / 2;
        this.x = baseX; 
        this.y = (height - this.GAME_LOGICAL_HEIGHT * scale) / 2;

        this.baseBoardY = 160; 
        
        this.renderer.x = 0;
        this.renderer.y = this.baseBoardY;
    }
}