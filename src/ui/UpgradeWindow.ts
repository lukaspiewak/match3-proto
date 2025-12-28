import * as PIXI from 'pixi.js';
import { type BuildingDefinition } from '../BuildingDef';
import { Buildings } from '../core/BuildingManager';
import { Resources } from '../core/ResourceManager';
import { BlockRegistry } from '../BlockDef';
import { Button } from './Button';

export class UpgradeWindow extends PIXI.Container {
    private bg: PIXI.Graphics;
    private contentContainer: PIXI.Container;
    private closeCallback: () => void;
    private onUpgradeSuccess: () => void;
    private def: BuildingDefinition;

    constructor(def: BuildingDefinition, onClose: () => void, onUpgrade: () => void) {
        super();
        this.def = def;
        this.closeCallback = onClose;
        this.onUpgradeSuccess = onUpgrade;

        // Blokada interakcji pod spodem (overlay)
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, 2000, 2000); // Duży obszar
        overlay.fill({ color: 0x000000, alpha: 0.7 });
        overlay.eventMode = 'static';
        overlay.on('pointerdown', (e) => e.stopPropagation());
        this.addChild(overlay);

        // Główne okno
        this.bg = new PIXI.Graphics();
        this.addChild(this.bg);

        this.contentContainer = new PIXI.Container();
        this.addChild(this.contentContainer);

