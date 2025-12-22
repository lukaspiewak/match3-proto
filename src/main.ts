import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const app = new PIXI.Application();

async function init() {
    await app.init({ 
        resizeTo: window,
        backgroundColor: 0x1a1a1a,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // Inicjalizacja Scene Managera
    const sceneManager = new SceneManager(app);

    // Definiowanie scen
    const menuScene = new MenuScene(() => {
        sceneManager.switchTo('GAME');
    });

    const gameScene = new GameScene(app, () => {
        sceneManager.switchTo('MENU');
    });

    sceneManager.add('MENU', menuScene);
    sceneManager.add('GAME', gameScene);

    // Start
    sceneManager.switchTo('MENU');

    // Obsługa resize
    window.addEventListener('resize', () => sceneManager.forceResize());
    sceneManager.forceResize();

    // Pętla gry
    app.ticker.add((ticker) => {
        sceneManager.update(ticker.deltaTime);
    });
}

init();