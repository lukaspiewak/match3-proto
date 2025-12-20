import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { ParticleSystem } from './ParticleSystem';
import { ScoreUI } from './ScoreUI';
import { SoundManager } from './SoundManager';
import { 
    COLS, ROWS, TILE_SIZE, GAP, CellState, 
    GAME_SEED, CURRENT_GAME_MODE, PLAYER_ID_1, PLAYER_ID_2,
    GAME_LIMIT_MODE, GAME_LIMIT_VALUE 
} from './Config';
import { Random } from './Random';
import { GameManager } from './GameManager';
import { HumanPlayerController, BotPlayerController } from './PlayerController';

const app = new PIXI.Application();

async function init() {
    Random.setSeed(GAME_SEED);
    
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

    const gameContainer = new PIXI.Container();
    app.stage.addChild(gameContainer);

    const soundManager = new SoundManager();
    const particles = new ParticleSystem(app);
    
    // LOGIC & MANAGER
    const logic = new BoardLogic();
    logic.onBadMove = () => { soundManager.playBadMove(); if (navigator.vibrate) navigator.vibrate(50); };

    const gameManager = new GameManager(logic);

    // WARSTWY
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
    const scoreUI = new ScoreUI(colors, MARGIN, 100); 
    // @ts-ignore
    gameContainer.addChild(scoreUI.container);

    // STATUS UI (Góra Prawa)
    const statusText = new PIXI.Text({
        text: 'Init...',
        style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: 0xFFFFFF, stroke: { color: 0x000000, width: 3 } }
    });
    statusText.anchor.set(1, 0); 
    statusText.x = GAME_LOGICAL_WIDTH - MARGIN;
    statusText.y = MARGIN;
    gameContainer.addChild(statusText);

    // STATUS GRY UI (Góra Lewa - Limit gry)
    const limitText = new PIXI.Text({
        text: '',
        style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: 0xFFD700, stroke: { color: 0x000000, width: 3 } }
    });
    limitText.anchor.set(0, 0);
    limitText.x = MARGIN;
    limitText.y = MARGIN;
    gameContainer.addChild(limitText);

    const boardLocalY = GAME_LOGICAL_HEIGHT - BOARD_HEIGHT - MARGIN;
    const boardLocalX = MARGIN;
    const bgContainer = new PIXI.Container();
    bgContainer.x = boardLocalX; bgContainer.y = boardLocalY;
    gameContainer.addChild(bgContainer);

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
    boardContainer.x = boardLocalX; boardContainer.y = boardLocalY;
    gameContainer.addChild(boardContainer);
    
    const mask = new PIXI.Graphics();
    mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
    mask.fill(0xffffff);
    boardContainer.addChild(mask);
    boardContainer.mask = mask;

    // --- ZMIENNE DO SYSTEMU HINT ---
    let idleTime = 0;
    let hintIndices: number[] = [];
    let hintPulseTimer = 0;

    // Resetowanie licznika przy jakiejkolwiek interakcji
    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', () => {
        idleTime = 0;
        hintIndices = []; 
    });

    // --- CALLBACKI MANAGERA ---
    gameManager.onDeadlockFixed = (id, type) => {
        // Efekt wizualny naprawy planszy (niezależnie czy gracz czy bot)
        const cell = logic.cells[id];
        const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
        
        particles.spawn(globalPos.x, globalPos.y, colors[type]);
        soundManager.playPop();
        
        // Resetujemy idleTime po naprawie
        idleTime = 0;
        hintIndices = [];
    };

    gameManager.onGameFinished = (reason) => {
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);
        overlay.fill({ color: 0x000000, alpha: 0.8 });
        gameContainer.addChild(overlay);
        
        const text = new PIXI.Text({ text: `GAME OVER\n${reason}`, style: { fill: 0xFFFFFF, fontSize: 32, align: 'center' }});
        text.anchor.set(0.5);
        text.x = GAME_LOGICAL_WIDTH / 2; text.y = GAME_LOGICAL_HEIGHT / 2;
        gameContainer.addChild(text);
    };

    // --- GRACZE ---
    const human = new HumanPlayerController(PLAYER_ID_1, gameManager, logic, app, boardContainer, soundManager);
    gameManager.registerPlayer(human);

    if (CURRENT_GAME_MODE === 'VS_AI') {
        const bot = new BotPlayerController(PLAYER_ID_2, gameManager, logic);
        gameManager.registerPlayer(bot);
    } 

    gameManager.startGame();

    // SPRITY
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

    const resize = () => {
        const scale = Math.min(app.screen.width / GAME_LOGICAL_WIDTH, app.screen.height / GAME_LOGICAL_HEIGHT); 
        gameContainer.scale.set(scale);
        baseContainerX = (app.screen.width - GAME_LOGICAL_WIDTH * scale) / 2;
        baseContainerY = app.screen.height - (GAME_LOGICAL_HEIGHT * scale);
        if (baseContainerY < 0) baseContainerY = 0;
        gameContainer.x = baseContainerX; gameContainer.y = baseContainerY;
    };
    window.addEventListener('resize', resize); resize(); 

    // GAME LOOP
    app.ticker.add((ticker) => {
        const delta = ticker.deltaTime;
        
        gameManager.update(delta);
        logic.update(delta);
        particles.update(delta);
        scoreUI.update(delta);
        
        // --- OBSŁUGA HINTA I DEADLOCKA ---
        // Sprawdzamy czy gra trwa (!isGameOver) i czy plansza jest w spoczynku
        if (logic.cells.every(c => c.state === CellState.IDLE) && !gameManager.isGameOver) {
            idleTime += delta / 60.0; // Sekundy
            
            // Po 10 sekundach szukamy podpowiedzi
            if (idleTime > 10.0 && hintIndices.length === 0) {
                const hint = logic.findHint();
                if (hint) {
                    hintIndices = hint;
                } else {
                    // Sytuacja: Czas minął, a ruchu nie ma -> Deadlock
                    // GameManager ma własną obsługę na starcie tury, ale to jest fallback "w czasie rzeczywistym"
                    // dla gracza, który myśli > 10s.
                    const fix = logic.findDeadlockFix();
                    if (fix) {
                        // Aplikujemy fix wizualnie i logicznie
                        logic.cells[fix.id].typeId = fix.targetType;
                        gameManager.onDeadlockFixed?.(fix.id, fix.targetType);
                    } else {
                        idleTime = 0; // Reset, jeśli nawet fix się nie udał
                    }
                }
            }
        } else {
            // Jeśli coś się dzieje na planszy, resetujemy licznik
            idleTime = 0;
            hintIndices = [];
        }

        // Animacja pulsowania dla klocków z hinta
        if (hintIndices.length > 0) {
            hintPulseTimer += delta * 0.1;
        } else {
            hintPulseTimer = 0;
        }

        // UI: Status Tury
        statusText.text = gameManager.gameStatusText;
        if (gameManager.turnTimer < 5.0) statusText.style.fill = 0xFF0000;
        else statusText.style.fill = 0xFFFFFF;

        // UI: Globalny Limit
        if (GAME_LIMIT_MODE === 'MOVES') {
            limitText.text = `Moves Left: ${GAME_LIMIT_VALUE - gameManager.globalMovesMade}`;
        } else if (GAME_LIMIT_MODE === 'TIME') {
            const timeLeft = Math.max(0, GAME_LIMIT_VALUE - gameManager.globalTimeElapsed);
            const m = Math.floor(timeLeft / 60);
            const s = Math.floor(timeLeft % 60);
            limitText.text = `Time Left: ${m}:${s < 10 ? '0'+s : s}`;
        } else {
            limitText.text = 'Sandbox Mode';
        }

        const selectedId = human.getSelectedId(); 

        for(let i=0; i<logic.cells.length; i++) {
            const cell = logic.cells[i];
            const sprite = sprites[i] as any; 
            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) { sprite.visible = false; continue; }

            if (cell.state === CellState.EXPLODING) {
                if (!sprite.processed) {
                    const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
                    particles.spawn(globalPos.x, globalPos.y, colors[cell.typeId]);
                    scoreUI.addScore(cell.typeId);
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
            
            // --- APLIKACJA EFEKTU HINT ---
            if (hintIndices.includes(cell.id)) {
                alpha = 0.75 + Math.sin(hintPulseTimer) * 0.25;
            }

            sprite.visible = true; sprite.alpha = alpha; sprite.tint = colors[cell.typeId];
            sprite.x = drawX; sprite.y = drawY; sprite.scale.set(scale); sprite.zIndex = zIndex;
        }
        boardContainer.sortableChildren = true; 

        if (shakeIntensity > 0) {
            gameContainer.x = baseContainerX + (Math.random()-0.5)*shakeIntensity*10;
            gameContainer.y = baseContainerY + (Math.random()-0.5)*shakeIntensity*10;
            shakeIntensity -= 0.05 * delta;
        } else { gameContainer.x = baseContainerX; gameContainer.y = baseContainerY; }
    });
}

init();