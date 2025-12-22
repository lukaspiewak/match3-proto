import * as PIXI from 'pixi.js';

export class Button extends PIXI.Container {
    private bg: PIXI.Graphics;
    private label: PIXI.Text;
    private onClick: () => void;

    constructor(text: string, width: number, height: number, color: number, onClick: () => void) {
        super();
        this.onClick = onClick;

        this.bg = new PIXI.Graphics();
        this.bg.rect(-width / 2, -height / 2, width, height);
        this.bg.fill(color);
        this.bg.stroke({ width: 4, color: 0xFFFFFF });
        this.addChild(this.bg);

        this.label = new PIXI.Text({
            text: text,
            style: { fontFamily: 'Arial', fontSize: 20, fill: 0xFFFFFF, fontWeight: 'bold', align: 'center' }
        });
        this.label.anchor.set(0.5);
        this.addChild(this.label);

        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerdown', () => this.bg.alpha = 0.7);
        this.on('pointerup', () => {
            this.bg.alpha = 1.0;
            this.onClick();
        });
        this.on('pointerupoutside', () => this.bg.alpha = 1.0);
    }

    public setText(text: string) {
        this.label.text = text;
    }
}