import * as PIXI from 'pixi.js';
import { type BuildingDefinition } from '../BuildingDef';
import { Buildings } from '../core/BuildingManager';
import { Resources } from '../core/ResourceManager';
import { BlockRegistry } from '../BlockDef';

export class BuildingCard extends PIXI.Container {
    private bg: PIXI.Graphics;
    private progressBarLayer: PIXI.Graphics; // Zmiana nazwy dla jasności
    private def: BuildingDefinition;
    
    // Wymiary i stałe
    private readonly WIDTH = 250; // Nieco szersza
    private readonly HEIGHT = 110;
    private readonly CORNER_RADIUS = 14;
    private readonly PADDING = 15;
    private readonly ICON_CENTER_X = 45;

    constructor(def: BuildingDefinition) {
        super();
        this.def = def;
        
        // Inicjalizacja warstw graficznych
        this.bg = new PIXI.Graphics();
        this.progressBarLayer = new PIXI.Graphics();
        
        // Dodajemy je raz, na stałe
        this.addChild(this.bg);
        this.addChild(this.progressBarLayer);
        
        this.draw();
        
        // Interakcja (kliknięcie)
        this.eventMode = 'static';
        this.cursor = 'pointer';
        
        // Efekt hover/click
        this.on('pointerover', () => this.scale.set(1.02));
        this.on('pointerout', () => this.scale.set(1.0));
        this.on('pointerdown', () => {
            console.log(`Clicked building: ${def.name}`);
            this.scale.set(0.98);
            this.alpha = 0.9;
        });
        this.on('pointerup', () => { this.scale.set(1.02); this.alpha = 1.0; });
        this.on('pointerupoutside', () => { this.scale.set(1.0); this.alpha = 1.0; });
    }

    public refresh() {
        this.draw();
    }

    private draw() {
        this.bg.clear();
        this.progressBarLayer.clear();
        // Usuwamy tylko teksty i sprite'y (dzieci powyżej indexu 1)
        while(this.children.length > 2) {
             this.removeChildAt(2);
        }

        // 1. Dane
        const level = Buildings.getLevel(this.def.id);
        const resourceId = this.def.storageResourceId;
        
        const blockDef = resourceId !== undefined ? BlockRegistry.getById(resourceId) : null;
        // Używamy koloru surowca jako bazy, ale trochę go przyciemniamy dla tła
        const baseColor = blockDef ? blockDef.color : 0x888888; 
        const themeColor = this.darkenColor(baseColor, 0.2); // Funkcja pomocnicza na dole
        const iconAlias = blockDef ? blockDef.assetAlias : null;

        // 2. Tło Karty z efektem głębi
        // Główne tło
        this.bg.roundRect(0, 0, this.WIDTH, this.HEIGHT, this.CORNER_RADIUS);
        this.bg.fill({ color: themeColor });
        // Gruba, ciemna obwódka
        this.bg.stroke({ width: 3, color: 0x222222, alpha: 0.8 });

        // 3. Tło pod ikonę (ciemne koło)
        this.bg.circle(this.ICON_CENTER_X, this.HEIGHT / 2, 30);
        this.bg.fill({ color: 0x000000, alpha: 0.3 });
        this.bg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.4 });

        // 4. Ikona
        if (iconAlias && PIXI.Assets.cache.has(iconAlias)) {
            const tex = PIXI.Assets.get(iconAlias);
            const sprite = new PIXI.Sprite(tex);
            sprite.anchor.set(0.5);
            sprite.x = this.ICON_CENTER_X;
            sprite.y = this.HEIGHT / 2;
            
            // Skalowanie ikony, żeby pasowała do koła
            const maxDimension = Math.max(tex.width, tex.height);
            const scale = 40 / maxDimension;
            sprite.scale.set(scale); 
            
            sprite.tint = 0xFFFFFF; // Biała ikona
            this.addChild(sprite);
        }

        // 5. Teksty
        const textStartX = 90;
        const titleStyle = { fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', fill: 0xFFFFFF, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2, dropShadowAngle: Math.PI / 4 };
        const lvlStyle = { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xFFD700 }; // Złoty kolor dla levelu

        const title = new PIXI.Text({ text: this.def.name.toUpperCase(), style: titleStyle });
        title.x = textStartX; title.y = this.PADDING;
        this.addChild(title);

        const lvlText = new PIXI.Text({ text: `LVL ${level}`, style: lvlStyle });
        lvlText.x = textStartX; lvlText.y = this.PADDING + 24;
        this.addChild(lvlText);

        // 6. Pasek Pojemności (Progress Bar)
        if (resourceId !== undefined) {
            const currentAmount = Resources.getAmount(resourceId);
            const maxCapacity = Buildings.getResourceCapacity(resourceId);
            const percent = Math.max(0, Math.min(1.0, currentAmount / maxCapacity)); // Clamp 0-1

            const barX = textStartX;
            const barY = this.HEIGHT - this.PADDING - 20;
            const barW = this.WIDTH - textStartX - this.PADDING;
            const barH = 20;
            const barRadius = barH / 2; // W pełni zaokrąglone boki

            // Tło paska (ciemne koryto)
            this.progressBarLayer.roundRect(barX, barY, barW, barH, barRadius);
            this.progressBarLayer.fill({ color: 0x000000, alpha: 0.5 });
            this.progressBarLayer.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.2 });

            // Wypełnienie paska (jaskrawe, np. złote lub jasnozielone)
            const progressColor = 0xFFD700; // Złoty
            if (percent > 0) {
                // Upewniamy się, że szerokość nie jest mniejsza niż wysokość przy małym procencie, żeby zaokrąglenie dobrze wyglądało
                const fillWidth = Math.max(barH, barW * percent);
                this.progressBarLayer.roundRect(barX, barY, fillWidth, barH, barRadius);
                this.progressBarLayer.fill({ color: progressColor });
            }
            
            // Tekst na pasku (np. 150 / 200)
            const capacityText = new PIXI.Text({ 
                text: `${currentAmount} / ${maxCapacity}`, 
                style: { fontSize: 12, fill: 0x000000, fontWeight: 'bold' }
            });
            capacityText.anchor.set(0.5);
            capacityText.x = barX + barW / 2;
            capacityText.y = barY + barH / 2;
            // Jeśli pasek jest pusty, tekst robimy biały dla kontrastu
            if (percent < 0.3) capacityText.style.fill = 0xFFFFFF;

            this.addChild(capacityText);
        }
    }

    // Helper do przyciemniania koloru (dla lepszego tła)
    private darkenColor(color: number, factor: number): number {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        const newR = Math.max(0, r * (1 - factor));
        const newG = Math.max(0, g * (1 - factor));
        const newB = Math.max(0, b * (1 - factor));
        return (newR << 16) | (newG << 8) | newB;
    }
}