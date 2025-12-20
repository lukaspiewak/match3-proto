import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { GameManager } from './GameManager';
import { TILE_SIZE, COLS } from './Config';

// Abstrakcja Gracza
export abstract class PlayerController {
    protected manager: GameManager;
    protected logic: BoardLogic;
    public id: number;

    constructor(id: number, manager: GameManager, logic: BoardLogic) {
        this.id = id;
        this.manager = manager;
        this.logic = logic;
    }

    public abstract update(delta: number): void;
    public abstract onTurnStart(): void;
}

// Implementacja: CZŁOWIEK (Myszka + Dotyk/Swipe)
export class HumanPlayerController extends PlayerController {
    private selectedId: number = -1;
    private app: PIXI.Application;
    private boardContainer: PIXI.Container;

    // Zmienne do obsługi Swipe/Drag
    private isDragging: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private startId: number = -1;

    constructor(id: number, manager: GameManager, logic: BoardLogic, app: PIXI.Application, boardContainer: PIXI.Container) {
        super(id, manager, logic);
        this.app = app;
        this.boardContainer = boardContainer;
        this.setupInput();
    }

    private setupInput() {
        this.boardContainer.eventMode = 'static';
        // Nasłuchujemy pełnego cyklu zdarzeń dla obsługi Swipe
        this.boardContainer.on('pointerdown', (e) => this.onPointerDown(e));
        this.boardContainer.on('pointermove', (e) => this.onPointerMove(e));
        this.boardContainer.on('pointerup', (e) => this.onPointerUp(e));
        // Resetowanie gestu przy wyjściu poza obszar
        this.boardContainer.on('pointerupoutside', () => this.cancelDrag());
    }

    private getBoardPos(e: PIXI.FederatedPointerEvent): { col: number, row: number, id: number } | null {
        const localPos = this.boardContainer.toLocal(e.global);
        const col = Math.floor(localPos.x / TILE_SIZE);
        const row = Math.floor(localPos.y / TILE_SIZE);

        if (col >= 0 && col < COLS && row >= 0 && row < 9) { // 9 = ROWS
            return { col, row, id: col + row * COLS };
        }
        return null;
    }

    private onPointerDown(e: PIXI.FederatedPointerEvent) {
        if (!this.manager.isMyTurn(this.id)) return;

        const pos = this.getBoardPos(e);
        if (pos) {
            this.isDragging = true;
            this.startX = e.global.x;
            this.startY = e.global.y;
            this.startId = pos.id;

            // Jeśli nic nie jest zaznaczone, zaznaczamy ten klocek wstępnie
            // (ale jeśli zrobimy swipe, to zaznaczenie zniknie i wykona się ruch)
            if (this.selectedId === -1) {
                this.selectedId = pos.id;
            } else {
                // Jeśli kliknęliśmy w INNY klocek mając już zaznaczenie -> próba ruchu click-click
                this.tryMoveTo(pos.id);
            }
        }
    }

    private onPointerMove(e: PIXI.FederatedPointerEvent) {
        if (!this.isDragging || !this.manager.isMyTurn(this.id)) return;

        const deltaX = e.global.x - this.startX;
        const deltaY = e.global.y - this.startY;
        
        // Próg przesunięcia (np. połowa klocka lub sztywna wartość w pikselach)
        const THRESHOLD = TILE_SIZE * 0.5; 

        if (Math.abs(deltaX) > THRESHOLD || Math.abs(deltaY) > THRESHOLD) {
            // Wykryto SWIPE!
            let dirX = 0;
            let dirY = 0;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Ruch poziomy
                dirX = deltaX > 0 ? 1 : -1;
            } else {
                // Ruch pionowy
                dirY = deltaY > 0 ? 1 : -1;
            }

            // Wykonujemy ruch
            this.manager.requestMove(this.id, this.startId, dirX, dirY);

            // Po wykonaniu swipe resetujemy stan
            this.cancelDrag();
            this.selectedId = -1; // Usuwamy zaznaczenie wizualne
        }
    }

    private onPointerUp(e: PIXI.FederatedPointerEvent) {
        // Jeśli puściliśmy myszkę/palec, a nie było swipe'a, traktujemy to jako zwykłe kliknięcie
        if (this.isDragging) {
            const pos = this.getBoardPos(e);
            
            // Jeśli puszczamy na tym samym klocku co start, to jest to "wybór" (Click)
            // Jeśli puszczamy na innym, to może być próba Drag&Drop
            if (pos && pos.id !== this.startId) {
                this.tryMoveTo(pos.id);
            }
        }
        this.cancelDrag();
    }

    private cancelDrag() {
        this.isDragging = false;
        this.startId = -1;
    }

    // Pomocnicza funkcja do obsługi logiki "Click-Click" i "Drag-Drop"
    private tryMoveTo(targetId: number) {
        // Sprawdzamy czy targetId jest sąsiadem selectedId
        if (this.selectedId === -1) return;

        const diff = Math.abs(targetId - this.selectedId);
        const isAdjacent = (diff === 1 && Math.floor(targetId / COLS) === Math.floor(this.selectedId / COLS)) || diff === COLS;

        if (isAdjacent) {
            // Obliczamy kierunek
            let dirX = 0;
            let dirY = 0;
            if (targetId === this.selectedId + 1) dirX = 1;
            else if (targetId === this.selectedId - 1) dirX = -1;
            else if (targetId === this.selectedId + COLS) dirY = 1;
            else if (targetId === this.selectedId - COLS) dirY = -1;

            this.manager.requestMove(this.id, this.selectedId, dirX, dirY);
            this.selectedId = -1; // Reset po ruchu
        } else {
            // Kliknięcie w niesąsiadujący klocek = zmiana zaznaczenia
            this.selectedId = targetId;
        }
    }

    public update(delta: number): void {}

    public onTurnStart(): void {
        this.selectedId = -1;
        this.cancelDrag();
    }
    
    public getSelectedId(): number {
        if (!this.manager.isMyTurn(this.id)) return -1;
        return this.selectedId;
    }
}

// Implementacja: BOT
export class BotPlayerController extends PlayerController {
    private thinkTimer: number = 0;
    private readonly THINK_DELAY = 1.0; 

    public update(delta: number): void {
        this.thinkTimer += delta / 60.0;
        if (this.thinkTimer >= this.THINK_DELAY) {
            this.makeMove();
            this.thinkTimer = 0; 
        }
    }

    public onTurnStart(): void {
        this.thinkTimer = 0;
        console.log("🤖 BOT: Thinking...");
    }

    private makeMove() {
        const hint = this.logic.findHint();
        if (hint) {
            const idxA = hint[0];
            const idxB = hint[1];
            const colA = idxA % COLS; const rowA = Math.floor(idxA / COLS);
            const colB = idxB % COLS; const rowB = Math.floor(idxB / COLS);
            const dirX = colB - colA;
            const dirY = rowB - rowA;
            console.log("🤖 BOT: Found move!");
            this.manager.requestMove(this.id, idxA, dirX, dirY);
        } else {
            console.log("🤖 BOT: No moves found");
        }
    }
}