import * as PIXI from 'pixi.js';
import { TILE_SIZE, GAP } from '../Config';
import { BlockRegistry } from '../BlockDef';

export class BlockView extends PIXI.Container {
    private bg: PIXI.Graphics;
    private iconSprite: PIXI.Sprite | null = null;
    private iconText: PIXI.Text | null = null;
    
    // Sprite z grafiką pęknięcia
    private damageSprite: PIXI.Sprite;
    
    private _typeId: number = -2; 
    private _lastHp: number = -1;

    constructor() {
        super();

        const size = TILE_SIZE - GAP;
        const half = size / 2;

        // Tło
        this.bg = new PIXI.Graphics();
        this.bg.rect(0, 0, size, size);
        this.bg.fill(0xFFFFFF); 
        this.bg.pivot.set(half, half);
        this.bg.x = 0; 
        this.bg.y = 0;
        this.addChild(this.bg);
        
        // Warstwa uszkodzeń (Sprite)
        this.damageSprite = new PIXI.Sprite();
        this.damageSprite.anchor.set(0.5);
        this.damageSprite.visible = false; // Domyślnie ukryte
        
        // Próbujemy przypisać teksturę od razu, jeśli jest załadowana
        if (PIXI.Assets.cache.has('crack')) {
            const tex = PIXI.Assets.get('crack');
            this.damageSprite.texture = tex;
            
            const scale = size / Math.max(tex.width, tex.height);
            this.damageSprite.scale.set(scale);
        }

        // Dodajemy na wierzch
        this.addChild(this.damageSprite);
    }

    public updateVisuals(typeId: number, hp: number = 1, maxHp: number = 1) {
        // 1. Aktualizacja typu
        if (this._typeId !== typeId) {
            this._typeId = typeId;
            this.visible = (typeId !== -1);
            
            if (typeId !== -1) {
                const blockDef = BlockRegistry.getById(typeId);
                if (blockDef) {
                    this.bg.tint = blockDef.color;
                    this.refreshIcon(blockDef);
                }
            }
            // Reset stanu HP przy zmianie typu, by wymusić odświeżenie pęknięć
            this._lastHp = -1; 
        }

        if (typeId === -1) return;

        // 2. Aktualizacja uszkodzeń
        if (this._lastHp !== hp) {
            this._lastHp = hp;
            this.updateDamageEffect(hp, maxHp);
        }
    }

    private updateDamageEffect(hp: number, maxHp: number) {
        // ZMIANA: Ukrywamy pęknięcia, jeśli blok jest zdrowy (hp >= maxHp) 
        // LUB jeśli jest zniszczony/wybucha (hp <= 0).
        if (hp >= maxHp || hp <= 0) {
            this.damageSprite.visible = false;
            return;
        }

        // Upewniamy się, że tekstura jest załadowana (zabezpieczenie)
        if (!this.damageSprite.texture || this.damageSprite.texture.label === 'EMPTY') {
             if (PIXI.Assets.cache.has('crack')) {
                const tex = PIXI.Assets.get('crack');
                this.damageSprite.texture = tex;
                const size = TILE_SIZE - GAP;
                const scale = size / Math.max(tex.width, tex.height);
                this.damageSprite.scale.set(scale);
             }
        }

        this.damageSprite.visible = true;

        // Obliczamy przezroczystość
        const healthRatio = hp / maxHp;
        const damageAlpha = 1.0 - healthRatio;
        
        this.damageSprite.alpha = Math.min(1.0, damageAlpha + 0.2); 
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
                // Ikona musi być POD pęknięciami (index 1, bo tło to 0)
                this.addChildAt(this.iconSprite, 1);
            }
            
            const texture = PIXI.Assets.get(alias);
            this.iconSprite.texture = texture;
            const scale = (TILE_SIZE - GAP) / Math.max(texture.width, texture.height);
            this.iconSprite.scale.set(scale * 0.8);
            this.iconSprite.tint = blockDef.iconColor; 
            this.iconSprite.alpha = 0.8;
            this.iconSprite.visible = true;

        } else {
            if (!this.iconText) {
                this.iconText = new PIXI.Text({
                    text: '',
                    style: {
                        fontFamily: 'Arial', fontSize: 32, fontWeight: 'bold', align: 'center'
                    }
                });
                this.iconText.anchor.set(0.5);
                this.addChildAt(this.iconText, 1);
            }
            this.iconText.text = blockDef.symbol;
            this.iconText.style.fill = blockDef.iconColor;
            this.iconText.alpha = 0.8;
            this.iconText.visible = true;
        }
    }
}