        this.drawWindow();
    }

    private drawWindow() {
        const WIDTH = 360; // Nieco szersze dla wygody
        const HEIGHT = 420;
        
        // 1. Tło Okna
        this.bg.clear();
        this.bg.rect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT);
        this.bg.fill({ color: 0x2D3748 });
        this.bg.stroke({ width: 3, color: 0xFFFFFF });

        // --- NAGŁÓWEK ---
        const headerY = -HEIGHT / 2 + 50;
        
        // Ikona budynku (na podstawie surowca magazynowanego)
        if (this.def.storageResourceId !== undefined) {
            const blockDef = BlockRegistry.getById(this.def.storageResourceId);
            if (blockDef && PIXI.Assets.cache.has(blockDef.assetAlias)) {
                const icon = new PIXI.Sprite(PIXI.Assets.get(blockDef.assetAlias));
                icon.anchor.set(0.5);
                
                // Skalujemy do 48px
                const maxDim = Math.max(icon.width, icon.height);
                icon.scale.set(48 / maxDim);
                
                icon.x = -WIDTH / 2 + 60;
                icon.y = headerY;
                icon.tint = blockDef.color; // Kolor surowca
                this.contentContainer.addChild(icon);
                
                // Tło pod ikoną dla kontrastu
                const iconBg = new PIXI.Graphics();
                iconBg.circle(icon.x, icon.y, 32);
                iconBg.fill({ color: 0x000000, alpha: 0.3 });
                this.contentContainer.addChildAt(iconBg, this.contentContainer.getChildIndex(icon));
            }
        }

        // Tytuł (Nazwa Budynku)
        const title = new PIXI.Text({
            text: this.def.name.toUpperCase(),
            style: { 
                fontFamily: 'Arial', 
                fontSize: 22, 
                fontWeight: 'bold', 
                fill: 0xFFFFFF,
                dropShadow: true,
                dropShadowDistance: 2
            }
        });
        title.anchor.set(0, 0.5); // Do lewej
        title.x = -WIDTH / 2 + 110; // Obok ikony
        title.y = headerY - 10;
        this.contentContainer.addChild(title);

        // Poziomy
        const currentLevel = Buildings.getLevel(this.def.id);
        const nextLevel = currentLevel + 1;
        
        const lvlText = new PIXI.Text({
            text: `LVL ${currentLevel}  ➔  LVL ${nextLevel}`,
            style: { fontFamily: 'Arial', fontSize: 14, fill: 0xFFD700, fontWeight: 'bold' }
        });
        lvlText.anchor.set(0, 0.5);
        lvlText.x = title.x;
        lvlText.y = headerY + 15;
        this.contentContainer.addChild(lvlText);

        // Separator
        const sep = new PIXI.Graphics();
        sep.moveTo(-WIDTH/2 + 20, headerY + 40);
        sep.lineTo(WIDTH/2 - 20, headerY + 40);
        sep.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.1 });
        this.contentContainer.addChild(sep);


        // --- STATYSTYKI ---
        const capCurrent = this.def.baseCapacity + ((currentLevel - 1) * this.def.capacityPerLevel);
        const capNext = this.def.baseCapacity + ((nextLevel - 1) * this.def.capacityPerLevel);

        const statText = new PIXI.Text({
            text: `Capacity:  ${capCurrent}  ➔  ${capNext}`,
            style: { fontFamily: 'Arial', fontSize: 16, fill: 0x48BB78 }
        });
        statText.anchor.set(0.5);
        statText.y = headerY + 70;
        this.contentContainer.addChild(statText);


        // --- KOSZTY ---
        const costs = this.def.getUpgradeCost(nextLevel);
        const canAfford = Resources.hasEnough(costs);

        let costY = headerY + 120;
        const costTitle = new PIXI.Text({ text: "REQUIRED RESOURCES", style: { fontSize: 12, fill: 0xAAAAAA, fontWeight: 'bold' } });
        costTitle.anchor.set(0.5);
        costTitle.y = costY - 20;
        this.contentContainer.addChild(costTitle);

        costs.forEach(cost => {
            const blockDef = BlockRegistry.getById(cost.resourceId);
            const playerAmount = Resources.getAmount(cost.resourceId);
            const isEnough = playerAmount >= cost.amount;
            const color = isEnough ? 0xFFFFFF : 0xFF5555;

            const costRow = new PIXI.Container();
            costRow.y = costY;
            this.contentContainer.addChild(costRow);

            // Tło wiersza kosztu
            const rowBg = new PIXI.Graphics();
            rowBg.roundRect(-WIDTH/2 + 40, -15, WIDTH - 80, 30, 4);
            rowBg.fill({ color: 0x000000, alpha: 0.2 });
            costRow.addChild(rowBg);

            // Ikona kosztu
            const iconAlias = blockDef ? blockDef.assetAlias : null;
            if (iconAlias && PIXI.Assets.cache.has(iconAlias)) {
                const s = new PIXI.Sprite(PIXI.Assets.get(iconAlias));
                s.anchor.set(0.5);
                
                // POPRAWKA: Skalujemy do konkretnego rozmiaru (np. 24px)
                const maxDim = Math.max(s.width, s.height);
                s.scale.set(24 / maxDim); 
                
                s.x = -WIDTH / 2 + 70;
                s.tint = blockDef.color; // Kolorujemy na kolor surowca
                costRow.addChild(s);
            }

            // Tekst
            const amountTxt = new PIXI.Text({
                text: `${playerAmount} / ${cost.amount}`,
                style: { fontFamily: 'Arial', fontSize: 16, fill: color, fontWeight: 'bold' }
            });
            amountTxt.anchor.set(1, 0.5); // Do prawej
            amountTxt.x = WIDTH / 2 - 60;
            costRow.addChild(amountTxt);

            // Nazwa surowca (opcjonalnie)
            const nameTxt = new PIXI.Text({
                text: blockDef ? blockDef.name : 'Unknown',
                style: { fontFamily: 'Arial', fontSize: 14, fill: 0xCCCCCC }
            });
            nameTxt.anchor.set(0, 0.5);
            nameTxt.x = -WIDTH / 2 + 100;
            costRow.addChild(nameTxt);

            costY += 40;
        });


        // --- PRZYCISKI ---
        const btnY = HEIGHT / 2 - 40;

        // Anuluj
        const btnClose = new Button("CANCEL", 120, 44, 0x555555, () => {
            this.closeCallback();
        });
        btnClose.x = -75;
        btnClose.y = btnY;
        this.contentContainer.addChild(btnClose);

        // Ulepsz
        const btnUpgrade = new Button("UPGRADE", 120, 44, canAfford ? 0x00AA00 : 0x333333, () => {
            if (canAfford) {
                Resources.spend(costs);
                Buildings.upgradeBuilding(this.def.id);
                this.onUpgradeSuccess();
                this.closeCallback();
            }
        });
        if (!canAfford) btnUpgrade.alpha = 0.5;
        
        btnUpgrade.x = 75;
        btnUpgrade.y = btnY;
        this.contentContainer.addChild(btnUpgrade);
    }
}