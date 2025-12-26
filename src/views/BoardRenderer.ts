import * as PIXI from 'pixi.js';
import { BoardLogic } from '../BoardLogic';
import { BlockView } from './BlockView';
import { ParticleSystem } from '../ParticleSystem';
import { BlockRegistry } from '../BlockDef';
import { TILE_SIZE, GAP, CellState, COLS, ROWS, CurrentTheme, VisualConfig } from '../Config';

export class BoardRenderer extends PIXI.Container {
    private board: BoardLogic;
    private app: PIXI.Application;
    
    // Kontener grupujący (dla efektu Shake)
    // Wszystko co ma się trząść (tło, klocki, cząsteczki) trafia tutaj.
    private shakeContainer: PIXI.Container;

    // Pod-kontenery
    private bgContainer: PIXI.Container;
    private blocksContainer: PIXI.Container;
    
    // Elementy wizualne
    private sprites: BlockView[] = [];
    private particles: ParticleSystem;
    
    // Stan wizualny wstrząsów
    private shakeTimer = 0;
    private shakeIntensity = 0;
    
    // Wskazówki (Hints)
    private hintIndices: number[] = [];
    private hintPulseTimer = 0;

    constructor(app: PIXI.Application, board: BoardLogic) {
        super();
        this.app = app;
        this.board = board;

        // 1. Tworzymy kontener pośredni dla efektu Shake
        this.shakeContainer = new PIXI.Container();
        this.addChild(this.shakeContainer);

        this.bgContainer = new PIXI.Container();
        this.blocksContainer = new PIXI.Container();
        
        // 2. Dodajemy warstwy do kontenera Shake
        this.shakeContainer.addChild(this.bgContainer);
        this.shakeContainer.addChild(this.blocksContainer);

        // 3. System cząsteczek też musi być w shakeContainer
        this.particles = new ParticleSystem(app); 
        this.shakeContainer.addChild(this.particles.container);

        this.setupBackground();
        
        // 4. Podpięcie zdarzeń (konstruktor wywołuje to raz, ale GameScene może to zresetować)
        this.bindEvents();
    }

    private setupBackground() {
        const boardBg = new PIXI.Graphics();
        boardBg.rect(-GAP, -GAP, (COLS * TILE_SIZE) + GAP, (ROWS * TILE_SIZE) + GAP);
        boardBg.fill({ color: CurrentTheme.panelBg, alpha: 1.0 });
        this.bgContainer.addChild(boardBg);

        for(let i=0; i<COLS * ROWS; i++) {
            const col = i % COLS; const row = Math.floor(i / COLS);
            const slot = new PIXI.Graphics();
            slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
            slot.fill({ color: CurrentTheme.slotBg, alpha: 1.0 });
            slot.x = col * TILE_SIZE; slot.y = row * TILE_SIZE;
            this.bgContainer.addChild(slot);
        }

        // Maska dla klocków (żeby nie wychodziły poza planszę przy wlatywaniu)
        const mask = new PIXI.Graphics();
        mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
        mask.fill(0xffffff);
        this.blocksContainer.addChild(mask);
        this.blocksContainer.mask = mask;
    }

    // --- OBSŁUGA ZDARZEŃ ---

    private onExplode = (data: { id: number, typeId: number, x: number, y: number }) => {
        const drawX = data.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = data.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        
        const blockDef = BlockRegistry.getById(data.typeId);
        this.particles.spawn(drawX, drawY, blockDef ? blockDef.color : 0xFFFFFF);
        
        // Mocny wstrząs przy wybuchu
        this.triggerShake(VisualConfig.SHAKE_DURATION, VisualConfig.SHAKE_STRENGTH); 
    };

    private onDamage = (data: { id: number, hp: number, maxHp: number }) => {
        const drawX = (data.id % COLS) * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = Math.floor(data.id / COLS) * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        
        const cell = this.board.cells[data.id];
        const blockDef = BlockRegistry.getById(cell.typeId);
        const color = blockDef ? blockDef.color : 0xFFFFFF;

        // Odpryski (standardowy spawn cząsteczek wygląda dobrze jako kruszenie)
        this.particles.spawn(drawX, drawY, color);

        // Lekki wstrząs przy pęknięciu
        this.triggerShake(0.1, 2); 
    };

