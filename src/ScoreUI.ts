import * as PIXI from 'pixi.js';

export class ScoreUI {
    public container: PIXI.Container;
    
    private bars: PIXI.Graphics[] = [];
    private flashes: PIXI.Graphics[] = []; 
    private labels: PIXI.Text[] = [];      
    
    private values: number[] = [0, 0, 0, 0, 0];
    
    private maxScore: number;
    private barWidth: number = 40;
    private barHeight: number = 100;
    private spacing: number = 20;

    constructor(colors: number[], yPosition: number, maxScore: number = 100) {
        this.maxScore = maxScore;
        this.container = new PIXI.Container();
        this.container.x = 20; 
        this.container.y = yPosition;

        colors.forEach((color, index) => {
            const barContainer = new PIXI.Container();
            barContainer.x = index * (this.barWidth + this.spacing);
            this.container.addChild(barContainer);

            // 1. Tło
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, this.barWidth, this.barHeight);
            bg.fill({ color: 0x000000, alpha: 0.5 });
            bg.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.2 });
            barContainer.addChild(bg);

            // 2. Wypełnienie
            const fill = new PIXI.Graphics();
            fill.rect(0, 0, this.barWidth, this.barHeight);
            fill.fill(color);
            fill.pivot.y = this.barHeight;
            fill.y = this.barHeight;
            fill.scale.y = 0; 
            barContainer.addChild(fill);
            this.bars.push(fill);

            // 3. Efekt Flash
            const flash = new PIXI.Graphics();
            flash.rect(0, 0, this.barWidth, this.barHeight);
            flash.fill(0xFFFFFF); 
            flash.pivot.y = this.barHeight; 
            flash.y = this.barHeight;
            flash.scale.y = 0; 
            flash.alpha = 0;   
            barContainer.addChild(flash);
            this.flashes.push(flash);

            // 4. Licznik
            const label = new PIXI.Text({
                text: '0',
                style: {
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: 0xFFFFFF,
                    align: 'center'
                }
            });
            label.anchor.set(0.5, 0); 
            label.x = this.barWidth / 2;
            label.y = this.barHeight + 5; 
            barContainer.addChild(label);
            this.labels.push(label);
        });
    }

    public addScore(colorId: number) {
        if (this.values[colorId] < this.maxScore) {
            this.values[colorId]++;
            
            const targetScale = this.values[colorId] / this.maxScore;
            
            this.bars[colorId].scale.y = targetScale;
            this.labels[colorId].text = this.values[colorId].toString();

            const flash = this.flashes[colorId];
            flash.scale.y = targetScale; 
            flash.alpha = 0.8; 
        }
    }

    public update(delta: number) {
        for (const flash of this.flashes) {
            if (flash.alpha > 0) {
                flash.alpha -= 0.05 * delta;
                if (flash.alpha < 0) flash.alpha = 0;
            }
        }
    }

    public getBarPosition(colorId: number): { x: number, y: number } {
        const x = this.container.x + (colorId * (this.barWidth + this.spacing)) + (this.barWidth / 2);
        const y = this.container.y + (this.barHeight / 2);
        return { x, y };
    }

    // --- NOWA METODA: Reset i zmiana pojemności ---
    public reset(newMaxScore: number) {
        this.maxScore = newMaxScore;
        this.values = [0, 0, 0, 0, 0];
        
        // Resetujemy wizualnie wszystkie paski
        for (let i = 0; i < this.bars.length; i++) {
            this.bars[i].scale.y = 0;
            this.flashes[i].scale.y = 0;
            this.flashes[i].alpha = 0;
            this.labels[i].text = '0';
        }
    }
}