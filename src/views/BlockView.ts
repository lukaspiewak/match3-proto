import * as PIXI from 'pixi.js';
import { TILE_SIZE, GAP } from '../Config';
import { BlockRegistry } from '../BlockDef';

export class BlockView extends PIXI.Container {
    private bg: PIXI.Graphics;
    private iconSprite: PIXI.Sprite | null = null;
    private iconText: PIXI.Text | null = null;
    
    private _typeId: number = -2; 

    constructor() {
        super();

        const size = TILE_SIZE - GAP;
        const half = size / 2;

        this.bg = new PIXI.Graphics();
        this.bg.rect(0, 0, size, size);
        this.bg.fill(0xFFFFFF); 
        
        this.bg.pivot.set(half, half);
        this.bg.x = 0; 
        this.bg.y = 0;
        
        this.addChild(this.bg);
    }

    public updateVisuals(typeId: number) {
        if (this._typeId === typeId) return;
        this._typeId = typeId;

        this.visible = (typeId !== -1);
        if (typeId === -1) return;

        const blockDef = BlockRegistry.getById(typeId);
        if (!blockDef) return;

        this.bg.tint = blockDef.color;
        this.refreshIcon(blockDef);
    }

    private refreshIcon(blockDef: any) {
        if (this.iconSprite) this.iconSprite.visible = false;
        if (this.iconText) this.iconText.visible = false;

        const alias = blockDef.assetAlias;
        const useSvg = PIXI.Assets.cache.has(alias);

        if (useSvg) {
            if (!this.iconSprite) {
                this.iconSprite = new PIXI.Sprite();
                this.iconSprite.anchor.set(0.5);
                this.iconSprite.x = 0;
                this.iconSprite.y = 0;
                this.addChild(this.iconSprite);
            }
            
            const texture = PIXI.Assets.get(alias);
            this.iconSprite.texture = texture;
            
            const scale = (TILE_SIZE - GAP) / Math.max(texture.width, texture.height);
            this.iconSprite.scale.set(scale * 0.8);
            
            // ZMIANA: Barwimy ikonę na zdefiniowany kolor akcentowy
            // (Zadziała idealnie dla białych SVG, dla czarnych nie będzie zmiany)
            this.iconSprite.tint = blockDef.iconColor; 
            
            // Opcjonalnie: lekka przezroczystość, by wtopić ikonę
            this.iconSprite.alpha = 0.8;

            this.iconSprite.visible = true;

        } else {
            if (!this.iconText) {
                this.iconText = new PIXI.Text({
                    text: '',
                    style: {
                        fontFamily: 'Arial',
                        fontSize: 32,
                        fontWeight: 'bold',
                        align: 'center'
                    }
                });
                this.iconText.anchor.set(0.5);
                this.iconText.x = 0;
                this.iconText.y = 0;
                this.addChild(this.iconText);
            }
            
            this.iconText.text = blockDef.symbol;
            // ZMIANA: Używamy dedykowanego koloru ikony zamiast czarnego
            this.iconText.style.fill = blockDef.iconColor;
            this.iconText.alpha = 0.8; // Lekka przezroczystość

            this.iconText.visible = true;
        }
    }
}