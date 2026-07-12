import * as PIXI from 'pixi.js';

export class Button extends PIXI.Container {
    private bg: PIXI.Graphics;
    private labelText: PIXI.Text;
    private onClick: () => void;

    constructor(text: string, width: number, height: number, color: number, onClick: () => void, _isIcon: boolean = false) {
        super();
        this.onClick = onClick;

        this.bg = new PIXI.Graphics();
        this.bg.rect(-width / 2, -height / 2, width, height);
        this.bg.fill(color);
        this.bg.stroke({ width: 4, color: 0xFFFFFF });
        this.addChild(this.bg);

        this.labelText = new PIXI.Text({
            text: text,
            style: { fontFamily: 'Arial', fontSize: 20, fill: 0xFFFFFF, fontWeight: 'bold', align: 'center' }
        });
        this.labelText.anchor.set(0.5);
        this.addChild(this.labelText);

        this.eventMode = 'static';
        this.cursor = 'pointer';

        // POPRAWKA: Blokowanie propagacji zdarzeń
        this.on('pointerdown', (e) => {
            e.stopPropagation();
            this.bg.alpha = 0.7;
        });

        this.on('pointerup', (e) => {
            e.stopPropagation();
            this.bg.alpha = 1.0;
            this.onClick();
        });

        this.on('pointerupoutside', () => {
            this.bg.alpha = 1.0;
        });

        // Blokujemy również zdarzenia wysokiego poziomu, żeby nie przeszły "pod spód"
        this.on('click', (e) => e.stopPropagation());
        this.on('tap', (e) => e.stopPropagation());
    }

    public setText(text: string) {
        this.labelText.text = text;
    }
}