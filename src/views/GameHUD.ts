import * as PIXI from 'pixi.js';
import { ScoreUI } from '../ScoreUI';
import { Button } from '../ui/Button';
import { CurrentTheme, AppConfig } from '../Config';
import { BlockRegistry } from '../BlockDef';
import { Resources } from '../core/ResourceManager';
import { Buildings } from '../core/BuildingManager';
import { type LevelGoal } from '../LevelDef';

export interface BarMetric {
    percent: number;
    color: number;
}

// NOWOŚĆ: Klasa do wyświetlania pojedynczego celu
class GoalItem extends PIXI.Container {
    private label: PIXI.Text;
    private icon: PIXI.Container;
    private checkmark: PIXI.Text;

    constructor(goal: LevelGoal) {
        super();

        // 1. Tło
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, 100, 30);
        bg.fill({ color: 0x000000, alpha: 0.3 });
        bg.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.2 });
        this.addChild(bg);
        this['bg'] = bg; // ref for resize

        // 2. Ikona
        this.icon = new PIXI.Container();
        this.icon.x = 20; this.icon.y = 15;
        this.addChild(this.icon);

        if (goal.type === 'COLLECT' && goal.targetId !== undefined) {
            const def = BlockRegistry.getById(goal.targetId);
            if (def && PIXI.Assets.cache.has(def.assetAlias)) {
                const s = new PIXI.Sprite(PIXI.Assets.get(def.assetAlias));
                s.anchor.set(0.5);
                const max = Math.max(s.width, s.height);
                s.scale.set(20 / max);
                s.tint = def.color;
                this.icon.addChild(s);
            } else {
                 const t = new PIXI.Text({ text: def ? def.symbol : '?', style: { fontSize: 14, fill: 0xFFFFFF } });
                 t.anchor.set(0.5);
                 this.icon.addChild(t);
            }
        } else {
             // Score Goal
             const t = new PIXI.Text({ text: '★', style: { fontSize: 14, fill: 0xFFD700 } });
             t.anchor.set(0.5);
             this.icon.addChild(t);
        }

        // 3. Tekst Postępu
        this.label = new PIXI.Text({
            text: `0 / ${goal.amount}`,
            style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xFFFFFF }
        });
        this.label.anchor.set(1, 0.5);
        this.addChild(this.label);
        
        // 4. Checkmark (ukryty na start)
        this.checkmark = new PIXI.Text({
            text: '✔',
            style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: 0x00FF00, stroke: { color: 0x000000, width: 2 } }
        });
        this.checkmark.anchor.set(0.5);
        this.checkmark.visible = false;
        this.addChild(this.checkmark);
    }

    public updateProgress(current: number, target: number) {
        this.label.text = `${current} / ${target}`;
        
        if (current >= target) {
            this.label.style.fill = 0x00FF00;
            this.checkmark.visible = true;
            this.checkmark.x = this.label.x + 15; // Obok licznika
            this.checkmark.y = 15;
        } else {
            this.label.style.fill = 0xFFFFFF;
            this.checkmark.visible = false;
        }
    }

    public setSize(width: number) {
        (this['bg'] as PIXI.Graphics).clear().rect(0, 0, width, 30).fill({ color: 0x000000, alpha: 0.3 }).stroke({ width: 1, color: 0xFFFFFF, alpha: 0.2 });
        this.label.x = width - 10;
        this.label.y = 15;
    }
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
    
    // NOWOŚĆ: Kontener celów
    public goalsContainer: PIXI.Container;
    private goalItems: GoalItem[] = [];

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

        // 3. Goals Container (dodawany do panelRight w resize)
        this.goalsContainer = new PIXI.Container();
        // Nie dodajemy do this od razu, bo będzie dzieckiem panelRight

        // 4. Przycisk wyjścia (domyślny)
        this.updateExitButton("⏏️", this.exitCallback);
    }

    public init(activeBlockIds: number[]) {
        if (this.scoreUI) {
            this.panelLeft.removeChild(this.scoreUI.container);
            this.scoreUI.container.destroy();
        }
        if (this.botScoreUI) {
            this.panelRight.removeChild(this.botScoreUI.container);
            this.botScoreUI.container.destroy();
        }

        this.scoreUI = new ScoreUI(activeBlockIds);
        this.panelLeft.addChild(this.scoreUI.container);

        this.botScoreUI = new ScoreUI(activeBlockIds);
        this.botScoreUI.container.visible = (AppConfig.gameMode === 'VS_AI');
        this.panelRight.addChild(this.botScoreUI.container);
    }
    
    // NOWOŚĆ: Inicjalizacja celów
    public setupGoals(goals: LevelGoal[]) {
        this.goalItems.forEach(item => item.destroy());
        this.goalItems = [];
        this.goalsContainer.removeChildren();

        // Jeśli są cele, dodaj nagłówek
        if (goals.length > 0) {
            const title = new PIXI.Text({
                text: "OBJECTIVES",
                style: { fontFamily: 'Arial', fontSize: 12, fill: 0xAAAAAA, fontWeight: 'bold' }
            });
            title.x = 5;
            this.goalsContainer.addChild(title);
        }

        let y = 20;
        goals.forEach(goal => {
            const item = new GoalItem(goal);
            item.y = y;
            this.goalsContainer.addChild(item);
            this.goalItems.push(item);
            y += 35; // Wysokość itemu + odstęp
        });
        
        // Dodajemy kontener do prawego panelu
        this.panelRight.addChild(this.goalsContainer);
    }

    // NOWOŚĆ: Aktualizacja postępu
    public updateGoalProgress(index: number, current: number, target: number) {
        if (this.goalItems[index]) {
            this.goalItems[index].updateProgress(current, target);
        }
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
        this.primaryBarFill.clear();
        this.secondaryBarFill.clear();
        this.primaryBarBg.clear();
        this.secondaryBarBg.clear();

        if (metrics.length > 0) {
            this.primaryBarBg.visible = true;
            this.primaryBarBg.rect(0, 0, width, 6);
            this.primaryBarBg.fill({ color: 0x000000, alpha: 0.5 });

            this.primaryBarFill.rect(0, 0, width * metrics[0].percent, 6);
            this.primaryBarFill.fill(metrics[0].color);
        } else {
            this.primaryBarBg.visible = false;
        }

        if (metrics.length > 1) {
            this.secondaryBarBg.visible = true;
            this.secondaryBarBg.rect(0, 6, width, 6); 
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
        let reservedPanelHeight = 0; 
        if (isPortrait) {
            reservedPanelHeight = Math.max(120, height * 0.20); 
        }

        const boardY = isPortrait ? HEADER_HEIGHT + reservedPanelHeight + PANEL_GAP : HEADER_HEIGHT;
        const boardHeight = height - boardY - BOTTOM_PADDING;
        this.safeBoardArea = { y: boardY, height: boardHeight };

        if (this.exitBtn) {
            this.exitBtn.x = width - 40; 
            this.exitBtn.y = 35;
        }

        if (isPortrait) {
            const panelY = HEADER_HEIGHT;
            const panelH = reservedPanelHeight;
            const panelW = (width - 20) / 2; 

            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear(); 

            if (this.scoreUI) {
                this.scoreUI.layout(panelW);
                this.scoreUI.container.y = 10;
            }

            this.panelRight.x = 10 + panelW + 0;
            this.panelRight.y = panelY;
            this.panelRightBg.clear();

            if (this.botScoreUI) {
                this.botScoreUI.layout(panelW);
                this.botScoreUI.container.y = 10;
            }
            
            // Layout dla Celów
            if (this.goalsContainer.visible) {
                 this.goalsContainer.y = 10;
                 // Aktualizacja szerokości itemów
                 this.goalItems.forEach(item => item.setSize(panelW - 10));
            }

        } else {
            const panelY = HEADER_HEIGHT;
            const boardWidth = width * 0.5; 
            const sideWidth = (width - boardWidth) / 2;
            
            this.panelLeft.x = 10;
            this.panelLeft.y = panelY;
            this.panelLeftBg.clear();
            
            if (this.scoreUI) {
                this.scoreUI.layout(sideWidth - 20); 
                this.scoreUI.container.y = 20;
            }

            this.panelRight.x = width - sideWidth + 10; 
            this.panelRight.y = panelY;
            this.panelRightBg.clear();

            if (this.botScoreUI) {
                this.botScoreUI.layout(sideWidth - 20);
                this.botScoreUI.container.y = 20;
            }
            
            // Layout dla Celów
            if (this.goalsContainer.visible) {
                 this.goalsContainer.y = 20;
                 this.goalItems.forEach(item => item.setSize(sideWidth - 20));
            }
        }
    }
}