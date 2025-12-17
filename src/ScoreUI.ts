import * as PIXI from 'pixi.js';
import { TILE_SIZE } from './Config';

export class ScoreUI {
    private container: PIXI.Container;
    private bars: PIXI.Graphics[] = [];
    private values: number[] = [0, 0, 0, 0, 0];
    
    // Konfiguracja
    private maxScore: number = 100;
    private barWidth: number = 40;
    private barHeight: number = 100;
    private spacing: number = 20;

    constructor(app: PIXI.Application, colors: number[], yPosition: number) {
        this.container = new PIXI.Container();
        this.container.x = 20; // Margines taki sam jak planszy
        this.container.y = yPosition;
        app.stage.addChild(this.container);

        // Tworzymy 5 pasków
        colors.forEach((color, index) => {
            const barContainer = new PIXI.Container();
            barContainer.x = index * (this.barWidth + this.spacing);
            this.container.addChild(barContainer);

            // 1. Tło (Ciemny pasek)
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, this.barWidth, this.barHeight);
            bg.fill({ color: 0x000000, alpha: 0.5 });
            bg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.2 });
            barContainer.addChild(bg);

            // 2. Wypełnienie (Kolorowy pasek)
            const fill = new PIXI.Graphics();
            fill.rect(0, 0, this.barWidth, this.barHeight);
            fill.fill(color);
            
            // WAŻNE: Ustawiamy pivot na dole, żeby pasek rósł "do góry"
            fill.pivot.y = this.barHeight;
            fill.y = this.barHeight;
            fill.scale.y = 0; // Startujemy od zera
            
            barContainer.addChild(fill);
            this.bars.push(fill);

            // 3. Etykieta (Opcjonalnie: licznik tekstowy)
            // Można dodać później używając PIXI.Text
        });
    }

    public addScore(colorId: number) {
        if (this.values[colorId] < this.maxScore) {
            this.values[colorId]++;
            
            // Animacja wzrostu paska
            // Obliczamy procent (0.0 - 1.0)
            const targetScale = this.values[colorId] / this.maxScore;
            
            // Ustawiamy nową skalę
            this.bars[colorId].scale.y = targetScale;
        }
    }
}