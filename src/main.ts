import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { InputController } from './InputController';
import { ParticleSystem } from './ParticleSystem';
import { ScoreUI } from './ScoreUI';
import { SoundManager } from './SoundManager';
import { COLS, ROWS, TILE_SIZE, GAP, CellState, GAME_LIMIT_MODE, GAME_LIMIT_VALUE, GAME_SEED } from './Config';
import { Random } from './Random';

const app = new PIXI.Application();

async function init() {
// 1. INICJALIZACJA RNG
    // Dzięki temu start gry zawsze będzie taki sam dla tego samego numeru
    Random.setSeed(GAME_SEED);
    console.log(`🎲 RNG Seed set to: ${GAME_SEED}`);

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

    window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = ''; 
    });

    const gameContainer = new PIXI.Container();
    app.stage.addChild(gameContainer);

    // --- SYSTEMY ---
    const soundManager = new SoundManager();
    const particles = new ParticleSystem(app);
    const logic = new BoardLogic();
    
    logic.onBadMove = () => {
        soundManager.playBadMove();
        if (navigator.vibrate) navigator.vibrate(50);
    };
    
    // Callback Końca Gry
    logic.onGameFinished = (reason) => {
        // Tutaj w przyszłości dodasz wyświetlanie ekranu "Koniec Gry"
        // Na razie przyciemniamy planszę
        if (reason === 'LIMIT_REACHED') {
            const overlay = new PIXI.Graphics();
            overlay.rect(0, 0, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);
            overlay.fill({ color: 0x000000, alpha: 0.7 });
            gameContainer.addChild(overlay);
            
            const text = new PIXI.Text({ text: 'GAME OVER', style: { fill: 0xFFFFFF, fontSize: 40, fontWeight: 'bold' }});
            text.anchor.set(0.5);
            text.x = GAME_LOGICAL_WIDTH / 2;
            text.y = GAME_LOGICAL_HEIGHT / 2;
            gameContainer.addChild(text);
        }
    };

    // --- WARSTWY ---

    // 1. UI (Paski)
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
    const scoreUI = new ScoreUI(colors, MARGIN, 100); 
    // @ts-ignore
    gameContainer.addChild(scoreUI.container);

    // --- NOWOŚĆ: UI STANU GRY (Tekst Ruchów/Czasu) ---
    const statusText = new PIXI.Text({
        text: '',
        style: {
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: 0xFFFFFF,
            stroke: { color: 0x000000, width: 3 }
        }
    });
    statusText.anchor.set(1, 0); // Prawy górny róg
    statusText.x = GAME_LOGICAL_WIDTH - MARGIN;
    statusText.y = MARGIN;
    gameContainer.addChild(statusText);


    const boardLocalY = GAME_LOGICAL_HEIGHT - BOARD_HEIGHT - MARGIN;
    const boardLocalX = MARGIN;

    // 2. TŁO PLANSZY
    const bgContainer = new PIXI.Container();
    bgContainer.x = boardLocalX;
    bgContainer.y = boardLocalY;
    gameContainer.addChild(bgContainer);

    const boardBg = new PIXI.Graphics();
    const totalW = COLS * TILE_SIZE;
    const totalH = ROWS * TILE_SIZE;
    boardBg.rect(-GAP, -GAP, totalW + GAP, totalH + GAP);
    boardBg.fill({ color: 0x000000, alpha: 0.5 });
    boardBg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 });
    bgContainer.addChild(boardBg);

    for(let i=0; i<COLS * ROWS; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const slot = new PIXI.Graphics();
        slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
        slot.fill({ color: 0x000000, alpha: 0.6 }); 
        slot.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.05 });
        slot.x = col * TILE_SIZE;
        slot.y = row * TILE_SIZE;
        bgContainer.addChild(slot);
    }

    // 3. KLOCKI
    const boardContainer = new PIXI.Container();
    boardContainer.x = boardLocalX;
    boardContainer.y = boardLocalY;
    gameContainer.addChild(boardContainer);

    const mask = new PIXI.Graphics();
    mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
    mask.fill(0xffffff);
    boardContainer.addChild(mask);
    boardContainer.mask = mask;

    const input = new InputController(logic, app, boardContainer, soundManager);

    // --- GENEROWANIE SPRITE'ÓW ---
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

    // --- ZMIENNE EFEKTÓW ---
    let shakeIntensity = 0;
    let baseContainerX = 0;
    let baseContainerY = 0;

    // --- SYSTEM HINT & DEADLOCK ---
    let idleTime = 0;           
    let hintIndices: number[] = []; 
    let hintPulseTimer = 0;     

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', () => {
        idleTime = 0;
        hintIndices = []; 
    });

    const resize = () => {
        const screenWidth = app.screen.width;
        const screenHeight = app.screen.height;
        const scaleX = screenWidth / GAME_LOGICAL_WIDTH;
        const scaleY = screenHeight / GAME_LOGICAL_HEIGHT;
        const scale = Math.min(scaleX, scaleY); 

        gameContainer.scale.set(scale);
        baseContainerX = (screenWidth - GAME_LOGICAL_WIDTH * scale) / 2;
        baseContainerY = screenHeight - (GAME_LOGICAL_HEIGHT * scale);
        if (baseContainerY < 0) baseContainerY = 0;
        
        gameContainer.x = baseContainerX;
        gameContainer.y = baseContainerY;
    };

    window.addEventListener('resize', resize);
    resize(); 

    // --- GAME LOOP ---
    app.ticker.add((ticker) => {
        const delta = ticker.deltaTime;
        logic.update(delta);
        particles.update(delta);
        scoreUI.update(delta);

        // --- AKTUALIZACJA UI STANU ---
        if (GAME_LIMIT_MODE === 'MOVES') {
            statusText.text = `Moves: ${logic.movesUsed} / ${GAME_LIMIT_VALUE}`;
            // Zmień kolor na czerwony gdy blisko końca
            if (logic.movesUsed >= GAME_LIMIT_VALUE - 3) statusText.style.fill = 0xFF0000;
            else statusText.style.fill = 0xFFFFFF;
        } else if (GAME_LIMIT_MODE === 'TIME') {
            // Formatowanie czasu MM:SS
            const timeLeft = Math.max(0, GAME_LIMIT_VALUE - logic.timeElapsed);
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
            statusText.text = `Time: ${minutes}:${secStr}`;
             if (timeLeft <= 10) statusText.style.fill = 0xFF0000;
             else statusText.style.fill = 0xFFFFFF;
        } else {
            // Tryb bez limitu
            statusText.text = `Moves: ${logic.movesUsed}`;
        }


        // --- OBSŁUGA HINTA I DEADLOCKA ---
        if (logic.cells.every(c => c.state === CellState.IDLE) && logic.gameState === 'PLAYING') {
            idleTime += delta / 60.0; // Sekundy
            
            if (idleTime > 10.0 && hintIndices.length === 0) {
                const hint = logic.findHint();
                if (hint) {
                    hintIndices = hint;
                } else {
                    const fix = logic.findDeadlockFix();
                    if (fix) {
                        logic.cells[fix.id].typeId = fix.targetType;
                        
                        const cell = logic.cells[fix.id];
                        const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
                        const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
                        const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
                        particles.spawn(globalPos.x, globalPos.y, colors[fix.targetType]);
                        soundManager.playPop(); 
                        idleTime = 0; 
                    } else {
                        idleTime = 0; 
                    }
                }
            }
        } else {
            idleTime = 0;
            hintIndices = [];
        }

        if (hintIndices.length > 0) {
            hintPulseTimer += delta * 0.1;
        } else {
            hintPulseTimer = 0;
        }

        if (shakeIntensity > 0) {
            const offsetX = (Math.random() - 0.5) * shakeIntensity * 10;
            const offsetY = (Math.random() - 0.5) * shakeIntensity * 10;
            gameContainer.x = baseContainerX + offsetX;
            gameContainer.y = baseContainerY + offsetY;
            shakeIntensity -= 0.05 * delta;
        } else {
            gameContainer.x = baseContainerX;
            gameContainer.y = baseContainerY;
        }

        const selectedId = input.getSelectedId();
        const targetId = input.getTargetId();

        for(let i=0; i<logic.cells.length; i++) {
            const cell = logic.cells[i];
            const sprite = sprites[i] as any; 

            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) {
                sprite.visible = false;
                continue;
            }

            if (cell.state === CellState.EXPLODING) {
                if (!sprite.processed) {
                    const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
                    particles.spawn(globalPos.x, globalPos.y, colors[cell.typeId]);
                    scoreUI.addScore(cell.typeId);
                    soundManager.playPop();
                    if (navigator.vibrate) navigator.vibrate(40);
                    shakeIntensity = 0.8; 
                    sprite.processed = true;
                }
                sprite.visible = true;
                sprite.x = drawX;
                sprite.y = drawY;
                const progress = Math.max(0, cell.timer / MAX_EXPLOSION_TIME);
                sprite.scale.set(progress); 
                sprite.tint = 0xFFFFFF; 
                sprite.alpha = progress; 
                continue;
            } else {
                sprite.processed = false;
            }

            let scale = 1.0;
            let zIndex = 0;
            let alpha = 1.0;

            if (cell.state === CellState.SWAPPING) {
                zIndex = 10;
            }
            else if (cell.id === selectedId) {
                scale = 1.15;
                zIndex = 20;
            }
            else if (cell.id === targetId) {
                scale = 0.85;
            }

            if (hintIndices.includes(cell.id)) {
                alpha = 0.75 + Math.sin(hintPulseTimer) * 0.25;
            }

            sprite.visible = true;
            sprite.alpha = alpha;
            sprite.tint = colors[cell.typeId];
            sprite.x = drawX;
            sprite.y = drawY;
            sprite.scale.set(scale);
            sprite.zIndex = zIndex;
        }
        
        boardContainer.sortableChildren = true; 
    });
}

init();