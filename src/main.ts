import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { CityScene } from './scenes/CityScene'; // NOWOŚĆ: Import
import { BlockRegistry } from './BlockDef'; 
import { CurrentTheme } from './Config';
import { type LevelConfig } from './LevelDef';

const app = new PIXI.Application();

async function init() {
    await app.init({ 
        resizeTo: window,
        backgroundColor: CurrentTheme.background,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // Ładowanie zasobów
    const assetsToLoad = BlockRegistry.getAssetManifest();
    assetsToLoad.push({ alias: 'crack', src: '/assets/crack.svg' }); 

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

    // 1. MENU SCENE
    const menuScene = new MenuScene((level: LevelConfig) => {
        // Callback: Start Level (przekierowanie do gry)
        gameScene.setCurrentLevel(level);
        sceneManager.switchTo('GAME');
    });

    // Callback: Open City (przekierowanie do miasta)
    menuScene.onOpenCity = () => {
        sceneManager.switchTo('CITY');
    };

    // 2. GAME SCENE
    const gameScene = new GameScene(app, () => {
        // Callback: Back to Menu (po wyjściu z gry)
        sceneManager.switchTo('MENU');
    });

    // 3. CITY SCENE (NOWOŚĆ)
    const cityScene = new CityScene(() => {
        // Callback: Back to Menu (po wyjściu z miasta)
        sceneManager.switchTo('MENU');
    });

    // Rejestracja scen
    sceneManager.add('MENU', menuScene);
    sceneManager.add('GAME', gameScene);
    sceneManager.add('CITY', cityScene);

    // Start
    sceneManager.switchTo('MENU');

    // Obsługa resize i pętli gry
    window.addEventListener('resize', () => sceneManager.forceResize());
    sceneManager.forceResize();

    app.ticker.add((ticker) => {
        sceneManager.update(ticker.deltaTime);
    });
}

init();