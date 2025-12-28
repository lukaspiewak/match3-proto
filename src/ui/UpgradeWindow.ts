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
    private startConstructionCallback: (def: BuildingDefinition) => void;
    private def: BuildingDefinition;

    constructor(def: BuildingDefinition, onClose: () => void, onStart: (def: BuildingDefinition) => void) {
        super();
        this.def = def;
        this.closeCallback = onClose;
        this.startConstructionCallback = onStart;

        // Blokada interakcji pod spodem
        const overlay = new PIXI.Graphics();
        overlay.rect(0, 0, 2000, 2000); 
        overlay.fill({ color: 0x000000, alpha: 0.7 });
        overlay.eventMode = 'static';
        overlay.on('pointerdown', (e) => e.stopPropagation());
        this.addChild(overlay);

        this.bg = new PIXI.Graphics();
        this.addChild(this.bg);

        this.contentContainer = new PIXI.Container();
        this.addChild(this.contentContainer);

        this.drawWindow();
    }

    private drawWindow() {
        const WIDTH = 360; 
        const HEIGHT = 460; // Zwiększamy wysokość, żeby zmieścić info o misji
        
        this.bg.clear();
        this.bg.rect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT);
        this.bg.fill({ color: 0x2D3748 });
        this.bg.stroke({ width: 3, color: 0xFFFFFF });

        // --- NAGŁÓWEK ---
        const headerY = -HEIGHT / 2 + 50;
        
        // Ikona budynku
        if (this.def.storageResourceId !== undefined) {
            const blockDef = BlockRegistry.getById(this.def.storageResourceId);
            if (blockDef && PIXI.Assets.cache.has(blockDef.assetAlias)) {
                const icon = new PIXI.Sprite(PIXI.Assets.get(blockDef.assetAlias));
                icon.anchor.set(0.5);
                const maxDim = Math.max(icon.width, icon.height);
                icon.scale.set(48 / maxDim);
                icon.x = -WIDTH / 2 + 60;
                icon.y = headerY;
                icon.tint = blockDef.color;
                this.contentContainer.addChild(icon);
                
                const iconBg = new PIXI.Graphics();
                iconBg.circle(icon.x, icon.y, 32);
                iconBg.fill({ color: 0x000000, alpha: 0.3 });
                this.contentContainer.addChildAt(iconBg, this.contentContainer.getChildIndex(icon));
            }
        }

        const title = new PIXI.Text({
            text: this.def.name.toUpperCase(),
            style: { fontFamily: 'Arial', fontSize: 22, fontWeight: 'bold', fill: 0xFFFFFF, dropShadow: true, dropShadowDistance: 2 }
        });
        title.anchor.set(0, 0.5); 
        title.x = -WIDTH / 2 + 110; 
        title.y = headerY - 10;
        this.contentContainer.addChild(title);

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

        // --- INFO O MISJI (NOWOŚĆ) ---
        // Wyświetlamy cel misji: "Zbierz X w 30 ruchach"
        const missionBg = new PIXI.Graphics();
        missionBg.roundRect(-WIDTH/2 + 20, headerY + 95, WIDTH - 40, 40, 8);
        missionBg.fill({ color: 0x000000, alpha: 0.3 });
        missionBg.stroke({ width: 1, color: 0xFFA500, alpha: 0.5 }); // Pomarańczowa ramka sugeruje wyzwanie
        this.contentContainer.addChild(missionBg);

        const missionText = new PIXI.Text({
            text: "MISSION: CONSTRUCT", 
            style: { fontFamily: 'Arial', fontSize: 12, fill: 0xFFA500, fontWeight: 'bold' }
        });
        missionText.anchor.set(0, 0.5);
        missionText.x = -WIDTH/2 + 35;
        missionText.y = headerY + 115;
        this.contentContainer.addChild(missionText);

        const limitText = new PIXI.Text({
            text: "LIMIT: 30 MOVES", 
            style: { fontFamily: 'Arial', fontSize: 12, fill: 0xFFFFFF, fontWeight: 'bold' }
        });
        limitText.anchor.set(1, 0.5);
        limitText.x = WIDTH/2 - 35;
        limitText.y = headerY + 115;
        this.contentContainer.addChild(limitText);


        // --- KOSZTY (Cele) ---
        const costs = this.def.getUpgradeCost(nextLevel);
        const canAfford = Resources.hasEnough(costs);

        let costY = headerY + 165;
        // Zmieniamy nagłówek na "TO COLLECT" żeby pasowało do rozgrywki
        const costTitle = new PIXI.Text({ text: "RESOURCES TO COLLECT:", style: { fontSize: 12, fill: 0xAAAAAA, fontWeight: 'bold' } });
        costTitle.anchor.set(0.5);
        costTitle.y = costY - 20;
        this.contentContainer.addChild(costTitle);

        costs.forEach(cost => {
            const blockDef = BlockRegistry.getById(cost.resourceId);
            const playerAmount = Resources.getAmount(cost.resourceId);
            // W trybie construction sprawdzamy czy mamy surowce "na start"
            const isEnough = playerAmount >= cost.amount;
            const color = isEnough ? 0xFFFFFF : 0xFF5555;

            const costRow = new PIXI.Container();
            costRow.y = costY;
            this.contentContainer.addChild(costRow);

            const rowBg = new PIXI.Graphics();
            rowBg.roundRect(-WIDTH/2 + 40, -15, WIDTH - 80, 30, 4);
            rowBg.fill({ color: 0x000000, alpha: 0.2 });
            costRow.addChild(rowBg);

            const iconAlias = blockDef ? blockDef.assetAlias : null;
            if (iconAlias && PIXI.Assets.cache.has(iconAlias)) {
                const s = new PIXI.Sprite(PIXI.Assets.get(iconAlias));
                s.anchor.set(0.5);
                const maxDim = Math.max(s.width, s.height);
                s.scale.set(24 / maxDim); 
                s.x = -WIDTH / 2 + 70;
                s.tint = blockDef.color; 
                costRow.addChild(s);
            }

            const amountTxt = new PIXI.Text({
                // Pokazujemy "X / Y", gdzie X to posiadane (które zostaną "postawione" na szali)
                text: `${cost.amount}`, 
                style: { fontFamily: 'Arial', fontSize: 18, fill: color, fontWeight: 'bold' }
            });
            amountTxt.anchor.set(1, 0.5); 
            amountTxt.x = WIDTH / 2 - 60;
            costRow.addChild(amountTxt);

            // Nazwa
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

        const btnClose = new Button("CANCEL", 120, 44, 0x555555, () => {
            this.closeCallback();
        });
        btnClose.x = -75;
        btnClose.y = btnY;
        this.contentContainer.addChild(btnClose);

        const btnStart = new Button("START", 120, 44, canAfford ? 0x00AA00 : 0x333333, () => {
            if (canAfford) {
                this.startConstructionCallback(this.def);
                this.closeCallback();
            }
        });
        if (!canAfford) btnStart.alpha = 0.5;
        
        btnStart.x = 75;
        btnStart.y = btnY;
        this.contentContainer.addChild(btnStart);
    }
}