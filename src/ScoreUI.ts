import * as PIXI from 'pixi.js';
import { BlockRegistry } from './BlockDef';

// Klasa pomocnicza: Pojedynczy slot surowca
class ResourceSlot extends PIXI.Container {
    private bg: PIXI.Graphics;
    private progressBar: PIXI.Graphics;
    private iconSprite: PIXI.Sprite | PIXI.Text;
    private label: PIXI.Text;
    
    // Konfiguracja wyglądu
    private readonly WIDTH = 60;
    private readonly HEIGHT = 30; // Niskie kapsułki
    private readonly RADIUS = 15; // Pełne zaokrąglenie

    constructor(public blockId: number, color: number, iconAlias: string, symbol: string) {
        super();
        
        // 1. Tło (ciemne koryto)
        this.bg = new PIXI.Graphics();
        this.bg.roundRect(0, 0, this.WIDTH, this.HEIGHT, this.RADIUS);
        this.bg.fill({ color: 0x1A2024, alpha: 0.8 });
        this.bg.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
        this.addChild(this.bg);

        // 2. Pasek Postępu (Wypełnienie)
        this.progressBar = new PIXI.Graphics();
        // Domyślny stan: pełny lub pusty, zależnie od logiki. Rysujemy dynamicznie.
        this.addChild(this.progressBar);
        this.updateProgress(0, color); // Start od 0

        // 3. Ikona (po lewej)
        if (PIXI.Assets.cache.has(iconAlias)) {
            const tex = PIXI.Assets.get(iconAlias);
            this.iconSprite = new PIXI.Sprite(tex);
            (this.iconSprite as PIXI.Sprite).anchor.set(0.5);
            this.iconSprite.x = 18; // Pozycja ikony
            this.iconSprite.y = this.HEIGHT / 2;
            const scale = 20 / Math.max(tex.width, tex.height); // Mała ikona (20px)
            this.iconSprite.scale.set(scale);
            (this.iconSprite as PIXI.Sprite).tint = 0xFFFFFF; // Biała ikona dla kontrastu
        } else {
            this.iconSprite = new PIXI.Text({ text: symbol, style: { fontSize: 14, fill: 0xFFFFFF } });
            (this.iconSprite as PIXI.Text).anchor.set(0.5);
            this.iconSprite.x = 18;
            this.iconSprite.y = this.HEIGHT / 2;
        }
        this.addChild(this.iconSprite);

        // 4. Licznik (po prawej)
        this.label = new PIXI.Text({
            text: '0',
            style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xFFFFFF, stroke: { color: 0x000000, width: 2 } }
        });
        this.label.anchor.set(0.5); // Środek
        this.label.x = this.WIDTH - 18; // Po prawej
        this.label.y = this.HEIGHT / 2;
        this.addChild(this.label);
    }

    public updateValue(amount: number) {
        this.label.text = amount.toString();
        // Opcjonalnie: zmiana koloru przy małej ilości
        if (amount <= 0) this.label.style.fill = 0xAAAAAA;
        else this.label.style.fill = 0xFFFFFF;
    }

    public updateProgress(ratio: number, color: number) {
        this.progressBar.clear();
        if (ratio > 0.05) { // Rysuj tylko jeśli coś widać
            // Clamp 0-1
            const r = Math.max(0, Math.min(ratio, 1.0));
            this.progressBar.roundRect(0, 0, this.WIDTH * r, this.HEIGHT, this.RADIUS);
            this.progressBar.fill({ color: color, alpha: 0.6 }); // Półprzezroczysty pasek
        }
    }
}

export class ScoreUI {
    public container: PIXI.Container;
    
    // Mapa slotów
    private slots: Map<number, ResourceSlot> = new Map();

    constructor(activeBlockIds: number[], x: number, y: number) {
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;

        const GAP = 10;
        let currentX = 0;

        // Tworzymy poziomy pasek slotów
        activeBlockIds.forEach((blockId) => {
            const def = BlockRegistry.getById(blockId);
            const slot = new ResourceSlot(blockId, def.color, def.assetAlias, def.symbol);
            
            slot.x = currentX;
            this.container.addChild(slot);
            this.slots.set(blockId, slot);

            currentX += 60 + GAP; // Szerokość slotu + odstęp
        });
    }

    // Uniwersalna metoda aktualizacji
    public updateState(typeId: number, amount: number, ratio: number = 0) {
        const slot = this.slots.get(typeId);
        if (slot) {
            slot.updateValue(amount);
            slot.updateProgress(ratio, BlockRegistry.getById(typeId).color);
        }
    }

    // Metody kompatybilności (jeśli potrzebne)
    public reset() {
        this.slots.forEach(s => { s.updateValue(0); s.updateProgress(0, 0); });
    }
    
    public update(delta: number) {} // Brak animacji w tej wersji
}