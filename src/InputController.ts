import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { COLS, TILE_SIZE } from './Config';

export class InputController {
    private logic: BoardLogic;
    private startX = 0;
    private startY = 0;
    private selectedId = -1;
    private app: PIXI.Application;
    
    // Nowe pola do przechowywania przesunięcia planszy
    private boardOffsetX: number;
    private boardOffsetY: number;

    constructor(logic: BoardLogic, app: PIXI.Application, offsetX: number, offsetY: number) {
        this.logic = logic;
        this.app = app;
        this.boardOffsetX = offsetX;
        this.boardOffsetY = offsetY;
        
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        
        this.app.stage.on('pointerdown', this.onDown.bind(this));
        this.app.stage.on('pointerup', this.onUp.bind(this));
    }

    private onDown(e: PIXI.FederatedPointerEvent) {
        // Używamy dynamicznego offsetu zamiast sztywnego '20'
        // Odejmujemy pozycję planszy od pozycji kliknięcia
        const relativeX = e.global.x - this.boardOffsetX;
        const relativeY = e.global.y - this.boardOffsetY;
        
        const col = Math.floor(relativeX / TILE_SIZE);
        const row = Math.floor(relativeY / TILE_SIZE);

        if (col >= 0 && col < COLS && row >= 0 && this.logic.cells[col + row * COLS]) {
            this.selectedId = col + row * COLS;
            this.startX = e.global.x;
            this.startY = e.global.y;
        }
    }

    private onUp(e: PIXI.FederatedPointerEvent) {
        if (this.selectedId === -1) return;

        const diffX = e.global.x - this.startX;
        const diffY = e.global.y - this.startY;

        if (Math.abs(diffX) > 20 || Math.abs(diffY) > 20) {
            let dirX = 0;
            let dirY = 0;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                dirX = diffX > 0 ? 1 : -1;
            } else {
                dirY = diffY > 0 ? 1 : -1;
            }
            
            this.logic.trySwap(this.selectedId, dirX, dirY);
        }
        this.selectedId = -1;
    }
}