import * as PIXI from 'pixi.js';

class FloatLabel {
    text: PIXI.Text;
    active: boolean = false;
    
    // Dane do animacji ruchu
    startX: number = 0;
    startY: number = 0;
    targetX: number = 0;
    targetY: number = 0;
    
    timer: number = 0; // Czas od spawnu (w sekundach)

    constructor(container: PIXI.Container) {
        this.text = new PIXI.Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fontWeight: 'bold',
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 4 }, 
                dropShadow: {
                    color: 0x000000,
                    blur: 4,
                    angle: Math.PI / 6,
                    distance: 2,
                },
            }
        });
        this.text.anchor.set(0.5); 
        this.text.visible = false;
        container.addChild(this.text);
    }
}

export class FloatingTextManager {
    private pool: FloatLabel[] = [];
    private container: PIXI.Container;

    constructor() {
        this.container = new PIXI.Container();
        this.container.zIndex = 100; 
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    // Zmieniony spawn: przyjmuje cel (Target)
    public spawn(startX: number, startY: number, targetX: number, targetY: number, value: number, color: number) {
        let label = this.pool.find(l => !l.active);
        
        if (!label) {
            label = new FloatLabel(this.container);
            this.pool.push(label);
        }

        label.active = true;
        label.timer = 0;

        // Zapisujemy trasę
        label.startX = startX;
        label.startY = startY;
        label.targetX = targetX;
        label.targetY = targetY;

        label.text.text = `+${value}`;
        label.text.style.fill = color;
        
        // Reset wizualny
        label.text.x = startX;
        label.text.y = startY;
        label.text.alpha = 1;
        label.text.scale.set(0.0); // Zaczynamy od zera (będzie Pop)
        label.text.visible = true;
    }

    public update(delta: number) {
        // Delta w Pixi to klatki (przy 60fps, 1.0 = 16ms).
        // Przeliczamy na sekundy dla łatwiejszej matematyki.
        const dt = delta / 60; 

        // KONFIGURACJA RUCHU "WISP"
        const HANG_TIME = 0.5; // Ile czasu wisi w miejscu (sekundy)
        const FLY_TIME = 0.4;  // Ile czasu leci do celu (sekundy)

        for (const label of this.pool) {
            if (!label.active) continue;

            label.timer += dt;

            // --- FAZA 1: HANG (Wiszenie / Pop) ---
            if (label.timer < HANG_TIME) {
                // Efekt "Pop" (skalowanie 0 -> 1.2 -> 1.0)
                // Prosta sinusoida dla sprężystości
                let scaleProgress = Math.min(1.0, label.timer * 4.0); // Szybki pop
                // Elastic effect
                const scale = Math.sin(scaleProgress * Math.PI / 2) * 1.2;
                label.text.scale.set(scale);

                // Lekkie unoszenie się w górę
                label.text.y = label.startY - (label.timer * 30); // 30px w górę
                label.text.x = label.startX; // X bez zmian
            }
            
            // --- FAZA 2: FLY (Lot do celu) ---
            else {
                const flyProgress = (label.timer - HANG_TIME) / FLY_TIME;

                if (flyProgress >= 1.0) {
                    // Doleciał!
                    label.active = false;
                    label.text.visible = false;
                } else {
                    // Ruch wykładniczy (coraz szybciej)
                    // t^3 daje fajne przyspieszenie
                    const t = flyProgress * flyProgress * flyProgress;

                    // Interpolacja pozycji (od pozycji po fazie Hang do Celu)
                    // (HangTime * 30 to offset Y z fazy 1)
                    const currentStartY = label.startY - (HANG_TIME * 30);

                    label.text.x = currentStartY + (label.targetX - label.startX) * t + label.startX - currentStartY; // Fix math below
                    // Prostsza interpolacja Liniowa (Lerp) na współczynniku t (który jest nieliniowy)
                    label.text.x = label.startX + (label.targetX - label.startX) * t;
                    label.text.y = currentStartY + (label.targetY - currentStartY) * t;

                    // Efekt "wessania" (zmniejszanie i rozciąganie)
                    const scale = 1.0 - (t * 0.8); // Zmniejsz do 0.2
                    label.text.scale.set(scale, scale); // Można dać (scale, scale * 1.5) dla rozciągnięcia
                    label.text.alpha = 1.0; 
                }
            }
        }
    }
}