import * as PIXI from 'pixi.js';
import { ScoreUI } from '../ScoreUI';
import { Button } from '../ui/Button';
import { CurrentTheme, AppConfig } from '../Config';
import { BlockRegistry } from '../BlockDef';
import { Resources } from '../core/ResourceManager';
import { Buildings } from '../core/BuildingManager';

export interface BarMetric {
    percent: number;
    color: number;
}

export class GameHUD extends PIXI.Container {
    // --- Elementy UI ---
    private primaryBarBg: PIXI.Graphics;
    private primaryBarFill: PIXI.Graphics;
    private secondaryBarBg: PIXI.Graphics;
    private secondaryBarFill: PIXI.Graphics;
    
    private exitBtn!: Button; 
    
    // Panele
    public panelLeft: PIXI.Container;
    public panelRight: PIXI.Container;
    private panelLeftBg: PIXI.Graphics;
    private panelRightBg: PIXI.Graphics;

    // Score UIs
    public scoreUI!: ScoreUI;
    public botScoreUI!: ScoreUI;

    // Layout info (dla GameScene)
    public safeBoardArea: { y: number, height: number } = { y: 0, height: 0 };

    private exitCallback: () => void;

    constructor(exitCallback: () => void) {
        super();
        this.exitCallback = exitCallback;

        // 1. Paski
        this.primaryBarBg = new PIXI.Graphics();
        this.primaryBarFill = new PIXI.Graphics();
        this.secondaryBarBg = new PIXI.Graphics();
        this.secondaryBarFill = new PIXI.Graphics();
        
        this.addChild(this.primaryBarBg);
        this.addChild(this.primaryBarFill);
        this.addChild(this.secondaryBarBg);
        this.addChild(this.secondaryBarFill);

        // 2. Panele
        this.panelLeft = new PIXI.Container();
        this.panelRight = new PIXI.Container();
        this.panelLeftBg = new PIXI.Graphics();
        this.panelRightBg = new PIXI.Graphics();

        this.panelLeft.addChild(this.panelLeftBg);
        this.panelRight.addChild(this.panelRightBg);
        
        this.addChild(this.panelLeft);
        this.addChild(this.panelRight);

        // 3. Przycisk wyjścia (domyślny)
        this.updateExitButton("⏏️", this.exitCallback);
    }

    public init(activeBlockIds: number[]) {
        // Reset UI wyników
        if (this.scoreUI) {
            this.panelLeft.removeChild(this.scoreUI.container);
            this.scoreUI.container.destroy();
        }
        if (this.botScoreUI) {
            this.panelRight.removeChild(this.botScoreUI.container);
            this.botScoreUI.container.destroy();
        }

        // Tworzenie nowych
        this.scoreUI = new ScoreUI(activeBlockIds);
        this.panelLeft.addChild(this.scoreUI.container);

        this.botScoreUI = new ScoreUI(activeBlockIds);
        this.botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');
        this.panelRight.addChild(this.botScoreUI.container);
    }

    public updateExitButton(text: string, callback: () => void) {
        if (this.exitBtn) {
            this.removeChild(this.exitBtn);
            this.exitBtn.destroy();
        }
        this.exitBtn = new Button(text, 50, 50, 0x000000, callback, true);
        this.addChild(this.exitBtn);
    }

    public updateTimeBars(metrics: BarMetric[], width: number) {
        // Czyścimy
        this.primaryBarFill.clear();
        this.secondaryBarFill.clear();
        
        // Tła
        this.primaryBarBg.clear();
        this.secondaryBarBg.clear();

        // 1. Główny pasek
        if (metrics.length > 0) {
            this.primaryBarBg.visible = true;
            this.primaryBarBg.rect(0, 0, width, 6);
            this.primaryBarBg.fill({ color: 0x000000, alpha: 0.5 });

            this.primaryBarFill.rect(0, 0, width * metrics[0].percent, 6);
            this.primaryBarFill.fill(metrics[0].color);
        } else {
            this.primaryBarBg.visible = false;
        }

        // 2. Drugi pasek
        if (metrics.length > 1) {
            this.secondaryBarBg.visible = true;
            this.secondaryBarBg.rect(0, 6, width, 6); // Offset Y = 6
            this.secondaryBarBg.fill({ color: 0x000000, alpha: 0.3 });

            this.secondaryBarFill.rect(0, 6, width * metrics[1].percent, 6);
            this.secondaryBarFill.fill(metrics[1].color);
        } else {
            this.secondaryBarBg.visible = false;
        }
    }

