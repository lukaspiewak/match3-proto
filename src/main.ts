import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { InputController } from './InputController';
import { COLS, ROWS, TILE_SIZE, GAP } from './Config';

// 1. Setup Pixi
const app = new PIXI.Application();

async function init() {
    await app.init({ 
        width: COLS * TILE_SIZE + 40, 
        height: ROWS * TILE_SIZE + 40, 
        backgroundColor: 0x222222 
    });
    document.body.appendChild(app.canvas);

    // 2. Inicjalizacja Gry
    const logic = new BoardLogic();
    const input = new InputController(logic, app);

    // 3. Prosty Renderer (Tworzymy pulę obiektów Graphics)
    const sprites: PIXI.Graphics[] = [];
    const boardContainer = new PIXI.Container();
    boardContainer.x = 20;
    boardContainer.y = 20;
    app.stage.addChild(boardContainer);

    // Generujemy klocki
    for(let i=0; i<logic.cells.length; i++) {
        const g = new PIXI.Graphics();
        g.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
        g.fill(0xFFFFFF);
        boardContainer.addChild(g);
        sprites.push(g);
    }

    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];

    // 4. Game Loop
    app.ticker.add((ticker) => {
        // Update logiki
        logic.update(ticker.deltaTime);

        // Update widoku
        for(let i=0; i<logic.cells.length; i++) {
            const cell = logic.cells[i];
            const sprite = sprites[i];

            if (cell.typeId === -1) {
                sprite.visible = false;
            } else {
                sprite.visible = true;
                sprite.x = cell.x * TILE_SIZE;
                sprite.y = cell.y * TILE_SIZE;
                sprite.tint = colors[cell.typeId];
            }
        }
    });
}

init();