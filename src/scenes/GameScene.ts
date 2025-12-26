import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BoardLogic } from '../BoardLogic';
import { GameManager } from '../GameManager';
import { SoundManager } from '../SoundManager';
import { ParticleSystem } from '../ParticleSystem';
import { ScoreUI } from '../ScoreUI';
import { HumanPlayerController, BotPlayerController } from '../PlayerController';
import { Button } from '../ui/Button';
import { BlockView } from '../views/BlockView'; 
import { 
    COLS, ROWS, TILE_SIZE, GAP, CellState, 
    PLAYER_ID_1, PLAYER_ID_2, AppConfig, CurrentTheme // Import motywu
} from '../Config';
import { Random } from '../Random';
import { BlockRegistry } from '../BlockDef';

export class GameScene extends PIXI.Container implements Scene {
    private app: PIXI.Application;
    private logic: BoardLogic;
    private gameManager: GameManager;
    private soundManager: SoundManager;
    private particles: ParticleSystem;
    
    // UI Elements
    private scoreUI!: ScoreUI;
    private botScoreUI!: ScoreUI;
    private timerValueText!: PIXI.Text;
    private timerLabel!: PIXI.Text;
    private statusText!: PIXI.Text;
    
    // Board Containers
    private bgContainer: PIXI.Container;
    private boardContainer: PIXI.Container;
    
    // Sprites
    private sprites: BlockView[] = [];
    
    private idleTime = 0;
    private hintIndices: number[] = [];
    private hintPulseTimer = 0;

    // --- SCREEN SHAKE & FX ---
    private shakeTimer = 0;
    private shakeIntensity = 0;
    private baseBoardY = 0; 

    private backToMenuCallback: () => void;

    private readonly GAME_LOGICAL_WIDTH = (COLS * TILE_SIZE) + 20;
    private readonly GAME_LOGICAL_HEIGHT = (ROWS * TILE_SIZE) + 150 + 20;

    constructor(app: PIXI.Application, backToMenuCallback: () => void) {
        super();
        this.app = app;
        this.backToMenuCallback = backToMenuCallback;

        this.soundManager = new SoundManager();
        this.particles = new ParticleSystem(app); 
        
        this.logic = new BoardLogic();
        this.logic.onBadMove = () => { 
            this.soundManager.playBadMove(); 
            if (navigator.vibrate) navigator.vibrate(50); 
            this.triggerShake(0.2, 3);
        };

        this.gameManager = new GameManager(this.logic);
        
        this.bgContainer = new PIXI.Container();
        this.boardContainer = new PIXI.Container();
        
        this.addChild(this.bgContainer);
        this.addChild(this.boardContainer); 
        
        this.setupBoardBackground();
        this.setupUI();
        
        this.gameManager.onDeadlockFixed = (id, type) => this.onDeadlockFixed(id, type);
        this.gameManager.onGameFinished = (reason) => this.onGameFinished(reason);
    }

    private setupBoardBackground() {
        const boardBg = new PIXI.Graphics();
        boardBg.rect(-GAP, -GAP, (COLS * TILE_SIZE) + GAP, (ROWS * TILE_SIZE) + GAP);
        // ZMIANA: Tło planszy z motywu
        boardBg.fill({ color: CurrentTheme.panelBg, alpha: 1.0 }); 
        // boardBg.stroke({ width: 2, color: CurrentTheme.border }); // Opcjonalny border
        this.bgContainer.addChild(boardBg);

        for(let i=0; i<COLS * ROWS; i++) {
            const col = i % COLS; const row = Math.floor(i / COLS);
            const slot = new PIXI.Graphics();
            slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
            // ZMIANA: Kolor slotów z motywu
            slot.fill({ color: CurrentTheme.slotBg, alpha: 1.0 }); 
            slot.x = col * TILE_SIZE; slot.y = row * TILE_SIZE;
            this.bgContainer.addChild(slot);
        }

        const mask = new PIXI.Graphics();
        mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
        mask.fill(0xffffff);
        this.boardContainer.addChild(mask);
        this.boardContainer.mask = mask;
    }

