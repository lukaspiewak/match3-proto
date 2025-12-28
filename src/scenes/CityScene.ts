import * as PIXI from 'pixi.js';
import { type Scene } from '../SceneManager';
import { BuildingRegistry, type BuildingDefinition } from '../BuildingDef'; // Dodano typ BuildingDefinition
import { BuildingCard } from '../ui/BuildingCard';
import { UpgradeWindow } from '../ui/UpgradeWindow'; // Import okna
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

    // Warstwa dla okienek (żeby były nad kartami)
    private modalLayer: PIXI.Container;

    constructor(backCallback: () => void) {
        super();
        this.backCallback = backCallback;
        
        // Tło
        const bg = new PIXI.Graphics();
        bg.rect(0,0, 2000, 2000); 
        bg.fill(CurrentTheme.background);
        this.addChild(bg);

        this.scrollContainer = new PIXI.Container();
        this.scrollContainer.y = 100; 
        this.addChild(this.scrollContainer);

        // Nagłówek
        this.titleText = new PIXI.Text({
            text: 'CITY VIEW',
            style: { fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: CurrentTheme.textMain }
        });
        this.titleText.anchor.set(0.5);
        this.titleText.y = 40;
        this.addChild(this.titleText);

        // Licznik Złota
        this.goldText = new PIXI.Text({
            text: 'Gold: 0',
            style: { fontFamily: 'Arial', fontSize: 20, fill: 0xFFD700 }
        });
        this.goldText.anchor.set(1, 0.5);
        this.goldText.y = 40;
        this.addChild(this.goldText);

        const btnBack = new Button("BACK", 100, 40, 0x555555, () => {
            this.backCallback();
        });
        btnBack.x = 60;
        btnBack.y = 40;
        this.addChild(btnBack);

        // Warstwa modali na wierzchu
        this.modalLayer = new PIXI.Container();
        this.addChild(this.modalLayer);

        this.buildLayout();
    }

    private buildLayout() {
        const buildings = BuildingRegistry.getAll();
        const CARD_W = 250; // Dopasowane do szerokości z BuildingCard.ts
        const CARD_H = 110;
        const GAP = 15;
        const COLUMNS = 2; 

        buildings.forEach((def, index) => {
            const card = new BuildingCard(def);
            
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            card.x = col * (CARD_W + GAP);
            card.y = row * (CARD_H + GAP);

            // Interakcja: Kliknięcie w kartę otwiera okno
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointertap', () => {
                this.openUpgradeWindow(def);
            });

            this.scrollContainer.addChild(card);
            this.cards.push(card);
        });
    }

    private openUpgradeWindow(def: BuildingDefinition) {
        // Czyścimy stare okna jeśli jakieś są
        this.modalLayer.removeChildren();

        const window = new UpgradeWindow(
            def,
            () => { // On Close
                this.modalLayer.removeChildren();
            },
            () => { // On Success
                this.refreshUI(); // Odświeżamy karty i złoto
            }
        );
        
        // Centrowanie okna (względem sceny, nie scrolla)
        window.x = this.titleText.x; // Środek ekranu w poziomie (ustawiany w resize)
        window.y = 400; // Mniej więcej środek w pionie

        this.modalLayer.addChild(window);
    }

    public onShow() {
        this.refreshUI();
    }
    
    private refreshUI() {
        this.cards.forEach(card => card.refresh());
        const gold = Resources.getAmount(3); 
        this.goldText.text = `Gold: ${gold}`;
    }

    public update(delta: number) {}

    public resize(width: number, height: number) {
        const contentWidth = this.scrollContainer.width;
        this.scrollContainer.x = (width - contentWidth) / 2;
        
        this.titleText.x = width / 2;
        this.goldText.x = width - 20;

        // Jeśli okno jest otwarte, też je centrujemy
        if (this.modalLayer.children.length > 0) {
            this.modalLayer.children[0].x = width / 2;
            this.modalLayer.children[0].y = height / 2;
        }
    }
}