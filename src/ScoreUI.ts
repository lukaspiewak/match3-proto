import * as PIXI from 'pixi.js';
import { BlockRegistry } from './BlockDef';

export class ScoreUI {
    public container: PIXI.Container;
    
    private bars: PIXI.Graphics[] = []; 
    private flashes: PIXI.Graphics[] = []; 
    private values: number[] = [];
    private maxScore: number;
    
    // --- KONFIGURACJA STYLU ---
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

        // 1. Tło całego panelu
        const totalWidth = (this.PADDING * 2) + (activeBlockIds.length * this.BAR_WIDTH) + ((activeBlockIds.length - 1) * this.SPACING);
        const totalHeight = (this.PADDING * 2) + this.ICON_SIZE + 5 + this.BAR_HEIGHT;

        const bgPanel = new PIXI.Graphics();
        bgPanel.rect(0, 0, totalWidth, totalHeight);
        bgPanel.fill({ color: this.COLOR_PANEL_BG, alpha: 0.9 });
        bgPanel.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
        this.container.addChild(bgPanel);

        // 2. Budowanie kolumn
        activeBlockIds.forEach((blockId, index) => {
            const blockDef = BlockRegistry.getById(blockId);
            
            const groupX = this.PADDING + index * (this.BAR_WIDTH + this.SPACING);
            const groupY = this.PADDING;

            // A. Ikona (Teraz używa iconColor!)
            this.createIcon(blockDef, groupX + this.BAR_WIDTH / 2, groupY + this.ICON_SIZE / 2);

            // B. Slot (Tło)
            const slotY = groupY + this.ICON_SIZE + 5; 
            const slot = new PIXI.Graphics();
            slot.rect(groupX, slotY, this.BAR_WIDTH, this.BAR_HEIGHT);
            slot.fill(this.COLOR_SLOT_BG);
            this.container.addChild(slot);

            const innerWidth = this.BAR_WIDTH - (this.BAR_INNER_PADDING * 2);
            const innerHeight = this.BAR_HEIGHT - (this.BAR_INNER_PADDING * 2);
            const contentX = groupX + this.BAR_INNER_PADDING;
            const contentY = slotY + this.BAR_HEIGHT - this.BAR_INNER_PADDING;

            // C. Wypełnienie (Kolor)
            const fill = new PIXI.Graphics();
            fill.rect(0, 0, innerWidth, innerHeight);
            fill.fill(blockDef.color); 
            fill.x = contentX;
            fill.y = contentY; 
            fill.pivot.y = innerHeight;   
            fill.scale.y = 0;                 
            this.container.addChild(fill);
            this.bars.push(fill);

            // D. Efekt Flash
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
            this.flashes.push(flash);
        });
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
            
            // ZMIANA: Barwimy ikonę również w UI
            sprite.tint = blockDef.iconColor; 
            
            this.container.addChild(sprite);
        } else {
            const label = new PIXI.Text({
                text: blockDef.symbol,
                style: {
                    fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold',
                    // ZMIANA: Kolor tekstu z definicji
                    fill: blockDef.iconColor, 
                    align: 'center'
                }
            });
            label.anchor.set(0.5); label.x = x; label.y = y;
            this.container.addChild(label);
        }
    }

    public addScore(typeId: number) {
        if (this.values[typeId] === undefined) return;

        if (this.values[typeId] < this.maxScore) {
            this.values[typeId]++;
            
            const targetScale = Math.min(this.values[typeId] / this.maxScore, 1.0);
            this.bars[typeId].scale.y = targetScale;

            const flash = this.flashes[typeId];
            flash.scale.y = targetScale;
            flash.alpha = 1.0; 
        }
    }

    public update(delta: number) {
        for (const flash of this.flashes) {
            if (flash.alpha > 0) {
                flash.alpha -= 0.05 * delta; 
                if (flash.alpha < 0) flash.alpha = 0;
            }
        }
    }

    public reset(newMaxScore: number) {
        this.maxScore = newMaxScore;
        this.values.fill(0);
        for (let i = 0; i < this.bars.length; i++) {
            this.bars[i].scale.y = 0;
            this.flashes[i].scale.y = 0;
            this.flashes[i].alpha = 0;
        }
    }
}