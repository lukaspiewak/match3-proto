import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { COLS, ROWS, TILE_SIZE } from './Config';
import { SoundManager } from './SoundManager'; // <-- Upewnij się, że import jest

export class InputController {
    private logic: BoardLogic;
    private boardContainer: PIXI.Container;
    private soundManager: SoundManager; // <-- Pole klasy

    private startX = 0;
    private startY = 0;

    private currentX = 0;
    private currentY = 0;
    private isDragging = false;

    private selectedId = -1;
    private app: PIXI.Application;

    // WAŻNE: Tutaj musiał być błąd. Dodajemy 'soundManager' do argumentów (w nawiasie)
    constructor(logic: BoardLogic, app: PIXI.Application, boardContainer: PIXI.Container, soundManager: SoundManager) {
        this.logic = logic;
        this.app = app;
        this.boardContainer = boardContainer;
        this.soundManager = soundManager; // <-- Teraz to zadziała, bo jest w argumentach wyżej

        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;

        this.app.stage.on('pointerdown', this.onDown.bind(this));
        this.app.stage.on('pointermove', this.onMove.bind(this));
        this.app.stage.on('pointerup', this.onUp.bind(this));
        this.app.stage.on('pointerupoutside', this.onUp.bind(this));
    }

    private onDown(e: PIXI.FederatedPointerEvent) {
        // Inicjalizacja dźwięku przy pierwszym kliknięciu (wymóg przeglądarek)
        this.soundManager.init();

        const localPos = this.boardContainer.toLocal(e.global);
        const col = Math.floor(localPos.x / TILE_SIZE);
        const row = Math.floor(localPos.y / TILE_SIZE);

        if (col >= 0 && col < COLS && row >= 0 && this.logic.cells[col + row * COLS]) {
            this.selectedId = col + row * COLS;
            this.startX = e.global.x;
            this.startY = e.global.y;

            this.currentX = e.global.x;
            this.currentY = e.global.y;
            this.isDragging = true;
        }
    }

    private onMove(e: PIXI.FederatedPointerEvent) {
        if (!this.isDragging) return;
        this.currentX = e.global.x;
        this.currentY = e.global.y;
    }

    private onUp(e: PIXI.FederatedPointerEvent) {
        if (this.selectedId === -1) return;

        const diffX = e.global.x - this.startX;
        const diffY = e.global.y - this.startY;

        if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
            let dirX = 0;
            let dirY = 0;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                dirX = diffX > 0 ? 1 : -1;
            } else {
                dirY = diffY > 0 ? 1 : -1;
            }

            this.logic.trySwap(this.selectedId, dirX, dirY);

            // Dźwięk SWAP
            this.soundManager.playSwap();
            // DODAJ WIBRACJĘ PRZY RUCHU (Bardzo krótka - 10ms)
            if (navigator.vibrate) navigator.vibrate(10);
        }

        this.selectedId = -1;
        this.isDragging = false;
    }

    public getSelectedId(): number {
        return this.selectedId;
    }

    public getTargetId(): number {
        if (this.selectedId === -1 || !this.isDragging) return -1;

        const diffX = this.currentX - this.startX;
        const diffY = this.currentY - this.startY;

        if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) return -1;

        const col = this.selectedId % COLS;
        const row = Math.floor(this.selectedId / COLS);

        let targetCol = col;
        let targetRow = row;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            targetCol += (diffX > 0) ? 1 : -1;
        } else {
            targetRow += (diffY > 0) ? 1 : -1;
        }

        if (targetCol >= 0 && targetCol < COLS && targetRow >= 0 && targetRow < ROWS) {
            return targetCol + targetRow * COLS;
        }

        return -1;
    }
}