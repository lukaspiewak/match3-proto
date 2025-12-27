import * as PIXI from 'pixi.js';
import { BlockRegistry } from './BlockDef';

// Klasa pomocnicza: Pojedynczy slot surowca
class ResourceSlot extends PIXI.Container {
    private bg: PIXI.Graphics;
    private progressBar: PIXI.Graphics;
    private flash: PIXI.Graphics;
    
    private iconSprite: PIXI.Sprite | PIXI.Text;
    private label: PIXI.Text;
    
    private lastAmount: number = -1;
    
    // Przechowujemy bazową skalę, żeby zawsze do niej wracać
    private baseIconScale: number = 1.0;

    private currentWidth = 100;
    private readonly HEIGHT = 28;

    constructor(public blockId: number, color: number, iconAlias: string, symbol: string) {
        super();
        
        // 1. Tło
        this.bg = new PIXI.Graphics();
        this.addChild(this.bg);

        // 2. Pasek
        this.progressBar = new PIXI.Graphics();
        this.addChild(this.progressBar);

        // 3. Flash
        this.flash = new PIXI.Graphics();
        this.flash.blendMode = 'add';
        this.flash.alpha = 0;
        this.addChild(this.flash);

        // 4. Ikona
        if (PIXI.Assets.cache.has(iconAlias)) {
            const tex = PIXI.Assets.get(iconAlias);
            this.iconSprite = new PIXI.Sprite(tex);
            (this.iconSprite as PIXI.Sprite).anchor.set(0.5);
            
            // Obliczamy i zapamiętujemy bazową skalę
            this.baseIconScale = 18 / Math.max(tex.width, tex.height);
            
            this.iconSprite.scale.set(this.baseIconScale);
            (this.iconSprite as PIXI.Sprite).tint = 0xFFFFFF;
        } else {
            this.iconSprite = new PIXI.Text({ text: symbol, style: { fontSize: 14, fill: 0xFFFFFF } });
            (this.iconSprite as PIXI.Text).anchor.set(0.5);
            // Dla tekstu skala bazowa to zazwyczaj 1
            this.baseIconScale = 1.0; 
        }
        this.addChild(this.iconSprite);

        // 5. Licznik
        this.label = new PIXI.Text({
            text: '0',
            style: { 
                fontFamily: 'Arial', 
                fontSize: 12, 
                fontWeight: 'bold', 
                fill: 0xFFFFFF, 
                stroke: { color: 0x000000, width: 2 } 
            }
        });
        this.label.anchor.set(1, 0.5);
        this.addChild(this.label);

        this.redraw(this.currentWidth, 0, color);
    }

    public updateValue(amount: number) {
        if (this.lastAmount !== -1 && amount > this.lastAmount) {
            this.triggerFlash();
        }
        this.lastAmount = amount;

        this.label.text = amount.toString();
        
        if (amount <= 0) this.label.style.fill = 0xAAAAAA;
        else this.label.style.fill = 0xFFFFFF;
    }

    public updateProgress(ratio: number, color: number) {
        this.redraw(this.currentWidth, ratio, color);
    }

    public triggerFlash() {
        this.flash.alpha = 0.8;
        
        // ZMIANA: Ustawiamy skalę na sztywno (Base * 1.3), zamiast mnożyć Current * 1.2
        if (this.iconSprite instanceof PIXI.Sprite) {
            this.iconSprite.scale.set(this.baseIconScale * 1.3);
        }
    }

    public update(delta: number) {
        if (this.flash.alpha > 0) {
            this.flash.alpha -= 0.05 * delta;
            if (this.flash.alpha < 0) this.flash.alpha = 0;
        }

        // ZMIANA: Płynny powrót do baseIconScale
        if (this.iconSprite instanceof PIXI.Sprite) {
             if (this.iconSprite.scale.x > this.baseIconScale) {
                 // Szybkość powrotu
                 const speed = 0.02 * delta; 
                 this.iconSprite.scale.x -= speed;
                 this.iconSprite.scale.y -= speed;
                 
                 // Zabezpieczenie przed "przestrzeleniem" w dół
                 if (this.iconSprite.scale.x < this.baseIconScale) {
                     this.iconSprite.scale.set(this.baseIconScale);
                 }
             }
        }
    }
    
    public setSize(width: number) {
        this.currentWidth = width;
        
        if (this.iconSprite) {
            this.iconSprite.x = 14; 
            this.iconSprite.y = this.HEIGHT / 2;
        }
        if (this.label) {
            this.label.x = width - 8; 
            this.label.y = this.HEIGHT / 2;
        }
        
        this.bg.clear();
        this.bg.rect(0, 0, width, this.HEIGHT);
        this.bg.fill({ color: 0x1A2024, alpha: 0.8 });
        this.bg.stroke({ width: 1, color: 0x000000, alpha: 0.5 });

        this.flash.clear();
        this.flash.rect(0, 0, width, this.HEIGHT);
        this.flash.fill(0xFFFFFF);
    }

    private redraw(width: number, ratio: number, color: number) {
        this.progressBar.clear();
        if (ratio > 0.02) { 
            const r = Math.max(0, Math.min(ratio, 1.0));
            this.progressBar.rect(0, 0, width * r, this.HEIGHT);
            this.progressBar.fill({ color: color, alpha: 0.6 });
        }
    }
}

export class ScoreUI {
    public container: PIXI.Container;
    private slots: Map<number, ResourceSlot> = new Map();
    private activeIds: number[] = [];

    constructor(activeBlockIds: number[]) {
        this.container = new PIXI.Container();
        this.activeIds = activeBlockIds;

        activeBlockIds.forEach((blockId) => {
            const def = BlockRegistry.getById(blockId);
            const slot = new ResourceSlot(blockId, def.color, def.assetAlias, def.symbol);
            this.container.addChild(slot);
            this.slots.set(blockId, slot);
        });
        
        this.layout(100);
    }

    public updateState(typeId: number, amount: number, ratio: number = 0) {
        const slot = this.slots.get(typeId);
        if (slot) {
            slot.updateValue(amount);
            slot.updateProgress(ratio, BlockRegistry.getById(typeId).color);
        }
    }

    public reset() {
        this.slots.forEach(s => { s.updateValue(0); s.updateProgress(0, 0); });
    }
    
    public update(delta: number) {
        this.slots.forEach(slot => slot.update(delta));
    }

    public layout(containerWidth: number) {
        const GAP = 4;
        const SLOT_H = 28;
        
        let currentY = 0;
        const innerWidth = Math.max(50, containerWidth - 10); 
        const offsetX = 5;

        this.activeIds.forEach(id => {
            const slot = this.slots.get(id);
            if (slot) {
                slot.setSize(innerWidth);
                slot.x = offsetX;
                slot.y = currentY;
                currentY += SLOT_H + GAP;
            }
        });
    }
}