    private setupUI() {
        const UI_CENTER_X = this.GAME_LOGICAL_WIDTH / 2;

        const timerContainer = new PIXI.Container();
        timerContainer.x = UI_CENTER_X;
        timerContainer.y = 45; 
        this.addChild(timerContainer);

        const timerBg = new PIXI.Graphics();
        timerBg.circle(0, 0, 30); 
        // ZMIANA: Tło timera i akcent z motywu
        timerBg.fill({ color: CurrentTheme.panelBg });
        timerBg.stroke({ width: 3, color: CurrentTheme.accent }); 
        timerContainer.addChild(timerBg);

        this.timerValueText = new PIXI.Text({
            text: '0',
            // ZMIANA: Kolor tekstu
            style: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'center' }
        });
        this.timerValueText.anchor.set(0.5);
        timerContainer.addChild(this.timerValueText);

        this.timerLabel = new PIXI.Text({
            text: 'LIMIT',
            // ZMIANA: Kolor wygaszony
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
            style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'right', stroke: { color: 0x000000, width: 3 } }
        });
        this.statusText.anchor.set(1, 0.5); 
        this.statusText.x = menuBtn.x - 35; 
        this.statusText.y = menuBtn.y;      
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

        const human = new HumanPlayerController(PLAYER_ID_1, this.gameManager, this.logic, this.boardContainer, this.soundManager);
        this.gameManager.registerPlayer(human);

        if (AppConfig.gameMode === 'VS_AI') {
            const bot = new BotPlayerController(PLAYER_ID_2, this.gameManager, this.logic);
            this.gameManager.registerPlayer(bot);
        }

        this.sprites.forEach(s => s.destroy());
        this.sprites = [];
        this.logic.initBoard(); 
        
        for(let i=0; i<this.logic.cells.length; i++) {
            const blockView = new BlockView();
            this.boardContainer.addChild(blockView);
            this.sprites.push(blockView);
        }

        this.gameManager.startGame();
        this.idleTime = 0;
        this.hintIndices = [];
    }

    public update(delta: number) {
        this.gameManager.update(delta);
        this.logic.update(delta);
        this.particles.update(delta);
        
        if (this.scoreUI) this.scoreUI.update(delta);
        if (this.botScoreUI && this.botScoreUI.container.visible) this.botScoreUI.update(delta);

        this.updateHintLogic(delta);
        this.updateShake(delta); 
        this.updateUI();
        this.renderBoard();
    }

    private triggerShake(duration: number, intensity: number) {
        this.shakeTimer = duration;
        this.shakeIntensity = intensity;
    }

    private updateShake(delta: number) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= delta / 60.0;
            const offsetX = (Math.random() * this.shakeIntensity) - (this.shakeIntensity / 2);
            const offsetY = (Math.random() * this.shakeIntensity) - (this.shakeIntensity / 2);
            
            this.boardContainer.x = offsetX;
            this.boardContainer.y = this.baseBoardY + offsetY;
            this.bgContainer.x = offsetX;
            this.bgContainer.y = this.baseBoardY + offsetY;
        } else {
            this.boardContainer.x = 0;
            this.boardContainer.y = this.baseBoardY;
            this.bgContainer.x = 0;
            this.bgContainer.y = this.baseBoardY;
        }
    }

    private updateHintLogic(delta: number) {
        if (this.logic.cells.every(c => c.state === CellState.IDLE) && !this.gameManager.isGameOver) {
            this.idleTime += delta / 60.0; 
            if (this.idleTime > 10.0 && this.hintIndices.length === 0) {
                const hint = this.logic.findHint();
                if (hint) {
                    this.hintIndices = hint;
                } else {
                    const fix = this.logic.findDeadlockFix();
                    if (fix) {
                        this.logic.cells[fix.id].typeId = fix.targetType;
                        this.onDeadlockFixed(fix.id, fix.targetType);
                    } else {
                        this.idleTime = 0; 
                    }
                }
            }
        } else {
            this.idleTime = 0;
            this.hintIndices = [];
        }

        if (this.hintIndices.length > 0) this.hintPulseTimer += delta * 0.1;
        else this.hintPulseTimer = 0;
    }

    private updateUI() {
        this.statusText.text = this.gameManager.gameStatusText;
        if (this.gameManager.turnTimer < 5.0) this.statusText.style.fill = CurrentTheme.danger; // Zmiana na kolor ostrzegawczy
        else this.statusText.style.fill = CurrentTheme.textMain;

        if (AppConfig.limitMode === 'MOVES') {
            this.timerLabel.text = 'MOVES';
            this.timerValueText.text = `${AppConfig.limitValue - this.gameManager.globalMovesMade}`;
        } else if (AppConfig.limitMode === 'TIME') {
            this.timerLabel.text = 'TIME';
            const timeLeft = Math.max(0, AppConfig.limitValue - this.gameManager.globalTimeElapsed);
            const m = Math.floor(timeLeft / 60);
            const s = Math.floor(timeLeft % 60);
            this.timerValueText.text = `${m}:${s < 10 ? '0'+s : s}`;
        } else {
            this.timerLabel.text = 'FREE';
            this.timerValueText.text = '∞';
        }
    }

    private renderBoard() {
        const human = this.gameManager['players'].find(p => p.id === PLAYER_ID_1) as HumanPlayerController; 
        const selectedId = human ? human.getSelectedId() : -1;

        for(let i=0; i<this.logic.cells.length; i++) {
            const cell = this.logic.cells[i];
            const sprite = this.sprites[i]; 
            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) { sprite.visible = false; continue; }

            const blockDef = BlockRegistry.getById(cell.typeId);

            if (cell.state === CellState.EXPLODING) {
                if (!(sprite as any).processed) {
                    const globalPos = this.boardContainer.toGlobal({x: drawX, y: drawY});
                    this.particles.spawn(globalPos.x, globalPos.y, blockDef.color);
                    
                    const currentId = this.gameManager.getCurrentPlayerId();
                    if (currentId === PLAYER_ID_1) this.scoreUI.addScore(cell.typeId);
                    else if (currentId === PLAYER_ID_2) this.botScoreUI.addScore(cell.typeId);
                    else this.scoreUI.addScore(cell.typeId);

                    this.soundManager.playPop();
                    
                    if (navigator.vibrate) navigator.vibrate(20);
                    this.triggerShake(0.2, 5);

                    (sprite as any).processed = true;
                }
                sprite.visible = true; sprite.x = drawX; sprite.y = drawY;
                
                // ZMIANA: Dopasowanie animacji do krótszego czasu wybuchu (5.0)
                const progress = Math.max(0, cell.timer / 5.0); 
                
                sprite.scale.set(progress); sprite.alpha = progress; 
                continue;
            } else { (sprite as any).processed = false; }

            let scale = 1.0; let zIndex = 0; let alpha = 1.0;
            if (cell.state === CellState.SWAPPING) { zIndex = 10; }
            else if (cell.id === selectedId) { scale = 1.15; zIndex = 20; }
            
            if (this.hintIndices.includes(cell.id)) {
                alpha = 0.75 + Math.sin(this.hintPulseTimer) * 0.25;
            }

            sprite.visible = true; 
            sprite.alpha = alpha;
            sprite.zIndex = zIndex;
            sprite.x = drawX; 
            sprite.y = drawY; 
            sprite.scale.set(scale); 
            
            sprite.updateVisuals(cell.typeId);
        }
        this.boardContainer.sortableChildren = true;
    }

    private onDeadlockFixed(id: number, type: number) {
        const cell = this.logic.cells[id];
        const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const globalPos = this.boardContainer.toGlobal({x: drawX, y: drawY});
        
        const block = BlockRegistry.getById(type);
        this.particles.spawn(globalPos.x, globalPos.y, block.color);
        this.soundManager.playPop();
        
        if (navigator.vibrate) navigator.vibrate(20);

        this.idleTime = 0; this.hintIndices = [];
    }

    private onGameFinished(reason: string) {
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.GAME_LOGICAL_WIDTH, this.GAME_LOGICAL_HEIGHT);
        // ZMIANA: Tło overlayu
        overlay.fill({ color: 0x000000, alpha: 0.8 });
        this.addChild(overlay); 
        
        const text = new PIXI.Text({ text: `GAME OVER\n${reason}\nClick to Menu`, style: { fill: CurrentTheme.textMain, fontSize: 32, align: 'center' }});
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
        
        this.bgContainer.y = this.baseBoardY;
        this.boardContainer.y = this.baseBoardY;
        this.bgContainer.x = 0;
        this.boardContainer.x = 0;
    }
}