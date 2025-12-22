import * as PIXI from 'pixi.js';

export class ScoreUI {
    public container: PIXI.Container;
    
    private bars: PIXI.Graphics[] = [];
    private flashes: PIXI.Graphics[] = []; 
    private labels: PIXI.Text[] = [];      
    
    // ZMIANA: Nie inicjalizujemy tutaj na sztywno, tylko dynamicznie w konstruktorze
    private values: number[] = [];
    private maxScore: number;
    
    // --- JESZCZE MNIEJSZE WYMIARY ---
    private barWidth: number = 12;   // Wąskie paski
    private barHeight: number = 50;  // Niskie paski
    private spacing: number = 8;     // Ciasne odstępy

    constructor(colors: number[], yPosition: number, maxScore: number = 100) {
        this.maxScore = maxScore;
        this.container = new PIXI.Container();
        this.container.y = yPosition;

        // ZMIANA: Inicjalizacja tablicy wartości zerami dla tylu kolorów, ile otrzymaliśmy
        this.values = new Array(colors.length).fill(0);

        // Tło panelu - OSTRE KRAWĘDZIE (rect)
        const totalWidth = (colors.length * this.barWidth) + ((colors.length - 1) * this.spacing);
        const paddingX = 8;
        const paddingY = 8;
        
        const bgPanel = new PIXI.Graphics();
        bgPanel.rect(-paddingX, -paddingY, totalWidth + (paddingX * 2), this.barHeight + 20);
        bgPanel.fill({ color: 0x000000, alpha: 0.6 });
        bgPanel.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.3 });
        this.container.addChild(bgPanel);

        colors.forEach((color, index) => {
            const barContainer = new PIXI.Container();
            barContainer.x = index * (this.barWidth + this.spacing);
            this.container.addChild(barContainer);

            // 1. Tło paska
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, this.barWidth, this.barHeight);
            bg.fill({ color: 0x333333, alpha: 1.0 }); 
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

            // 4. Licznik (bardzo mały)
            const label = new PIXI.Text({
                text: '0',
                style: {
                    fontFamily: 'Arial',
                    fontSize: 10, // Micro font
                    fontWeight: 'bold',
                    fill: 0xFFFFFF,
                    align: 'center'
                }
            });
            label.anchor.set(0.5, 0); 
            label.x = this.barWidth / 2;
            label.y = this.barHeight + 2; 
            barContainer.addChild(label);
            this.labels.push(label);
        });
        
        this.container.pivot.x = -paddingX;
        this.container.pivot.y = -paddingY;
    }

    public addScore(colorId: number) {
        // Zabezpieczenie na wypadek błędu indeksowania (choć po poprawce nie powinno wystąpić)
        if (this.values[colorId] === undefined) return;

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

    public reset(newMaxScore: number) {
        this.maxScore = newMaxScore;
        // ZMIANA: Resetujemy tablicę zachowując odpowiednią długość (zgodną z liczbą pasków)
        this.values = new Array(this.bars.length).fill(0);
        
        for (let i = 0; i < this.bars.length; i++) {
            this.bars[i].scale.y = 0;
            this.flashes[i].scale.y = 0;
            this.flashes[i].alpha = 0;
            this.labels[i].text = '0';
        }
    }
}