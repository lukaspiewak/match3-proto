import * as PIXI from 'pixi.js';

class Particle {
    sprite: PIXI.Graphics;
    vx: number = 0;
    vy: number = 0;
    life: number = 0;
    active: boolean = false;

    constructor(container: PIXI.Container) {
        this.sprite = new PIXI.Graphics();
        this.sprite.rect(-5, -5, 10, 10); // Mały kwadrat 10x10, pivot w środku
        this.sprite.fill(0xFFFFFF);
        this.sprite.visible = false;
        container.addChild(this.sprite);
    }
}

export class ParticleSystem {
    private particles: Particle[] = [];
    private poolSize = 100;

    constructor(app: PIXI.Application) {
        const container = new PIXI.Container();
        app.stage.addChild(container);

        // Inicjalizacja puli (tworzymy 100 cząsteczek na zapas)
        for (let i = 0; i < this.poolSize; i++) {
            this.particles.push(new Particle(container));
        }
    }

    public spawn(x: number, y: number, color: number) {
        // Wypuść 8 cząsteczek w kółko
        for (let i = 0; i < 8; i++) {
            const p = this.getFreeParticle();
            if (!p) return;

            p.active = true;
            p.life = 1.0; // Żyje przez 100% czasu
            p.sprite.visible = true;
            p.sprite.x = x;
            p.sprite.y = y;
            p.sprite.tint = color;
            p.sprite.rotation = Math.random() * Math.PI;

            // Fizyka wybuchu (losowy kierunek)
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 2 + Math.random() * 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
        }
    }

    public update(delta: number) {
        for (const p of this.particles) {
            if (!p.active) continue;

            p.life -= 0.05 * delta; // Szybkość znikania

            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
            } else {
                p.sprite.x += p.vx * delta;
                p.sprite.y += p.vy * delta;
                p.sprite.rotation += 0.1 * delta;
                p.sprite.alpha = p.life; // Zanikanie (Fade out)
                p.sprite.scale.set(p.life); // Zmniejszanie
            }
        }
    }

    private getFreeParticle(): Particle | null {
        return this.particles.find(p => !p.active) || null;
    }
}