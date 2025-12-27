import * as PIXI from 'pixi.js';
import { Button } from '../ui/Button'; 
import { AppConfig, type GravityDir, CurrentTheme } from '../Config';
import { type Scene } from '../SceneManager';
import { LEVELS, type LevelConfig } from '../LevelDef';
import { Resources } from '../core/ResourceManager'; // NOWOŚĆ: Import
import { BlockRegistry } from '../BlockDef'; // Żeby pobrać nazwy/ikony klocków

export class MenuScene extends PIXI.Container implements Scene {
    private mainContainer: PIXI.Container;
    private optionsContainer: PIXI.Container;
    private levelSelectContainer: PIXI.Container;
    
    // NOWOŚĆ: Kontener na inwentarz
    private resourcesText: PIXI.Text;

    private btnOptLimit: Button;
    private btnOptVal: Button;
    private btnOptColors: Button;
    private btnOptGravity: Button;
    private btnOptSeed: Button;

    private startGameCallback: (level: LevelConfig) => void;

    constructor(startGameCallback: (level: LevelConfig) => void) {
        super();
        this.startGameCallback = startGameCallback;

        this.mainContainer = new PIXI.Container();
        this.optionsContainer = new PIXI.Container();
        this.levelSelectContainer = new PIXI.Container();

        this.optionsContainer.visible = false;
        this.levelSelectContainer.visible = false;

        this.addChild(this.mainContainer);
        this.addChild(this.optionsContainer);
        this.addChild(this.levelSelectContainer);

        // Tekst zasobów w prawym górnym rogu
        this.resourcesText = new PIXI.Text({
            text: '',
            style: { fontFamily: 'Arial', fontSize: 14, fill: 0xFFD700, align: 'right' }
        });
        this.resourcesText.anchor.set(1, 0);
        this.addChild(this.resourcesText);

        this.buildMainMenu();
        this.buildOptionsMenu();
        this.buildLevelSelect();
    }

    // --- NOWOŚĆ: Metoda odświeżająca wyświetlanie zasobów ---
    private refreshResourcesUI() {
        const allRes = Resources.getAll();
        let text = "INVENTORY:\n";
        
        // Sortujemy, żeby kolejność była stała
        const ids = Object.keys(allRes).map(Number).sort((a,b) => a - b);
        
        let hasAny = false;
        ids.forEach(id => {
            const amount = allRes[id];
            if (amount > 0) {
                const def = BlockRegistry.getById(id);
                // Wyświetlamy symbol (np. $) lub nazwę
                const name = def ? (def.symbol || def.name) : `Block ${id}`;
                text += `${name}: ${amount}\n`;
                hasAny = true;
            }
        });

        if (!hasAny) text += "(Empty)";
        
        this.resourcesText.text = text;
    }

    private buildMainMenu() {
        const title = new PIXI.Text({
            text: 'MATCH-3 ENGINE',
            style: { fontFamily: 'Arial', fontSize: 40, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'center' }
        });
        title.anchor.set(0.5);
        title.y = 100;
        this.mainContainer.addChild(title);

        const btnPlay = new Button("PLAY", 200, 60, 0x00AA00, () => {
            this.mainContainer.visible = false;
            this.levelSelectContainer.visible = true;
        });
        btnPlay.y = 200;
        this.mainContainer.addChild(btnPlay);

        const btnVs = new Button("VS BOT", 200, 60, 0xAA0000, () => {
            AppConfig.gameMode = 'VS_AI';
            this.startGameCallback(LEVELS[0]);
        });
        btnVs.y = 280;
        this.mainContainer.addChild(btnVs);

        const btnOpt = new Button("OPTIONS", 200, 60, 0x0000AA, () => {
            this.mainContainer.visible = false;
            this.optionsContainer.visible = true;
            this.refreshOptions();
        });
        btnOpt.y = 360;
        this.mainContainer.addChild(btnOpt);
        
        // Debug przycisk do resetu save'a (opcjonalny)
        const btnResetSave = new Button("RESET SAVE", 150, 40, 0x333333, () => {
            Resources.clearSave();
            this.refreshResourcesUI();
        });
        btnResetSave.y = 450;
        this.mainContainer.addChild(btnResetSave);
    }

