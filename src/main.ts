import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { ParticleSystem } from './ParticleSystem';
import { ScoreUI } from './ScoreUI';
import { SoundManager } from './SoundManager';
import { 
    COLS, ROWS, TILE_SIZE, GAP, CellState, 
    PLAYER_ID_1, PLAYER_ID_2, AppConfig, ALL_AVAILABLE_COLORS, type GravityDir 
} from './Config';
import { Random } from './Random';
import { GameManager } from './GameManager';
import { HumanPlayerController, BotPlayerController } from './PlayerController';

const app = new PIXI.Application();

// --- STATE MANAGEMENT ---
type AppState = 'MENU' | 'OPTIONS' | 'GAME';
let currentState: AppState = 'MENU';

// Kontenery ekranów
let menuContainer: PIXI.Container;
let optionsContainer: PIXI.Container;
let gameSceneContainer: PIXI.Container; 

// --- GAME LOGIC REFERENCJE ---
let gameManager: GameManager;
let logic: BoardLogic;
let soundManager: SoundManager;
let particles: ParticleSystem;
let scoreUI: ScoreUI;
let botScoreUI: ScoreUI; 
let humanPlayer: HumanPlayerController;

// Elementy UI do aktualizacji
let timerValueText: PIXI.Text;

// Zmienna przechowująca aktualnie wybraną paletę
let activeColors: number[] = [];