    public updateScore(typeId: number, current: number, ratio: number, isBot: boolean = false) {
        const target = isBot ? this.botScoreUI : this.scoreUI;
        if (target) {
            target.updateState(typeId, current, ratio);
        }
    }

    public updateScoresForMode(mode: string, getSessionAmount: (id: number) => number, getStartAmount: (id: number) => number, activeBlockIds: number[]) {
        // Helper do masowej aktualizacji pasków gracza
        activeBlockIds.forEach(id => {
            let current = 0, max = 1;
            
            if (mode === 'GATHERING') {
                 current = Resources.getAmount(id) + getSessionAmount(id);
                 max = Buildings.getResourceCapacity(id);
            } else if (mode === 'CONSTRUCTION') {
                 current = getSessionAmount(id);
                 const start = getStartAmount(id);
                 max = start > 0 ? start : 1;
            } else {
                 current = getSessionAmount(id);
                 max = 1;
            }
            
            const ratio = mode === 'STANDARD' ? 1.0 : (max > 0 ? current / max : 0);
            this.updateScore(id, current, ratio, false);
        });
    }

    public resetScores() {
        if (this.scoreUI) this.scoreUI.reset();
        if (this.botScoreUI) this.botScoreUI.reset();
    }

    public resize(width: number, height: number) {
        const HEADER_HEIGHT = 50; 
        const PANEL_GAP = 10;
        const BOTTOM_PADDING = 20;

        const isPortrait = height > width;

        // 1. Obliczamy zarezerwowane miejsce na panele (w pionie)
        let reservedPanelHeight = 0; 
        if (isPortrait) {
            reservedPanelHeight = Math.max(120, height * 0.20); 
        }

        // Obliczamy obszar dla planszy i zapisujemy go
        // GameScene skorzysta z tego, żeby wiedzieć gdzie narysować planszę
        const boardY = isPortrait ? HEADER_HEIGHT + reservedPanelHeight + PANEL_GAP : HEADER_HEIGHT;
        const boardHeight = height - boardY - BOTTOM_PADDING;
        
        this.safeBoardArea = { y: boardY, height: boardHeight };

        // 2. Pozycjonowanie Przycisku Wyjścia
        if (this.exitBtn) {
            this.exitBtn.x = width - 40; 
            this.exitBtn.y = 35;
        }

        // 3. Pozycjonowanie Paneli L/R
        if (isPortrait) {
            // PIONOWO: Panele obok siebie nad planszą
            const panelY = HEADER_HEIGHT;
            const panelH = reservedPanelHeight;
            const panelW = (width - 20) / 2; 

            // Lewy
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear(); // Można dodać tło jeśli chcesz widzieć obszar

            if (this.scoreUI) {
                this.scoreUI.layout(panelW);
                this.scoreUI.container.y = 10;
            }

            // Prawy
            this.panelRight.x = 10 + panelW + 0;
            this.panelRight.y = panelY;
            this.panelRightBg.clear();

            if (this.botScoreUI) {
                this.botScoreUI.layout(panelW);
                this.botScoreUI.container.y = 10;
            }

        } else {
            // POZIOMO: Panele po bokach planszy
            // Musimy wiedzieć gdzie jest plansza... ale plansza pyta nas o miejsce.
            // Przyjmijmy, że plansza zajmuje np. 50% szerokości na środku.
            // Lepsze podejście: GameScene oblicza planszę, a potem my dostosowujemy panele do "dziur".
            // Ale zróbmy to prościej: panele zajmują to co zostanie po zarezerwowaniu środka.
            
            const boardWidth = width * 0.5; // Zakładamy że plansza zajmie ok połowę
            const sideWidth = (width - boardWidth) / 2;
            
            const panelY = HEADER_HEIGHT;
            
            // Lewy
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear();
            
            if (this.scoreUI) {
                this.scoreUI.layout(sideWidth - 20); // Marginesy
                this.scoreUI.container.y = 20;
            }

            // Prawy (na prawo od "szacowanej" planszy)
            this.panelRight.x = width - sideWidth + 10; 
            this.panelRight.y = panelY;
            this.panelRightBg.clear();

            if (this.botScoreUI) {
                this.botScoreUI.layout(sideWidth - 20);
                this.botScoreUI.container.y = 20;
            }
        }
    }
}