    private buildLevelSelect() {
        const title = new PIXI.Text({ text: 'SELECT LEVEL', style: { fill: CurrentTheme.textMain, fontSize: 32 } });
        title.anchor.set(0.5);
        title.y = 50;
        this.levelSelectContainer.addChild(title);

        let y = 120;
        
        LEVELS.forEach((level, index) => {
            const btn = new Button(level.name, 300, 50, 0x444444, () => {
                AppConfig.gameMode = 'SOLO';
                this.startGameCallback(level);
            });
            btn.y = y;
            y += 70;
            this.levelSelectContainer.addChild(btn);
        });

        const btnBack = new Button("BACK", 100, 50, 0x555555, () => {
            this.levelSelectContainer.visible = false;
            this.mainContainer.visible = true;
        });
        btnBack.y = y + 30;
        this.levelSelectContainer.addChild(btnBack);
    }

    private buildOptionsMenu() {
        const title = new PIXI.Text({ text: 'OPTIONS', style: { fill: CurrentTheme.textMain, fontSize: 32 } });
        title.anchor.set(0.5);
        title.y = 50;
        this.optionsContainer.addChild(title);

        let y = 120;
        const addBtn = (btn: Button) => {
            btn.y = y;
            y += 70;
            this.optionsContainer.addChild(btn);
        };

        this.btnOptLimit = new Button("", 300, 50, 0x444444, () => {
            if (AppConfig.limitMode === 'NONE') AppConfig.limitMode = 'MOVES';
            else if (AppConfig.limitMode === 'MOVES') AppConfig.limitMode = 'TIME';
            else AppConfig.limitMode = 'NONE';
            this.refreshOptions();
        });
        addBtn(this.btnOptLimit);

        this.btnOptVal = new Button("", 300, 50, 0x444444, () => {
            if (AppConfig.limitValue === 20) AppConfig.limitValue = 40;
            else if (AppConfig.limitValue === 40) AppConfig.limitValue = 60;
            else AppConfig.limitValue = 20;
            this.refreshOptions();
        });
        addBtn(this.btnOptVal);

        this.btnOptColors = new Button("", 300, 50, 0x444444, () => {
            AppConfig.blockTypes++;
            if (AppConfig.blockTypes > 7) AppConfig.blockTypes = 4;
            this.refreshOptions();
        });
        addBtn(this.btnOptColors);

        this.btnOptGravity = new Button("", 300, 50, 0x444444, () => {
            const dirs: GravityDir[] = ['DOWN', 'UP', 'LEFT', 'RIGHT'];
            const idx = dirs.indexOf(AppConfig.gravityDir);
            AppConfig.gravityDir = dirs[(idx + 1) % dirs.length];
            this.refreshOptions();
        });
        addBtn(this.btnOptGravity);

        this.btnOptSeed = new Button("", 300, 50, 0x444444, () => {
            AppConfig.seed = Math.floor(Math.random() * 100000);
            this.refreshOptions();
        });
        addBtn(this.btnOptSeed);

        const btnBack = new Button("BACK", 100, 50, 0x555555, () => {
            this.optionsContainer.visible = false;
            this.mainContainer.visible = true;
        });
        btnBack.y = y + 30; // Na dole
        this.optionsContainer.addChild(btnBack);
    }

    private refreshOptions() {
        this.btnOptLimit.setText(`LIMIT: ${AppConfig.limitMode}`);
        this.btnOptVal.setText(`VALUE: ${AppConfig.limitValue}`);
        this.btnOptColors.setText(`COLORS: ${AppConfig.blockTypes}`);
        this.btnOptGravity.setText(`GRAVITY: ${AppConfig.gravityDir}`);
        this.btnOptSeed.setText(`SEED: ${AppConfig.seed}`);
    }

    public update(delta: number) {}

    public resize(width: number, height: number) {
        this.x = width / 2;
        this.y = 0; 
        // Pozycjonowanie licznika zasobów w prawym górnym rogu ekranu
        // Ponieważ MenuScene jest wycentrowane (x = width/2), musimy przesunąć tekst w prawo o width/2
        this.resourcesText.x = (width / 2) - 10; 
        this.resourcesText.y = 10;
    }
    
    public onShow() {
        this.mainContainer.visible = true;
        this.optionsContainer.visible = false;
        this.levelSelectContainer.visible = false;
        
        // Zawsze odświeżamy zasoby przy wejściu do menu
        this.refreshResourcesUI();
    }
}