async function init() {
    Random.setSeed(AppConfig.seed);
    
    const UI_HEIGHT = 150; 
    const MARGIN = 10; 
    const BOARD_WIDTH = COLS * TILE_SIZE;
    const BOARD_HEIGHT = ROWS * TILE_SIZE;
    const GAME_LOGICAL_WIDTH = BOARD_WIDTH + (MARGIN * 2);
    const GAME_LOGICAL_HEIGHT = BOARD_HEIGHT + UI_HEIGHT + (MARGIN * 2);

    await app.init({ 
        resizeTo: window,
        backgroundColor: 0x1a1a1a,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // --- SETUP SCENE CONTAINERS ---
    const rootContainer = new PIXI.Container();
    app.stage.addChild(rootContainer);

    menuContainer = new PIXI.Container();
    optionsContainer = new PIXI.Container();
    gameSceneContainer = new PIXI.Container();

    rootContainer.addChild(menuContainer);
    rootContainer.addChild(optionsContainer);
    rootContainer.addChild(gameSceneContainer);

    switchState('MENU');

    // --- GAME SCENE SETUP ---
    soundManager = new SoundManager();
    particles = new ParticleSystem(app); 
    
    logic = new BoardLogic();
    logic.onBadMove = () => { soundManager.playBadMove(); if (navigator.vibrate) navigator.vibrate(50); };

    gameManager = new GameManager(logic);

    // ========================================================================
    // WARSTWA 1: PLANSZA (TŁO + KLOCKI)
    // ========================================================================
    const boardOriginalY = GAME_LOGICAL_HEIGHT - BOARD_HEIGHT - MARGIN;
    const boardLocalX = MARGIN;
    
    const bgContainer = new PIXI.Container();
    bgContainer.x = boardLocalX; 
    bgContainer.y = boardOriginalY;
    gameSceneContainer.addChild(bgContainer); 

    const boardBg = new PIXI.Graphics();
    boardBg.rect(-GAP, -GAP, (COLS * TILE_SIZE) + GAP, (ROWS * TILE_SIZE) + GAP);
    boardBg.fill({ color: 0x000000, alpha: 0.5 });
    bgContainer.addChild(boardBg);

    for(let i=0; i<COLS * ROWS; i++) {
        const col = i % COLS; const row = Math.floor(i / COLS);
        const slot = new PIXI.Graphics();
        slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
        slot.fill({ color: 0x000000, alpha: 0.6 }); 
        slot.x = col * TILE_SIZE; slot.y = row * TILE_SIZE;
        bgContainer.addChild(slot);
    }

    const boardContainer = new PIXI.Container();
    boardContainer.x = boardLocalX; 
    boardContainer.y = boardOriginalY;
    gameSceneContainer.addChild(boardContainer); 
    
    const mask = new PIXI.Graphics();
    mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
    mask.fill(0xffffff);
    boardContainer.addChild(mask);
    boardContainer.mask = mask;

    // ========================================================================
    // WARSTWA 2: UI (HUD)
    // ========================================================================
    
    // 1. LEWA: Panel Punktów (ScoreUI)
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
    scoreUI = new ScoreUI(colors, 0, 100); 
    scoreUI.container.x = MARGIN; 
    scoreUI.container.y = 20; 
    // @ts-ignore
    gameSceneContainer.addChild(scoreUI.container); 

    // 1b. PRAWA: Panel Punktów Bota
    botScoreUI = new ScoreUI(colors, 0, 100);
    botScoreUI.container.x = GAME_LOGICAL_WIDTH - MARGIN - 110; 
    botScoreUI.container.y = 20;
    // @ts-ignore
    gameSceneContainer.addChild(botScoreUI.container);

    // 2. ŚRODEK: Okrągły Stoper
    const timerContainer = new PIXI.Container();
    timerContainer.x = GAME_LOGICAL_WIDTH / 2;
    timerContainer.y = 45; 
    gameSceneContainer.addChild(timerContainer);

    const timerBg = new PIXI.Graphics();
    timerBg.circle(0, 0, 30); 
    timerBg.fill({ color: 0x222222 });
    timerBg.stroke({ width: 3, color: 0xFFD700 }); 
    timerContainer.addChild(timerBg);

    timerValueText = new PIXI.Text({
        text: '20',
        style: { fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }
    });
    timerValueText.anchor.set(0.5);
    timerContainer.addChild(timerValueText);

    const timerLabel = new PIXI.Text({
        text: 'LIMIT',
        style: { fontFamily: 'Arial', fontSize: 10, fill: 0xAAAAAA, align: 'center' }
    });
    timerLabel.anchor.set(0.5);
    timerLabel.y = 20; 
    timerContainer.addChild(timerLabel);

    // 3. PRAWA: Ikona Menu (☰)
    const menuBtn = createButton("☰", 50, 50, 0x444444, () => {
        gameManager.resetGame();
        switchState('MENU');
    });
    menuBtn.x = GAME_LOGICAL_WIDTH - MARGIN - 25; 
    menuBtn.y = 120; 
    gameSceneContainer.addChild(menuBtn);

    // 4. Czas Tury / Status
    const statusText = new PIXI.Text({
        text: 'Init...',
        style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: 0xFFFFFF, align: 'right', stroke: { color: 0x000000, width: 3 } }
    });
    statusText.anchor.set(1, 0.5); 
    statusText.x = menuBtn.x - 35; 
    statusText.y = menuBtn.y;      
    gameSceneContainer.addChild(statusText);

    // --- BUDOWA MENU (menuContainer) ---
    const titleText = new PIXI.Text({
        text: 'MATCH-3 ENGINE',
        style: { fontFamily: 'Arial', fontSize: 40, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center' }
    });
    titleText.anchor.set(0.5);
    titleText.x = GAME_LOGICAL_WIDTH / 2;
    titleText.y = 100;
    menuContainer.addChild(titleText);

    const btnPlaySolo = createButton("PLAY SOLO", 200, 60, 0x00AA00, () => {
        AppConfig.gameMode = 'SOLO';
        startGame();
    });
    btnPlaySolo.x = GAME_LOGICAL_WIDTH / 2; 
    btnPlaySolo.y = 200;
    menuContainer.addChild(btnPlaySolo);

    const btnVsAI = createButton("VS BOT", 200, 60, 0xAA0000, () => {
        AppConfig.gameMode = 'VS_AI';
        startGame();
    });
    btnVsAI.x = GAME_LOGICAL_WIDTH / 2;
    btnVsAI.y = 280;
    menuContainer.addChild(btnVsAI);

    const btnOptions = createButton("OPTIONS", 200, 60, 0x0000AA, () => {
        switchState('OPTIONS');
        refreshOptionsUI();
    });
    btnOptions.x = GAME_LOGICAL_WIDTH / 2;
    btnOptions.y = 360;
    menuContainer.addChild(btnOptions);

    // --- BUDOWA OPTIONS (optionsContainer) ---
    const optionsTitle = new PIXI.Text({ text: 'OPTIONS', style: { fill: 0xFFFFFF, fontSize: 32 } });
    optionsTitle.anchor.set(0.5);
    optionsTitle.x = GAME_LOGICAL_WIDTH / 2; optionsTitle.y = 50;
    optionsContainer.addChild(optionsTitle);

    let optY = 120;
    const createOptionToggle = (label: string, onClick: () => void) => {
        const btn = createButton(label, 300, 50, 0x444444, onClick);
        btn.x = GAME_LOGICAL_WIDTH / 2;
        btn.y = optY;
        optY += 70;
        optionsContainer.addChild(btn);
        return btn; 
    };

    const btnOptLimit = createOptionToggle("", () => {
        if (AppConfig.limitMode === 'NONE') AppConfig.limitMode = 'MOVES';
        else if (AppConfig.limitMode === 'MOVES') AppConfig.limitMode = 'TIME';
        else AppConfig.limitMode = 'NONE';
        refreshOptionsUI();
    });

    const btnOptVal = createOptionToggle("", () => {
        if (AppConfig.limitValue === 20) AppConfig.limitValue = 40;
        else if (AppConfig.limitValue === 40) AppConfig.limitValue = 60;
        else AppConfig.limitValue = 20;
        refreshOptionsUI();
    });

    const btnOptColors = createOptionToggle("", () => {
        AppConfig.blockTypes++;
        if (AppConfig.blockTypes > 7) AppConfig.blockTypes = 4;
        refreshOptionsUI();
    });

    // NOWOŚĆ: Przycisk Grawitacji
    const btnOptGravity = createOptionToggle("", () => {
        const dirs: GravityDir[] = ['DOWN', 'UP', 'LEFT', 'RIGHT'];
        const idx = dirs.indexOf(AppConfig.gravityDir);
        AppConfig.gravityDir = dirs[(idx + 1) % dirs.length];
        refreshOptionsUI();
    });

    const btnOptSeed = createOptionToggle("", () => {
        AppConfig.seed = Math.floor(Math.random() * 100000);
        refreshOptionsUI();
    });

    const btnOptBack = createButton("BACK", 100, 50, 0x555555, () => switchState('MENU'));
    btnOptBack.x = GAME_LOGICAL_WIDTH / 2;
    btnOptBack.y = GAME_LOGICAL_HEIGHT - 100;
    optionsContainer.addChild(btnOptBack);

    function refreshOptionsUI() {
        (btnOptLimit.children[1] as PIXI.Text).text = `LIMIT: ${AppConfig.limitMode}`;
        (btnOptVal.children[1] as PIXI.Text).text = `VALUE: ${AppConfig.limitValue}`;
        (btnOptColors.children[1] as PIXI.Text).text = `COLORS: ${AppConfig.blockTypes}`;
        (btnOptGravity.children[1] as PIXI.Text).text = `GRAVITY: ${AppConfig.gravityDir}`; // Aktualizacja tekstu grawitacji
        (btnOptSeed.children[1] as PIXI.Text).text = `SEED: ${AppConfig.seed}`;
    }

    function startGame() {
        switchState('GAME');
        Random.setSeed(AppConfig.seed);
        
        // Wybieramy kolory
        activeColors = ALL_AVAILABLE_COLORS.slice(0, AppConfig.blockTypes);

        if (scoreUI) gameSceneContainer.removeChild(scoreUI.container);
        if (botScoreUI) gameSceneContainer.removeChild(botScoreUI.container);

        scoreUI = new ScoreUI(activeColors, 0, 100);
        scoreUI.container.x = MARGIN; 
        scoreUI.container.y = 20; 
        // @ts-ignore
        gameSceneContainer.addChild(scoreUI.container);

        botScoreUI = new ScoreUI(activeColors, 0, 100);
        botScoreUI.container.x = GAME_LOGICAL_WIDTH - MARGIN - 110; 
        botScoreUI.container.y = 20;
        // @ts-ignore
        gameSceneContainer.addChild(botScoreUI.container);

        botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');

        gameManager.clearPlayers();
        humanPlayer = new HumanPlayerController(PLAYER_ID_1, gameManager, logic, boardContainer, soundManager);
        gameManager.registerPlayer(humanPlayer);

        if (AppConfig.gameMode === 'VS_AI') {
            const bot = new BotPlayerController(PLAYER_ID_2, gameManager, logic);
            gameManager.registerPlayer(bot);
        }

        gameManager.startGame();
    }

    gameManager.onDeadlockFixed = (id, type) => {
        const cell = logic.cells[id];
        const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
        particles.spawn(globalPos.x, globalPos.y, activeColors[type]);
        soundManager.playPop();
        idleTime = 0; hintIndices = [];
    };

    gameManager.onGameFinished = (reason) => {
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);
        overlay.fill({ color: 0x000000, alpha: 0.8 });
        gameSceneContainer.addChild(overlay); 
        
        const text = new PIXI.Text({ text: `GAME OVER\n${reason}\nClick to Menu`, style: { fill: 0xFFFFFF, fontSize: 32, align: 'center' }});
        text.anchor.set(0.5);
        text.x = GAME_LOGICAL_WIDTH / 2; text.y = GAME_LOGICAL_HEIGHT / 2;
        gameSceneContainer.addChild(text);

        text.eventMode = 'static';
        text.on('pointerdown', () => {
            gameSceneContainer.removeChild(overlay);
            gameSceneContainer.removeChild(text);
            switchState('MENU');
        });
    };

    const sprites: PIXI.Graphics[] = [];
    for(let i=0; i<logic.cells.length; i++) {
        const g = new PIXI.Graphics();
        g.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
        g.fill(0xFFFFFF);
        g.pivot.set((TILE_SIZE - GAP) / 2, (TILE_SIZE - GAP) / 2);
        boardContainer.addChild(g);
        sprites.push(g);
    }

    const MAX_EXPLOSION_TIME = 15.0; 
    let shakeIntensity = 0;
    let baseContainerX = 0; let baseContainerY = 0;

    let idleTime = 0;
    let hintIndices: number[] = [];
    let hintPulseTimer = 0;

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', () => {
        idleTime = 0;
        hintIndices = []; 
    });

    const resize = () => {
        const scale = Math.min(app.screen.width / GAME_LOGICAL_WIDTH, app.screen.height / GAME_LOGICAL_HEIGHT); 
        rootContainer.scale.set(scale);
        baseContainerX = (app.screen.width - GAME_LOGICAL_WIDTH * scale) / 2;
        baseContainerY = 0; 
        if (baseContainerY < 0) baseContainerY = 0;
        rootContainer.x = baseContainerX; 
        rootContainer.y = baseContainerY;

        const availableHeight = app.screen.height / scale;
        const extraSpace = availableHeight - GAME_LOGICAL_HEIGHT;

        if (extraSpace > 0) {
            bgContainer.y = boardOriginalY + extraSpace;
            boardContainer.y = boardOriginalY + extraSpace;
        } else {
            bgContainer.y = boardOriginalY;
            boardContainer.y = boardOriginalY;
        }
    };
    
    window.addEventListener('resize', resize); 
    resize(); 

    // --- GAME LOOP ---
    app.ticker.add((ticker) => {
        const delta = ticker.deltaTime;

        if (currentState === 'GAME') {
            gameManager.update(delta);
            logic.update(delta);
            particles.update(delta);
            
            if (scoreUI) scoreUI.update(delta);
            if (botScoreUI && botScoreUI.container.visible) botScoreUI.update(delta);
            
            if (logic.cells.every(c => c.state === CellState.IDLE) && !gameManager.isGameOver) {
                idleTime += delta / 60.0; 
                if (idleTime > 10.0 && hintIndices.length === 0) {
                    const hint = logic.findHint();
                    if (hint) {
                        hintIndices = hint;
                    } else {
                        const fix = logic.findDeadlockFix();
                        if (fix) {
                            logic.cells[fix.id].typeId = fix.targetType;
                            gameManager.onDeadlockFixed?.(fix.id, fix.targetType);
                        } else {
                            idleTime = 0; 
                        }
                    }
                }
            } else {
                idleTime = 0;
                hintIndices = [];
            }

            if (hintIndices.length > 0) hintPulseTimer += delta * 0.1;
            else hintPulseTimer = 0;

            statusText.text = gameManager.gameStatusText;
            if (gameManager.turnTimer < 5.0) statusText.style.fill = 0xFF0000;
            else statusText.style.fill = 0xFFFFFF;

            if (AppConfig.limitMode === 'MOVES') {
                timerLabel.text = 'MOVES';
                timerValueText.text = `${AppConfig.limitValue - gameManager.globalMovesMade}`;
            } else if (AppConfig.limitMode === 'TIME') {
                timerLabel.text = 'TIME';
                const timeLeft = Math.max(0, AppConfig.limitValue - gameManager.globalTimeElapsed);
                const m = Math.floor(timeLeft / 60);
                const s = Math.floor(timeLeft % 60);
                timerValueText.text = `${m}:${s < 10 ? '0'+s : s}`;
            } else {
                timerLabel.text = 'FREE';
                timerValueText.text = '∞';
            }

            const selectedId = humanPlayer ? humanPlayer.getSelectedId() : -1;

            for(let i=0; i<logic.cells.length; i++) {
                const cell = logic.cells[i];
                const sprite = sprites[i] as any; 
                const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
                const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

                if (cell.typeId === -1) { sprite.visible = false; continue; }

                if (cell.state === CellState.EXPLODING) {
                    if (!sprite.processed) {
                        const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
                        particles.spawn(globalPos.x, globalPos.y, activeColors[cell.typeId]);
                        
                        const currentId = gameManager.getCurrentPlayerId();
                        if (currentId === PLAYER_ID_1) {
                            scoreUI.addScore(cell.typeId);
                        } else if (currentId === PLAYER_ID_2) {
                            botScoreUI.addScore(cell.typeId);
                        } else {
                            scoreUI.addScore(cell.typeId);
                        }

                        soundManager.playPop();
                        shakeIntensity = 0.8; 
                        sprite.processed = true;
                    }
                    sprite.visible = true; sprite.x = drawX; sprite.y = drawY;
                    const progress = Math.max(0, cell.timer / MAX_EXPLOSION_TIME);
                    sprite.scale.set(progress); sprite.tint = 0xFFFFFF; sprite.alpha = progress; 
                    continue;
                } else { sprite.processed = false; }

                let scale = 1.0; let zIndex = 0; let alpha = 1.0;
                if (cell.state === CellState.SWAPPING) { zIndex = 10; }
                else if (cell.id === selectedId) { scale = 1.15; zIndex = 20; }
                
                if (hintIndices.includes(cell.id)) {
                    alpha = 0.75 + Math.sin(hintPulseTimer) * 0.25;
                }

                sprite.visible = true; sprite.alpha = alpha;
                sprite.tint = activeColors[cell.typeId];
                sprite.x = drawX; sprite.y = drawY; sprite.scale.set(scale); sprite.zIndex = zIndex;
            }
            boardContainer.sortableChildren = true; 

            if (shakeIntensity > 0) {
                rootContainer.x = baseContainerX + (Math.random()-0.5)*shakeIntensity*10;
                rootContainer.y = baseContainerY + (Math.random()-0.5)*shakeIntensity*10;
                shakeIntensity -= 0.05 * delta;
            } else { rootContainer.x = baseContainerX; rootContainer.y = baseContainerY; }
        }
    });
}

function switchState(newState: AppState) {
    currentState = newState;
    menuContainer.visible = (newState === 'MENU');
    optionsContainer.visible = (newState === 'OPTIONS');
    gameSceneContainer.visible = (newState === 'GAME');
}

function createButton(label: string, w: number, h: number, color: number, onClick: () => void) {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.rect(-w/2, -h/2, w, h); 
    bg.fill(color);
    bg.stroke({ width: 4, color: 0xFFFFFF });
    btn.addChild(bg);

    const txt = new PIXI.Text({ text: label, style: { fontFamily: 'Arial', fontSize: 20, fill: 0xFFFFFF, fontWeight: 'bold' } });
    txt.anchor.set(0.5);
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => { bg.alpha = 0.7; });
    btn.on('pointerup', () => { bg.alpha = 1.0; onClick(); });
    btn.on('pointerupoutside', () => { bg.alpha = 1.0; });

    return btn;
}

init();