    // Publiczna metoda do (ponownego) podpięcia zdarzeń
    public bindEvents() {
        // Najpierw usuwamy stare listenery, żeby nie dublować subskrypcji
        this.board.off('explode', this.onExplode);
        this.board.off('damage', this.onDamage);
        
        this.board.on('explode', this.onExplode);
        this.board.on('damage', this.onDamage);
    }

    // --- CYKL ŻYCIA I RENDEROWANIE ---

    public initVisuals() {
        this.sprites.forEach(s => s.destroy());
        this.sprites = [];
        this.blocksContainer.removeChildren();
        
        // Przywracamy maskę po czyszczeniu kontenera
        const mask = new PIXI.Graphics();
        mask.rect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
        mask.fill(0xffffff);
        this.blocksContainer.addChild(mask);
        this.blocksContainer.mask = mask;

        // Tworzymy nowe widoki dla wszystkich klocków
        for(let i=0; i < this.board.cells.length; i++) {
            const blockView = new BlockView();
            this.blocksContainer.addChild(blockView);
            this.sprites.push(blockView);
        }
        this.hintIndices = [];
    }

    public update(delta: number, selectedId: number = -1) {
        this.particles.update(delta);
        this.updateShake(delta);
        this.updateHints(delta);
        this.renderBlocks(selectedId);
    }

    public setHints(indices: number[]) {
        this.hintIndices = indices;
    }

    public triggerShake(duration: number, intensity: number) {
        // Kumulujemy czas (z limitem), bierzemy max intensywność
        this.shakeTimer = Math.min(this.shakeTimer + duration, 0.6); 
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    private updateShake(delta: number) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= delta / 60.0;
            
            // Damping - wstrząs słabnie z czasem
            const damping = Math.max(0, this.shakeTimer / 0.6); 
            const currentIntensity = this.shakeIntensity * damping;

            const offsetX = (Math.random() * currentIntensity * 2) - currentIntensity;
            const offsetY = (Math.random() * currentIntensity * 2) - currentIntensity;
            
            // Przesuwamy shakeContainer względem 0,0
            this.shakeContainer.x = offsetX;
            this.shakeContainer.y = offsetY;
        } else {
            // Reset do pozycji bazowej
            this.shakeContainer.x = 0;
            this.shakeContainer.y = 0;
            this.shakeIntensity = 0;
        }
    }

    private updateHints(delta: number) {
        if (this.hintIndices.length > 0) this.hintPulseTimer += delta * 0.1;
        else this.hintPulseTimer = 0;
    }

    private renderBlocks(selectedId: number) {
        for(let i=0; i < this.board.cells.length; i++) {
            const cell = this.board.cells[i];
            const sprite = this.sprites[i]; 
            const drawX = cell.x * TILE_SIZE + (TILE_SIZE - GAP) / 2;
            const drawY = cell.y * TILE_SIZE + (TILE_SIZE - GAP) / 2;

            if (cell.typeId === -1) { 
                sprite.visible = false; 
                continue; 
            }

            // Animacja wybuchu (zanikanie)
            if (cell.state === CellState.EXPLODING) {
                sprite.visible = true; 
                sprite.x = drawX; 
                sprite.y = drawY;
                const progress = Math.max(0, cell.timer / VisualConfig.EXPLOSION_DURATION); 
                sprite.scale.set(progress); 
                sprite.alpha = progress; 
                
                // Nawet przy wybuchu aktualizujemy visuals (żeby nie zniknęły nagle kolory)
                sprite.updateVisuals(cell.typeId, cell.hp, cell.maxHp);
                continue;
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
            
            // Efekt podpowiedzi (pulsowanie)
            if (this.hintIndices.includes(cell.id)) {
                alpha = 0.75 + Math.sin(this.hintPulseTimer) * 0.25;
            }

            sprite.visible = true; 
            sprite.alpha = alpha;
            sprite.zIndex = zIndex;
            sprite.x = drawX; 
            sprite.y = drawY; 
            sprite.scale.set(scale); 
            
            // Przekazanie HP do widoku (rysowanie pęknięć)
            sprite.updateVisuals(cell.typeId, cell.hp, cell.maxHp);
        }
        this.blocksContainer.sortableChildren = true;
    }
    
    // Metoda pomocnicza dla inputu - zwraca kontener interaktywny (tło)
    public getInputContainer(): PIXI.Container {
        return this.bgContainer; 
    }
}