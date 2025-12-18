import * as PIXI from 'pixi.js';

class FloatLabel {
    text: PIXI.Text;
    life: number;
    active: boolean = false;

    constructor(container: PIXI.Container) {
        this.text = new PIXI.Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fontWeight: 'bold',
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 4 }, // Czarna obwódka dla czytelności
                dropShadow: {
                    color: 0x000000,
                    blur: 4,
                    angle: Math.PI / 6,
                    distance: 2,
                },
            }
        });
        this.text.anchor.set(0.5); // Centrowanie
        this.text.visible = false;
        container.addChild(this.text);
        this.life = 0;
    }
}

export class FloatingTextManager {
    private pool: FloatLabel[] = [];
    private container: PIXI.Container;

    constructor(app: PIXI.Application) {
        this.container = new PIXI.Container();
        // Ważne: Teksty muszą być na samej górze, nad UI i planszą
        // Możemy to dodać później w main.ts do odpowiedniej warstwy, 
        // ale tutaj przypiszemy to tymczasowo
        this.container.zIndex = 100; 
    }

    // Tę metodę wywołamy w main.ts, żeby podpiąć kontener tekstów do gry
    public getContainer(): PIXI.Container {
        return this.container;
    }

    public spawn(x: number, y: number, value: number, color: number) {
        let label = this.pool.find(l => !l.active);
        
        if (!label) {
            label = new FloatLabel(this.container);
            this.pool.push(label);
        }

        label.active = true;
        label.life = 1.0;
        label.text.text = `+${value}`; // np. "+1"
        label.text.style.fill = color; // Kolor taki sam jak klocka!
        label.text.x = x;
        label.text.y = y;
        label.text.alpha = 1;
        label.text.scale.set(0.5); // Startujemy od małego
        label.text.visible = true;
    }

    public update(delta: number) {
        for (const label of this.pool) {
            if (!label.active) continue;

            label.life -= 0.02 * delta;

            if (label.life <= 0) {
                label.active = false;
                label.text.visible = false;
            } else {
                // Animacja: Unoszenie się do góry
                label.text.y -= 2.0 * delta;
                
                // Animacja: Lekkie powiększanie na start ("Pop")
                if (label.life > 0.8) {
                    label.text.scale.set(label.text.scale.x + 0.05 * delta);
                    if (label.text.scale.x > 1.2) label.text.scale.set(1.2);
                } else {
                    // Potem znikanie
                    label.text.alpha = label.life;
                }
            }
        }
    }
}