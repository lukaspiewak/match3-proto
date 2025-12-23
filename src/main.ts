import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { BlockRegistry } from './BlockDef'; 
import { CurrentTheme } from './Config'; // Import motywu

const app = new PIXI.Application();

async function init() {
    await app.init({ 
        resizeTo: window,
        // ZMIANA: Kolor z motywu
        backgroundColor: CurrentTheme.background,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // --- PRELOAD ASSETS ---
    const assetsToLoad = BlockRegistry.getAssetManifest();

    const loadPromises = assetsToLoad.map(async (asset) => {
        try {
            await PIXI.Assets.load(asset);
        } catch (e) {
            console.warn(`Failed to load asset: ${asset.alias} (${asset.src}). Will use text fallback.`);
        }
    });

    await Promise.all(loadPromises);
    console.log("Asset loading complete.");

    // --- INIT SCENE MANAGER ---
    const sceneManager = new SceneManager(app);

    const menuScene = new MenuScene(() => {
        sceneManager.switchTo('GAME');
    });

    const gameScene = new GameScene(app, () => {
        sceneManager.switchTo('MENU');
    });

    sceneManager.add('MENU', menuScene);
    sceneManager.add('GAME', gameScene);

    sceneManager.switchTo('MENU');

    window.addEventListener('resize', () => sceneManager.forceResize());
    sceneManager.forceResize();

    app.ticker.add((ticker) => {
        sceneManager.update(ticker.deltaTime);
    });
}

init();