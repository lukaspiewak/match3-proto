import * as PIXI from 'pixi.js';

export class Button extends PIXI.Container {
    private bg: PIXI.Graphics;
    private label: PIXI.Text;
    private onClick: () => void;

    // NOWOŚĆ: Ostatni parametr isIcon
    constructor(text: string, width: number, height: number, color: number, onClick: () => void, isIcon: boolean = false) {
        super();
        this.onClick = onClick;

        this.bg = new PIXI.Graphics();
        
        if (!isIcon) {
            // Standardowy przycisk z tłem
            this.bg.rect(-width / 2, -height / 2, width, height);
            this.bg.fill(color);
            this.bg.stroke({ width: 4, color: 0xFFFFFF });
        } else {
            // Przycisk ikona (niewidzialny obszar klikania)
            this.bg.rect(-width / 2, -height / 2, width, height);
            this.bg.fill({ color: 0xFFFFFF, alpha: 0.001 }); // Prawie niewidoczne tło dla hit area
        }
        
        this.addChild(this.bg);

        this.label = new PIXI.Text({
            text: text,
            style: { 
                fontFamily: 'Arial', 
                // Jeśli to ikona (emoji), dajemy większą czcionkę
                fontSize: isIcon ? 36 : 20, 
                fill: 0xFFFFFF, 
                fontWeight: 'bold', 
                align: 'center',
                // Cień tylko dla ikony, żeby była widoczna na każdym tle
                dropShadow: isIcon,
                dropShadowColor: '#000000',
                dropShadowDistance: 2
            }
        });
        this.label.anchor.set(0.5);
        this.addChild(this.label);

        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerdown', () => this.label.alpha = 0.7);
        this.on('pointerup', () => {
            this.label.alpha = 1.0;
            this.onClick();
        });
        this.on('pointerupoutside', () => this.label.alpha = 1.0);
    }

    public setText(text: string) {
        this.label.text = text;
    }
}