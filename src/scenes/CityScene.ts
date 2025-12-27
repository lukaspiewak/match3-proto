import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BuildingRegistry } from '../BuildingDef';
import { BuildingCard } from '../ui/BuildingCard';
import { Button } from '../ui/Button';
import { CurrentTheme, COLS, TILE_SIZE } from '../Config';
import { Resources } from '../core/ResourceManager';

export class CityScene extends PIXI.Container implements Scene {
    private scrollContainer: PIXI.Container;
    private titleText: PIXI.Text;
    private goldText: PIXI.Text;
    private backCallback: () => void;
    
    // Lista kart, by móc je odświeżać
    private cards: BuildingCard[] = [];

    constructor(backCallback: () => void) {
        super();
        this.backCallback = backCallback;
        
        // Tło
        const bg = new PIXI.Graphics();
        bg.rect(0,0, 2000, 2000); // Duże tło
        bg.fill(CurrentTheme.background);
        this.addChild(bg);

        this.scrollContainer = new PIXI.Container();
        this.scrollContainer.y = 100; // Pod nagłówkiem
        this.addChild(this.scrollContainer);

        // Nagłówek
        this.titleText = new PIXI.Text({
            text: 'CITY VIEW',
            style: { fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: CurrentTheme.textMain }
        });
        this.titleText.anchor.set(0.5);
        this.titleText.y = 40;
        this.addChild(this.titleText);

        // Licznik Złota (Globalny)
        this.goldText = new PIXI.Text({
            text: 'Gold: 0',
            style: { fontFamily: 'Arial', fontSize: 20, fill: 0xFFD700 }
        });
        this.goldText.anchor.set(1, 0.5);
        this.goldText.y = 40;
        this.addChild(this.goldText);

        // Przycisk powrotu
        const btnBack = new Button("BACK", 100, 40, 0x555555, () => {
            this.backCallback();
        });
        btnBack.x = 60;
        btnBack.y = 40;
        this.addChild(btnBack);

        this.buildLayout();
    }

    private buildLayout() {
        const buildings = BuildingRegistry.getAll();
        const CARD_W = 240;
        const CARD_H = 100;
        const GAP = 15;
        const COLUMNS = 2; // Dwie kolumny kart

        buildings.forEach((def, index) => {
            const card = new BuildingCard(def);
            
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            card.x = col * (CARD_W + GAP);
            card.y = row * (CARD_H + GAP);

            this.scrollContainer.addChild(card);
            this.cards.push(card);
        });
    }

    public onShow() {
        // Odświeżamy dane na kartach przy wejściu
        this.cards.forEach(card => card.refresh());
        
        // Odświeżamy złoto (zakładamy ID 3 to złoto, sprawdź BlockDef)
        const gold = Resources.getAmount(3); 
        this.goldText.text = `Gold: ${gold}`;
    }

    public update(delta: number) {}

    public resize(width: number, height: number) {
        // Centrowanie kontenera
        const contentWidth = this.scrollContainer.width;
        this.scrollContainer.x = (width - contentWidth) / 2;
        
        this.titleText.x = width / 2;
        this.goldText.x = width - 20;
    }
}