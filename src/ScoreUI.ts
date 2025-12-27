import * as PIXI from 'pixi.js';
import { BlockRegistry } from './BlockDef';

export class ScoreUI {
    public container: PIXI.Container;
    
    // Przechowujemy referencje do pasków, by móc je aktualizować
    private bars: Map<number, PIXI.Graphics> = new Map();
    private flashes: Map<number, PIXI.Graphics> = new Map();
    private countLabels: Map<number, PIXI.Text> = new Map();

    private values: number[] = [];
    private maxScore: number;
    
    // Konfiguracja
    private readonly BAR_WIDTH = 16;
    private readonly BAR_HEIGHT = 70;
    private readonly SPACING = 8;
    private readonly ICON_SIZE = 16;
    private readonly PADDING = 7;
    private readonly BAR_INNER_PADDING = 2; 
    
    private readonly COLOR_PANEL_BG = 0x2F3539; 
    private readonly COLOR_SLOT_BG = 0x1A2024;  

    constructor(activeBlockIds: number[], yPosition: number, maxScore: number = 100) {
        this.maxScore = maxScore;
        this.container = new PIXI.Container();
        this.container.y = yPosition;

        this.values = new Array(activeBlockIds.length).fill(0);

        // 1. Tło
        const totalWidth = (this.PADDING * 2) + (activeBlockIds.length * this.BAR_WIDTH) + ((activeBlockIds.length - 1) * this.SPACING);
        const totalHeight = (this.PADDING * 2) + this.ICON_SIZE + 5 + this.BAR_HEIGHT;

        const bgPanel = new PIXI.Graphics();
        bgPanel.rect(0, 0, totalWidth, totalHeight);
        bgPanel.fill({ color: this.COLOR_PANEL_BG, alpha: 0.9 });
        bgPanel.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
        this.container.addChild(bgPanel);

        // 2. Kolumny
        activeBlockIds.forEach((blockId, index) => {
            const blockDef = BlockRegistry.getById(blockId);
            const groupX = this.PADDING + index * (this.BAR_WIDTH + this.SPACING);
            const groupY = this.PADDING;

            // A. Ikona
            this.createIcon(blockDef, groupX + this.BAR_WIDTH / 2, groupY + this.ICON_SIZE / 2);

            // B. Licznik
            const countText = new PIXI.Text({
                text: '', 
                style: {
                    fontFamily: 'Arial', fontSize: 10, fontWeight: 'bold', fill: 0xFFFFFF,
                    stroke: { color: 0x000000, width: 2 }, align: 'center'
                }
            });
            countText.anchor.set(0.5, 1);
            countText.x = groupX + this.BAR_WIDTH / 2;
            countText.y = groupY;
            this.container.addChild(countText);
            this.countLabels.set(blockId, countText);

            // C. Slot
            const slotY = groupY + this.ICON_SIZE + 5; 
            const slot = new PIXI.Graphics();
            slot.rect(groupX, slotY, this.BAR_WIDTH, this.BAR_HEIGHT);
            slot.fill(this.COLOR_SLOT_BG);
            this.container.addChild(slot);

            const innerWidth = this.BAR_WIDTH - (this.BAR_INNER_PADDING * 2);
            const innerHeight = this.BAR_HEIGHT - (this.BAR_INNER_PADDING * 2);
            const contentX = groupX + this.BAR_INNER_PADDING;
            const contentY = slotY + this.BAR_HEIGHT - this.BAR_INNER_PADDING;

            // D. Pasek (Bar)
            const fill = new PIXI.Graphics();
            fill.rect(0, 0, innerWidth, innerHeight);
            fill.fill(blockDef.color); 
            fill.x = contentX;
            fill.y = contentY; 
            fill.pivot.y = innerHeight;   
            fill.scale.y = 0;                 
            this.container.addChild(fill);
            // Zapisujemy referencję do Mapy
            this.bars.set(blockId, fill);

            // E. Flash
            const flash = new PIXI.Graphics();
            flash.rect(0, 0, innerWidth, innerHeight);
            flash.fill(0xFFFFFF); 
            flash.x = contentX;
            flash.y = contentY;
            flash.pivot.y = innerHeight;
            flash.scale.y = 0;
            flash.alpha = 0; 
            flash.blendMode = 'add'; 
            this.container.addChild(flash);
            this.flashes.set(blockId, flash);
        });
    }

    // Aktualizacja etykiety tekstowej
    public setStockLabel(typeId: number, amount: number | string) {
        const label = this.countLabels.get(typeId);
        if (label) {
            label.text = amount.toString();
            if (typeof amount === 'number' && amount < 5) label.style.fill = 0xFF5555;
            else label.style.fill = 0xFFFFFF;
        }
    }

    // --- NOWOŚĆ: Precyzyjna kontrola paska (dla trybu Construction) ---
    public updateBarValue(typeId: number, currentValue: number, maxValue: number) {
        const bar = this.bars.get(typeId);
        const flash = this.flashes.get(typeId);
        
        if (bar && maxValue > 0) {
            const ratio = Math.max(0, Math.min(currentValue / maxValue, 1.0));
            
            // Animacja zmiany (proste przypisanie dla płynności przy update)
            bar.scale.y = ratio;

            if (flash) {
                flash.scale.y = ratio;
                flash.alpha = 0.8; // Błysk przy zmianie
            }
        } else if (bar && maxValue === 0) {
            // Jeśli nie mieliśmy tego surowca na starcie (0/0) -> pusty pasek
            bar.scale.y = 0;
        }
    }

    // Stara metoda addScore (dla trybu STANDARD)
    public addScore(typeId: number) {
        if (this.values[typeId] === undefined) return;
        if (this.values[typeId] < this.maxScore) {
            this.values[typeId]++;
            this.updateBarValue(typeId, this.values[typeId], this.maxScore);
        }
    }

    public update(delta: number) {
        for (const flash of this.flashes.values()) {
            if (flash.alpha > 0) {
                flash.alpha -= 0.05 * delta; 
                if (flash.alpha < 0) flash.alpha = 0;
            }
        }
    }

    public reset(newMaxScore: number) {
        this.maxScore = newMaxScore;
        this.values.fill(0);
        for (const bar of this.bars.values()) bar.scale.y = 0;
        for (const flash of this.flashes.values()) { flash.scale.y = 0; flash.alpha = 0; }
        this.countLabels.forEach(label => label.text = "");
    }

    private createIcon(blockDef: any, x: number, y: number) {
        const alias = blockDef.assetAlias;
        if (PIXI.Assets.cache.has(alias)) {
            const texture = PIXI.Assets.get(alias);
            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.x = x;
            sprite.y = y;
            const scale = this.ICON_SIZE / Math.max(texture.width, texture.height);
            sprite.scale.set(scale); 
            sprite.tint = blockDef.iconColor; 
            this.container.addChild(sprite);
        } else {
            const label = new PIXI.Text({
                text: blockDef.symbol,
                style: {
                    fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold',
                    fill: blockDef.iconColor, align: 'center'
                }
            });
            label.anchor.set(0.5); label.x = x; label.y = y;
            this.container.addChild(label);
        }
    }
}