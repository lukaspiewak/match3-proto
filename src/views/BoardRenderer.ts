import * as PIXI from 'pixi.js';
import { BoardLogic } from '../engine/BoardLogic';
import { BlockView } from './BlockView';
import { ParticleSystem } from '../ParticleSystem';
import { BlockRegistry } from '../engine/BlockDef';
import { TILE_SIZE, GAP, CellState, VOID, CurrentTheme, VisualConfig } from '../engine/Config';

export class BoardRenderer extends PIXI.Container {
    private board: BoardLogic;

    // Kontener grupujący (dla efektu Shake)
    // Wszystko co ma się trząść (tło, klocki, cząsteczki) trafia tutaj.
    private shakeContainer: PIXI.Container;

    // Pod-kontenery
    private bgContainer: PIXI.Container;
    private blocksContainer: PIXI.Container;
    
    // Elementy wizualne
    private sprites: BlockView[] = [];
    private slotGraphics: PIXI.Graphics[] = [];
    private particles: ParticleSystem;

    // Podgląd kolejnych bloków (nad kolumnami). Budowany leniwie.
    private previewContainer: PIXI.Container = new PIXI.Container();
    private previewTiles: PIXI.Graphics[] = [];
    private previewBuiltFor = ''; // sygnatura (styl|n|cols), by nie budować co klatkę
    // Stan animacji podglądu (płynne wchodzenie/morfowanie zamiast natychmiastowej podmiany).
    private previewRestX: number[] = [];
    private previewRestY: number[] = [];
    private previewCurColor: number[] = []; // aktualnie wyświetlany kolor (lerp do docelowego)
    private previewPrevId: number[] = [];   // ostatni id w slocie (detekcja zmiany)
    private previewSlide: number[] = [];     // 0..1 — świeżo zmieniony slot „wsuwa się" od wlotu
    
    // Stan wizualny wstrząsów
    private shakeTimer = 0;
    private shakeIntensity = 0;
    
    // Wskazówki (Hints)
    private hintIndices: number[] = [];
    private hintPulseTimer = 0;

    constructor(app: PIXI.Application, board: BoardLogic) {
        super();
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

        // Warstwa podglądu kolejnych bloków (nad planszą, skaluje/trzęsie się z nią).
        this.shakeContainer.addChild(this.previewContainer);

        // 4. Podpięcie zdarzeń (konstruktor wywołuje to raz, ale GameScene może to zresetować)
        this.bindEvents();
    }

