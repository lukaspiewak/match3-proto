import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BoardLogic } from '../BoardLogic';
import { GameManager } from '../GameManager';
import { SoundManager } from '../SoundManager';
import { ParticleSystem } from '../ParticleSystem';
import { ScoreUI } from '../ScoreUI';
import { HumanPlayerController, BotPlayerController } from '../PlayerController';
import { Button } from '../ui/Button';
import { 
    COLS, ROWS, TILE_SIZE, GAP, CellState, 
    PLAYER_ID_1, PLAYER_ID_2, AppConfig, ALL_AVAILABLE_COLORS, BLOCK_ICONS 
} from '../Config';
import { Random } from '../Random';

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
    
    private sprites: PIXI.Graphics[] = [];
    private activeColors: number[] = [];
    
    // Hint vars
    private idleTime = 0;
    private hintIndices: number[] = [];
    private hintPulseTimer = 0;

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
        boardBg.fill({ color: 0x000000, alpha: 0.5 });
        this.bgContainer.addChild(boardBg);

        for(let i=0; i<COLS * ROWS; i++) {
            const col = i % COLS; const row = Math.floor(i / COLS);
            const slot = new PIXI.Graphics();
            slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
            slot.fill({ color: 0x000000, alpha: 0.6 }); 
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
        timerBg.fill({ color: 0x222222 });
        timerBg.stroke({ width: 3, color: 0xFFD700 }); 
        timerContainer.addChild(timerBg);

        this.timerValueText = new PIXI.Text({
            text: '0',
            style: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }
        });
        this.timerValueText.anchor.set(0.5);
        timerContainer.addChild(this.timerValueText);

        this.timerLabel = new PIXI.Text({
            text: 'LIMIT',
            style: { fontFamily: 'Arial', fontSize: 10, fill: 0xAAAAAA, align: 'center' }
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
            style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: 0xFFFFFF, align: 'right', stroke: { color: 0x000000, width: 3 } }
        });
        this.statusText.anchor.set(1, 0.5); 
        this.statusText.x = menuBtn.x - 35; 
        this.statusText.y = menuBtn.y;      
        this.addChild(this.statusText);
    }

    public onShow() {
        Random.setSeed(AppConfig.seed);
        this.gameManager.clearPlayers();
        
        this.activeColors = ALL_AVAILABLE_COLORS.slice(0, AppConfig.blockTypes);

        if (this.scoreUI) this.removeChild(this.scoreUI.container);
        if (this.botScoreUI) this.removeChild(this.botScoreUI.container);

        this.scoreUI = new ScoreUI(this.activeColors, 0, 100);
        this.scoreUI.container.x = 10;
        this.scoreUI.container.y = 20;
        this.addChild(this.scoreUI.container);

        this.botScoreUI = new ScoreUI(this.activeColors, 0, 100);
        this.botScoreUI.container.x = this.GAME_LOGICAL_WIDTH - 10 - 110; 
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
            const g = new PIXI.Graphics();
            g.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
            g.fill(0xFFFFFF);
            g.pivot.set((TILE_SIZE - GAP) / 2, (TILE_SIZE - GAP) / 2);
            
            // --- DODANIE IKONY ---
            const icon = new PIXI.Text({
                text: '', // Treść ustawiana dynamicznie w renderBoard
                style: {
                    fontFamily: 'Arial',
                    fontSize: 32,
                    fontWeight: 'bold',
                    fill: 0x000000,
                    align: 'center',
                    alpha: 0.6 // Lekka przezroczystość dla stylu
                }
            });
            icon.anchor.set(0.5);
            // Wyśrodkowanie wewnątrz klocka
            icon.x = (TILE_SIZE - GAP) / 2;
            icon.y = (TILE_SIZE - GAP) / 2;
            
            // Przypinamy tekst do grafiki i zapisujemy referencję (brzydki hack 'any', ale skuteczny w prototypie)
            g.addChild(icon);
            (g as any).icon = icon;

            this.boardContainer.addChild(g);
            this.sprites.push(g);
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
        this.updateUI();
        this.renderBoard();
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
        if (this.gameManager.turnTimer < 5.0) this.statusText.style.fill = 0xFF0000;
        else this.statusText.style.fill = 0xFFFFFF;

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
            const sprite = this.sprites[i] as any; 
            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) { sprite.visible = false; continue; }

            if (cell.state === CellState.EXPLODING) {
                if (!sprite.processed) {
                    const globalPos = this.boardContainer.toGlobal({x: drawX, y: drawY});
                    this.particles.spawn(globalPos.x, globalPos.y, this.activeColors[cell.typeId]);
                    
                    const currentId = this.gameManager.getCurrentPlayerId();
                    if (currentId === PLAYER_ID_1) this.scoreUI.addScore(cell.typeId);
                    else if (currentId === PLAYER_ID_2) this.botScoreUI.addScore(cell.typeId);
                    else this.scoreUI.addScore(cell.typeId);

                    this.soundManager.playPop();
                    sprite.processed = true;
                }
                sprite.visible = true; sprite.x = drawX; sprite.y = drawY;
                const progress = Math.max(0, cell.timer / 15.0); 
                sprite.scale.set(progress); sprite.tint = 0xFFFFFF; sprite.alpha = progress; 
                continue;
            } else { sprite.processed = false; }

            let scale = 1.0; let zIndex = 0; let alpha = 1.0;
            if (cell.state === CellState.SWAPPING) { zIndex = 10; }
            else if (cell.id === selectedId) { scale = 1.15; zIndex = 20; }
            
            if (this.hintIndices.includes(cell.id)) {
                alpha = 0.75 + Math.sin(this.hintPulseTimer) * 0.25;
            }

            sprite.visible = true; sprite.alpha = alpha;
            sprite.tint = this.activeColors[cell.typeId];
            
            // --- AKTUALIZACJA IKONY ---
            if (cell.typeId >= 0 && cell.typeId < BLOCK_ICONS.length) {
                sprite.icon.text = BLOCK_ICONS[cell.typeId];
            }

            sprite.x = drawX; sprite.y = drawY; sprite.scale.set(scale); sprite.zIndex = zIndex;
        }
        this.boardContainer.sortableChildren = true;
    }

    private onDeadlockFixed(id: number, type: number) {
        const cell = this.logic.cells[id];
        const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const globalPos = this.boardContainer.toGlobal({x: drawX, y: drawY});
        this.particles.spawn(globalPos.x, globalPos.y, this.activeColors[type]);
        this.soundManager.playPop();
        this.idleTime = 0; this.hintIndices = [];
    }

    private onGameFinished(reason: string) {
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, this.GAME_LOGICAL_WIDTH, this.GAME_LOGICAL_HEIGHT);
        overlay.fill({ color: 0x000000, alpha: 0.8 });
        this.addChild(overlay); 
        
        const text = new PIXI.Text({ text: `GAME OVER\n${reason}\nClick to Menu`, style: { fill: 0xFFFFFF, fontSize: 32, align: 'center' }});
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
        this.y = 0;

        const availableHeight = height / scale;
        const extraSpace = availableHeight - this.GAME_LOGICAL_HEIGHT;
        const boardY = this.GAME_LOGICAL_HEIGHT - (ROWS * TILE_SIZE) - 10;

        if (extraSpace > 0) {
            this.bgContainer.y = boardY + extraSpace;
            this.boardContainer.y = boardY + extraSpace;
        } else {
            this.bgContainer.y = boardY;
            this.boardContainer.y = boardY;
        }
    }
}