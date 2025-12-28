import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { CityScene } from './scenes/CityScene'; 
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

    const sceneManager = new SceneManager(app);

    // 1. MENU
    const menuScene = new MenuScene((level: LevelConfig) => {
        gameScene.setCurrentLevel(level);
        sceneManager.switchTo('GAME');
    });

    menuScene.onOpenCity = () => {
        sceneManager.switchTo('CITY');
    };

    // 2. GAME
    const gameScene = new GameScene(app, () => {
        // Zawsze wracamy do menu (można zmienić na powrót do miasta jeśli stamtąd przyszliśmy)
        sceneManager.switchTo('MENU');
    });

    // 3. CITY
    const cityScene = new CityScene(
        // Callback Back (do menu)
        () => {
            sceneManager.switchTo('MENU');
        },
        // Callback Start Construction (do gry)
        (level: LevelConfig) => {
            gameScene.setCurrentLevel(level);
            sceneManager.switchTo('GAME');
        }
    );

    sceneManager.add('MENU', menuScene);
    sceneManager.add('GAME', gameScene);
    sceneManager.add('CITY', cityScene);

    sceneManager.switchTo('MENU');

    window.addEventListener('resize', () => sceneManager.forceResize());
    sceneManager.forceResize();

    app.ticker.add((ticker) => {
        sceneManager.update(ticker.deltaTime);
    });
}

init();