import * as PIXI from 'pixi.js';
import { Button } from '../ui/Button'; 
import { AppConfig, type GravityDir, CurrentTheme } from '../Config'; // Import motywu
import { type Scene } from '../SceneManager';

export class MenuScene extends PIXI.Container implements Scene {
    private mainContainer: PIXI.Container;
    private optionsContainer: PIXI.Container;
    
    // Referencje do przycisków opcji (żeby aktualizować tekst)
    private btnOptLimit: Button;
    private btnOptVal: Button;
    private btnOptColors: Button;
    private btnOptGravity: Button;
    private btnOptSeed: Button;

    private startGameCallback: () => void;

    constructor(startGameCallback: () => void) {
        super();
        this.startGameCallback = startGameCallback;

        this.mainContainer = new PIXI.Container();
        this.optionsContainer = new PIXI.Container();
        this.optionsContainer.visible = false;

        this.addChild(this.mainContainer);
        this.addChild(this.optionsContainer);

        this.buildMainMenu();
        this.buildOptionsMenu();
    }

    private buildMainMenu() {
        const title = new PIXI.Text({
            text: 'MATCH-3 ENGINE',
            style: { fontFamily: 'Arial', fontSize: 40, fontWeight: 'bold', fill: CurrentTheme.textMain, align: 'center' }
        });
        title.anchor.set(0.5);
        title.y = 100;
        this.mainContainer.addChild(title);

        const btnSolo = new Button("PLAY SOLO", 200, 60, 0x00AA00, () => {
            AppConfig.gameMode = 'SOLO';
            this.startGameCallback();
        });
        btnSolo.y = 200;
        this.mainContainer.addChild(btnSolo);

        const btnVs = new Button("VS BOT", 200, 60, 0xAA0000, () => {
            AppConfig.gameMode = 'VS_AI';
            this.startGameCallback();
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
        // Centrowanie całego kontenera menu
        this.x = width / 2;
        // Y można ustawić na sztywno lub też skalować
        this.y = 0; 
        
        // Opcjonalnie: Skalowanie menu jeśli ekran jest bardzo mały
        // const scale = Math.min(width / 600, 1);
        // this.scale.set(scale);
    }
    
    public onShow() {
        this.mainContainer.visible = true;
        this.optionsContainer.visible = false;
    }
}