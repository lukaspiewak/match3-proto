import * as PIXI from 'pixi.js';

class Particle {
    sprite: PIXI.Graphics;
    vx: number = 0;
    vy: number = 0;
    life: number = 0;
    active: boolean = false;

    constructor(container: PIXI.Container) {
        this.sprite = new PIXI.Graphics();
        this.sprite.rect(-5, -5, 10, 10); // Mały kwadrat 10x10
        this.sprite.fill(0xFFFFFF);
        this.sprite.visible = false;
        container.addChild(this.sprite);
    }
}

export class ParticleSystem {
    private particles: Particle[] = [];
    private poolSize = 100;
    
    // NOWOŚĆ: Udostępniamy kontener na zewnątrz
    public container: PIXI.Container;

    constructor(app: PIXI.Application) {
        // Tworzymy kontener, ale NIE dodajemy go do stage (robi to BoardRenderer)
        this.container = new PIXI.Container();

        // Inicjalizacja puli
        for (let i = 0; i < this.poolSize; i++) {
            this.particles.push(new Particle(this.container));
        }
    }

    public spawn(x: number, y: number, color: number) {
        for (let i = 0; i < 8; i++) {
            const p = this.getFreeParticle();
            if (!p) return;

            p.active = true;
            p.life = 1.0; 
            p.sprite.visible = true;
            p.sprite.x = x;
            p.sprite.y = y;
            p.sprite.tint = color;
            p.sprite.rotation = Math.random() * Math.PI;

            const angle = (Math.PI * 2 * i) / 8;
            const speed = 2 + Math.random() * 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
        }
    }

    public update(delta: number) {
        for (const p of this.particles) {
            if (!p.active) continue;

            p.life -= 0.05 * delta; 

            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
            } else {
                p.sprite.x += p.vx * delta;
                p.sprite.y += p.vy * delta;
                p.sprite.rotation += 0.1 * delta;
                p.sprite.alpha = p.life; 
                p.sprite.scale.set(p.life);
            }
        }
    }

    private getFreeParticle(): Particle | null {
        return this.particles.find(p => !p.active) || null;
    }
}