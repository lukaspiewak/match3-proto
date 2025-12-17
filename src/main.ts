import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { InputController } from './InputController';
import { ParticleSystem } from './ParticleSystem';
import { ScoreUI } from './ScoreUI';
import { COLS, ROWS, TILE_SIZE, GAP, CellState } from './Config';

const app = new PIXI.Application();

async function init() {
    const UI_HEIGHT = 150; 
    const BOARD_HEIGHT = ROWS * TILE_SIZE;
    const MARGIN = 20;

    // Całkowita wysokość aplikacji
    const TOTAL_HEIGHT = BOARD_HEIGHT + UI_HEIGHT + (MARGIN * 3);

    await app.init({ 
        width: COLS * TILE_SIZE + (MARGIN * 2), 
        height: TOTAL_HEIGHT,
        backgroundColor: 0x1a1a1a 
    });
    document.body.appendChild(app.canvas);

    // --- KALKULACJA POZYCJI ---
    // UI na górze
    const uiY = MARGIN;
    
    // Plansza na samym dole (Total Height - Wysokość planszy - Margines dolny)
    const boardY = TOTAL_HEIGHT - BOARD_HEIGHT - MARGIN;
    const boardX = MARGIN;

    const logic = new BoardLogic();
    // Przekazujemy boardX i boardY do kontrolera!
    const input = new InputController(logic, app, boardX, boardY);
    const particles = new ParticleSystem(app);

    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];

    // --- 1. UI (GÓRA) ---
    const scoreUI = new ScoreUI(app, colors, uiY);

    // --- 2. TŁO PLANSZY (DÓŁ) ---
    const bgContainer = new PIXI.Container();
    bgContainer.x = boardX;
    bgContainer.y = boardY;
    app.stage.addChild(bgContainer);

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

    // --- 3. KLOCKI (DÓŁ) ---
    const boardContainer = new PIXI.Container();
    boardContainer.x = boardX;
    boardContainer.y = boardY;
    app.stage.addChild(boardContainer);

    // [NOWOŚĆ] MASKOWANIE
    // Tworzymy prostokąt o wymiarach planszy
    const mask = new PIXI.Graphics();
    mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
    mask.fill(0xffffff); // Kolor nie ma znaczenia, liczy się kształt
    
    // Dodajemy maskę do kontenera (żeby ruszała się razem z nim)
    boardContainer.addChild(mask);
    
    // Mówimy PixiJS: "Rysuj zawartość tego kontenera TYLKO tam, gdzie jest ten prostokąt"
    boardContainer.mask = mask;

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

    // --- GAME LOOP ---
    app.ticker.add((ticker) => {
        logic.update(ticker.deltaTime);
        particles.update(ticker.deltaTime);

        for(let i=0; i<logic.cells.length; i++) {
            const cell = logic.cells[i];
            const sprite = sprites[i];

            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) {
                sprite.visible = false;
                continue;
            }

            if (cell.state === CellState.EXPLODING) {
                if (sprite.alpha === 1.0 && sprite.visible === true) {
                    // Cząsteczki muszą uwzględniać przesunięcie planszy (boardX, boardY)!
                    particles.spawn(
                        boardX + drawX + 20, 
                        boardY + drawY + 20, 
                        colors[cell.typeId]
                    );
                    scoreUI.addScore(cell.typeId);
                }

                sprite.visible = true;
                sprite.x = drawX;
                sprite.y = drawY;
                const progress = Math.max(0, cell.timer / MAX_EXPLOSION_TIME);
                sprite.scale.set(progress); 
                sprite.tint = 0xFFFFFF; 
                sprite.alpha = progress; 
                continue;
            }

            sprite.visible = true;
            sprite.scale.set(1.0); 
            sprite.alpha = 1.0;    
            sprite.tint = colors[cell.typeId];
            sprite.x = drawX;
            sprite.y = drawY;
            sprite.zIndex = (cell.state === CellState.SWAPPING) ? 10 : 0;
        }
        
        boardContainer.sortableChildren = true; 
    });
}

init();