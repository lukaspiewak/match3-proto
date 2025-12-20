import * as PIXI from 'pixi.js';
import { BoardLogic } from './BoardLogic';
import { GameManager } from './GameManager';
import { TILE_SIZE, COLS } from './Config';
import { SoundManager } from './SoundManager';

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

export class HumanPlayerController extends PlayerController {
    private selectedId: number = -1;
    private app: PIXI.Application;
    private boardContainer: PIXI.Container;
    private soundManager: SoundManager;

    private isDragging: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private startId: number = -1;

    constructor(id: number, manager: GameManager, logic: BoardLogic, app: PIXI.Application, boardContainer: PIXI.Container, soundManager: SoundManager) {
        super(id, manager, logic);
        this.app = app;
        this.boardContainer = boardContainer;
        this.soundManager = soundManager;
        this.setupInput();
    }

    private setupInput() {
        this.boardContainer.eventMode = 'static';
        this.boardContainer.on('pointerdown', (e) => this.onPointerDown(e));
        this.boardContainer.on('pointermove', (e) => this.onPointerMove(e));
        this.boardContainer.on('pointerup', (e) => this.onPointerUp(e));
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
        this.soundManager.init();
        if (!this.manager.isMyTurn(this.id)) return;

        const pos = this.getBoardPos(e);
        if (pos) {
            this.isDragging = true;
            this.startX = e.global.x;
            this.startY = e.global.y;
            this.startId = pos.id;

            if (this.selectedId === -1) {
                this.selectedId = pos.id;
            } else {
                this.tryMoveTo(pos.id);
            }
        }
    }

    private onPointerMove(e: PIXI.FederatedPointerEvent) {
        if (!this.isDragging || !this.manager.isMyTurn(this.id)) return;

        const deltaX = e.global.x - this.startX;
        const deltaY = e.global.y - this.startY;
        
        const THRESHOLD = TILE_SIZE * 0.5; 

        if (Math.abs(deltaX) > THRESHOLD || Math.abs(deltaY) > THRESHOLD) {
            let dirX = 0;
            let dirY = 0;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                dirX = deltaX > 0 ? 1 : -1;
            } else {
                dirY = deltaY > 0 ? 1 : -1;
            }

            this.manager.requestMove(this.id, this.startId, dirX, dirY);
            this.cancelDrag();
            this.selectedId = -1; 
        }
    }

    private onPointerUp(e: PIXI.FederatedPointerEvent) {
        if (this.isDragging) {
            const pos = this.getBoardPos(e);
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

    private tryMoveTo(targetId: number) {
        if (this.selectedId === -1) return;

        const diff = Math.abs(targetId - this.selectedId);
        const isAdjacent = (diff === 1 && Math.floor(targetId / COLS) === Math.floor(this.selectedId / COLS)) || diff === COLS;

        if (isAdjacent) {
            let dirX = 0;
            let dirY = 0;
            if (targetId === this.selectedId + 1) dirX = 1;
            else if (targetId === this.selectedId - 1) dirX = -1;
            else if (targetId === this.selectedId + COLS) dirY = 1;
            else if (targetId === this.selectedId - COLS) dirY = -1;

            this.manager.requestMove(this.id, this.selectedId, dirX, dirY);
            this.selectedId = -1; 
        } else {
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