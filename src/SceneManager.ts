import * as PIXI from 'pixi.js';

export interface Scene extends PIXI.Container {
    update(delta: number): void;
    resize(width: number, height: number): void;
    onShow?(): void;
    onHide?(): void;
}

export class SceneManager {
    private app: PIXI.Application;
    private currentScene: Scene | null = null;
    private scenes: Map<string, Scene> = new Map();

    constructor(app: PIXI.Application) {
        this.app = app;
    }

    public add(name: string, scene: Scene) {
        this.scenes.set(name, scene);
        // Scena jest ukryta na starcie
        scene.visible = false;
        this.app.stage.addChild(scene);
    }

    public switchTo(name: string) {
        if (this.currentScene) {
            if (this.currentScene.onHide) this.currentScene.onHide();
            this.currentScene.visible = false;
        }

        const nextScene = this.scenes.get(name);
        if (nextScene) {
            this.currentScene = nextScene;
            nextScene.visible = true;
            if (nextScene.onShow) nextScene.onShow();
            
            // Wymuś resize przy wejściu, żeby wszystko się ułożyło
            this.forceResize();
        }
    }

    public update(delta: number) {
        if (this.currentScene) {
            this.currentScene.update(delta);
        }
    }

    public forceResize() {
        if (this.currentScene) {
            this.currentScene.resize(this.app.screen.width, this.app.screen.height);
        }
    }
}