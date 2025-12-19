import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { InputController } from './InputController';
import { ParticleSystem } from './ParticleSystem';
import { ScoreUI } from './ScoreUI';
import { SoundManager } from './SoundManager';
import { FloatingTextManager } from './FloatingText';
import { COLS, ROWS, TILE_SIZE, GAP, CellState } from './Config';

const app = new PIXI.Application();

async function init() {
    // --- KONFIGURACJA WYMIARÓW LOGICZNYCH ---
    const UI_HEIGHT = 150; 
    const MARGIN = 40; 
    const BOARD_WIDTH = COLS * TILE_SIZE;
    const BOARD_HEIGHT = ROWS * TILE_SIZE;
    
    // Wymiary "sceny", którą będziemy skalować
    const GAME_LOGICAL_WIDTH = BOARD_WIDTH + (MARGIN * 2);
    const GAME_LOGICAL_HEIGHT = BOARD_HEIGHT + UI_HEIGHT + (MARGIN * 2);

    // Inicjalizacja Pixi
    await app.init({ 
        resizeTo: window,
        backgroundColor: 0x1a1a1a,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);

    // Główny kontener gry (skalowany)
    const gameContainer = new PIXI.Container();
    app.stage.addChild(gameContainer);

    // --- SYSTEMY ---
    const soundManager = new SoundManager();
    const particles = new ParticleSystem(app);
    const floatingText = new FloatingTextManager();
    const logic = new BoardLogic();
    
    // Callback: Dźwięk błędu z logiki
    logic.onBadMove = () => {
        soundManager.playBadMove();
        // Krótka wibracja przy błędzie
        if (navigator.vibrate) navigator.vibrate(50);
    };

    // --- WARSTWY ---

    // 1. UI (Góra)
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
    const scoreUI = new ScoreUI(colors, MARGIN);
    // @ts-ignore (Dostęp do kontenera UI)
    gameContainer.addChild(scoreUI.container);

    // Pozycjonowanie planszy (Dół)
    const boardLocalY = GAME_LOGICAL_HEIGHT - BOARD_HEIGHT - MARGIN;
    const boardLocalX = MARGIN;

    // 2. TŁO PLANSZY
    const bgContainer = new PIXI.Container();
    bgContainer.x = boardLocalX;
    bgContainer.y = boardLocalY;
    gameContainer.addChild(bgContainer);

    for(let i=0; i<COLS * ROWS; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const slot = new PIXI.Graphics();
        slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
        slot.fill({ color: 0x000000, alpha: 0.3 }); 
        slot.x = col * TILE_SIZE;
        slot.y = row * TILE_SIZE;
        bgContainer.addChild(slot);
    }

    // 3. KLOCKI (Z Maską)
    const boardContainer = new PIXI.Container();
    boardContainer.x = boardLocalX;
    boardContainer.y = boardLocalY;
    gameContainer.addChild(boardContainer);

    const mask = new PIXI.Graphics();
    mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
    mask.fill(0xffffff);
    boardContainer.addChild(mask);
    boardContainer.mask = mask;

    // 4. Input Controller (Musi znać boardContainer i soundManager)
    const input = new InputController(logic, app, boardContainer, soundManager);

    // 5. Floating Text (Na wierzchu, wewnątrz gameContainer)
    gameContainer.addChild(floatingText.getContainer());

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

    // --- RESIZE HANDLER ---
    const resize = () => {
        const screenWidth = app.screen.width;
        const screenHeight = app.screen.height;
        const scaleX = screenWidth / GAME_LOGICAL_WIDTH;
        const scaleY = screenHeight / GAME_LOGICAL_HEIGHT;
        const scale = Math.min(scaleX, scaleY) * 0.95; 

        gameContainer.scale.set(scale);
        
        baseContainerX = (screenWidth - GAME_LOGICAL_WIDTH * scale) / 2;
        baseContainerY = (screenHeight - GAME_LOGICAL_HEIGHT * scale) / 2;
        
        gameContainer.x = baseContainerX;
        gameContainer.y = baseContainerY;
    };

    window.addEventListener('resize', resize);
    resize(); 

    // --- GAME LOOP ---
    app.ticker.add((ticker) => {
        // Aktualizacja podsystemów
        logic.update(ticker.deltaTime);
        particles.update(ticker.deltaTime);
        floatingText.update(ticker.deltaTime); 

        // Obsługa Screen Shake
        if (shakeIntensity > 0) {
            const offsetX = (Math.random() - 0.5) * shakeIntensity * 10;
            const offsetY = (Math.random() - 0.5) * shakeIntensity * 10;
            gameContainer.x = baseContainerX + offsetX;
            gameContainer.y = baseContainerY + offsetY;
            shakeIntensity -= 0.05 * ticker.deltaTime;
        } else {
            gameContainer.x = baseContainerX;
            gameContainer.y = baseContainerY;
        }

        const selectedId = input.getSelectedId();
        const targetId = input.getTargetId();

        // Pętla renderowania klocków
        for(let i=0; i<logic.cells.length; i++) {
            const cell = logic.cells[i];
            const sprite = sprites[i];

            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) {
                sprite.visible = false;
                continue;
            }

            // --- MOMENT WYBUCHU ---
            if (cell.state === CellState.EXPLODING) {
                if (sprite.alpha === 1.0 && sprite.visible === true) {
                    // 1. Particle (Globalne współrzędne - bo są na app.stage)
                    const globalPos = boardContainer.toGlobal({x: drawX, y: drawY});
                    particles.spawn(globalPos.x, globalPos.y, colors[cell.typeId]);
                    
                    // 2. Floating Text (Lokalne współrzędne - bo jest w gameContainer)
                    // boardContainer.x/y to pozycja planszy wewnątrz gameContainer
                    // drawX/drawY to pozycja klocka wewnątrz planszy
                    const localX = boardContainer.x + drawX;
                    const localY = boardContainer.y + drawY;
                    floatingText.spawn(localX, localY, 1, colors[cell.typeId]);

                    // 3. Reszta efektów
                    scoreUI.addScore(cell.typeId);
                    soundManager.playPop();

                    if (navigator.vibrate) navigator.vibrate(40);
                    
                    shakeIntensity = 0.8; 
                }

                // Animacja znikania (Implozja)
                sprite.visible = true;
                sprite.x = drawX;
                sprite.y = drawY;
                const progress = Math.max(0, cell.timer / MAX_EXPLOSION_TIME);
                sprite.scale.set(progress); 
                sprite.tint = 0xFFFFFF; 
                sprite.alpha = progress; 
                continue;
            }

            // --- STANDARDOWE RYSOWANIE ---
            let scale = 1.0;
            let zIndex = 0;
            let alpha = 1.0;

            if (cell.state === CellState.SWAPPING) {
                zIndex = 10;
            }
            else if (cell.id === selectedId) {
                scale = 1.15; // Selected pop
                zIndex = 20;
            }
            else if (cell.id === targetId) {
                scale = 0.85; // Target squeeze
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