    private setupBackground() {
        const cols = this.board.cols;
        const rows = this.board.rows;
        const boardBg = new PIXI.Graphics();
        boardBg.rect(-GAP, -GAP, (cols * TILE_SIZE) + GAP, (rows * TILE_SIZE) + GAP);
        boardBg.fill({ color: CurrentTheme.panelBg, alpha: 1.0 });
        this.bgContainer.addChild(boardBg);

        this.slotGraphics = [];
        for(let i=0; i<cols * rows; i++) {
            const col = i % cols; const row = Math.floor(i / cols);
            const slot = new PIXI.Graphics();
            slot.rect(0, 0, TILE_SIZE - GAP, TILE_SIZE - GAP);
            slot.fill({ color: CurrentTheme.slotBg, alpha: 1.0 });
            slot.x = col * TILE_SIZE; slot.y = row * TILE_SIZE;
            this.bgContainer.addChild(slot);
            this.slotGraphics[i] = slot;
        }

        // Maska dla klocków (żeby nie wychodziły poza planszę przy wlatywaniu)
        const mask = new PIXI.Graphics();
        mask.rect(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
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
        const cols = this.board.cols;
        const drawX = (data.id % cols) * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        const drawY = Math.floor(data.id / cols) * TILE_SIZE + (TILE_SIZE - GAP) / 2;
        
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
        mask.rect(0, 0, this.board.cols * TILE_SIZE, this.board.rows * TILE_SIZE);
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
        this.updatePreview(delta);
    }

    /**
     * Rysuje minimalistyczny podgląd N kolejnych bloków przy KRAWĘDZI WLOTU
     * (przeciwnej do grawitacji): DOWN→góra, UP→dół, RIGHT→lewa, LEFT→prawa.
     * Tor = kolumna (grawitacja pionowa) lub rząd (pozioma) — spójnie z silnikiem.
     */
    private updatePreview(delta: number = 1) {
        const n = this.board.config.previewCount ?? 0;
        if (n <= 0) { this.previewContainer.visible = false; return; }
        this.previewContainer.visible = true;

        const cols = this.board.cols, rows = this.board.rows;
        const style = this.board.config.previewStyle ?? 'bars';
        const dir = this.board.gravityDir; // żywy kierunek (obsługuje zmianę grawitacji w locie)
        const inner = TILE_SIZE - GAP;
        const boardW = cols * TILE_SIZE, boardH = rows * TILE_SIZE;

        const isVertical = dir === 'DOWN' || dir === 'UP';
        const lanes = isVertical ? cols : rows;
        // Baza krawędzi wlotu i znak "na zewnątrz" (poza planszę).
        const sign = (dir === 'DOWN' || dir === 'RIGHT') ? -1 : 1;
        const base = dir === 'UP' ? boardH : dir === 'LEFT' ? boardW : 0;

        // Parametry animacji „juicy" (spójne dla pasków/kropek).
        const dtSec = delta / 60;
        const SLIDE_PX = 8;                 // dystans wsuwania świeżego slotu od wlotu
        const morph = Math.min(1, dtSec * 14); // szybkość morfowania koloru (płynne, nie skokowe)
        const slideDecay = Math.min(1, dtSec / 0.2);

        // Pozycja kafla toru L, slotu j (j=0 = następny, najbliżej planszy).
        const place = (tile: PIXI.Graphics, L: number, j: number) => {
            const alongCenter = L * TILE_SIZE + inner / 2; // środek toru wzdłuż krawędzi
            if (style === 'bars') {
                const step = 7 + 3;               // grubość paska + odstęp
                const d = base + sign * (j + 1) * step;
                if (isVertical) { tile.x = alongCenter; tile.y = d; }
                else { tile.x = d; tile.y = alongCenter; }
            } else {
                const gap = 3;
                const dot = Math.min((inner - (n - 1) * gap) / n, inner * 0.5);
                const totalAlong = n * dot + (n - 1) * gap;
                const along = alongCenter - totalAlong / 2 + dot / 2 + j * (dot + gap);
                const out = base + sign * (dot / 2 + 4);
                if (isVertical) { tile.x = along; tile.y = out; }
                else { tile.x = out; tile.y = along; }
            }
        };

        const drawShape = (tile: PIXI.Graphics) => {
            if (style === 'bars') {
                const h = 7;
                // Pasek jest cienki wzdłuż osi grawitacji, gruby w poprzek toru.
                if (isVertical) tile.rect(-inner / 2, -h / 2, inner, h).fill(0xffffff);
                else tile.rect(-h / 2, -inner / 2, h, inner).fill(0xffffff);
            } else {
                const gap = 3;
                const dot = Math.min((inner - (n - 1) * gap) / n, inner * 0.5);
                tile.rect(-dot / 2, -dot / 2, dot, dot).fill(0xffffff);
            }
        };

        // Przebudowa puli tylko przy zmianie stylu/liczby/kierunku.
        const signature = `${style}|${n}|${lanes}|${dir}`;
        if (this.previewBuiltFor !== signature) {
            this.previewContainer.removeChildren();
            this.previewTiles = [];
            this.previewRestX = []; this.previewRestY = [];
            this.previewCurColor = []; this.previewPrevId = []; this.previewSlide = [];
            for (let L = 0; L < lanes; L++) {
                for (let j = 0; j < n; j++) {
                    const tile = new PIXI.Graphics();
                    drawShape(tile);
                    place(tile, L, j);
                    this.previewContainer.addChild(tile);
                    const slot = L * n + j;
                    this.previewTiles[slot] = tile;
                    this.previewRestX[slot] = tile.x;   // pozycja spoczynkowa (animujemy offset względem niej)
                    this.previewRestY[slot] = tile.y;
                    this.previewPrevId[slot] = -999;    // wymusza „snap" przy pierwszym pojawieniu
                    this.previewCurColor[slot] = 0xffffff;
                    this.previewSlide[slot] = 0;
                }
            }
            this.previewBuiltFor = signature;
        }

        for (let L = 0; L < lanes; L++) {
            const preview = this.board.getColumnPreview(L, n);
            for (let j = 0; j < n; j++) {
                const slot = L * n + j;
                const tile = this.previewTiles[slot];
                const id = preview[j];
                const def = id !== undefined ? BlockRegistry.getById(id) : undefined;

                if (!def) { tile.visible = false; this.previewPrevId[slot] = -999; continue; }
                tile.visible = true;

                if (this.previewPrevId[slot] !== id) {
                    const firstAppear = this.previewPrevId[slot] === -999;
                    this.previewPrevId[slot] = id;
                    if (firstAppear) {
                        this.previewCurColor[slot] = def.color; // bez animacji przy pierwszym pojawieniu
                    } else {
                        this.previewSlide[slot] = 1; // kolejny blok „dojechał" — wsuń od wlotu i przemorfuj
                    }
                }

                // Morfowanie koloru (płynne przejście zamiast natychmiastowej podmiany).
                this.previewCurColor[slot] = lerpColor(this.previewCurColor[slot], def.color, morph);
                // Zanik wsunięcia.
                this.previewSlide[slot] = Math.max(0, this.previewSlide[slot] - slideDecay);

                // Offset „od wlotu" (na zewnątrz planszy) malejący do 0.
                const off = sign * SLIDE_PX * this.previewSlide[slot];
                tile.x = this.previewRestX[slot] + (isVertical ? 0 : off);
                tile.y = this.previewRestY[slot] + (isVertical ? off : 0);
                tile.tint = this.previewCurColor[slot];
                // Świeży slot startuje bledszy i „nabiera" wyrazistości; dalsze i tak bledsze.
                tile.alpha = (0.9 - j * 0.2) * (1 - 0.5 * this.previewSlide[slot]);
            }
        }
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

            // Void = dziura: brak bloku i brak kafla tła (kształt planszy).
            const slot = this.slotGraphics[i];
            if (slot) slot.visible = cell.typeId !== VOID;

            if (cell.typeId < 0) { // puste (-1) lub void (-2)
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
                sprite.updateVisuals(cell.typeId, cell.hp, cell.maxHp, cell.countdown);
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
            sprite.updateVisuals(cell.typeId, cell.hp, cell.maxHp, cell.countdown);
        }
        this.blocksContainer.sortableChildren = true;
    }
    
    // Metoda pomocnicza dla inputu - zwraca kontener interaktywny (tło)
    public getInputContainer(): PIXI.Container {
        return this.bgContainer;
    }
}

/** Płynna interpolacja koloru 0xRRGGBB (kanałowo). t=0→a, t=1→b. */
function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}