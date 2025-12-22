import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { BLOCK_ASSET_PATHS, AppConfig } from './Config'; // Dodano AppConfig do importów jeśli potrzebny, lub usunięto jeśli nieużywany tu bezpośrednio
import { Random } from './Random'; // Importujemy Random żeby zainicjować ziarno

const app = new PIXI.Application();

async function init() {
    // Inicjalizacja ziarna losowości na starcie
    // (Wcześniej było w startGame, ale warto mieć to globalnie dostępne)
    // Random.setSeed(AppConfig.seed); // To robimy w GameScene/MenuScene przy starcie

    await app.init({ 
        resizeTo: window,
        backgroundColor: 0x1a1a1a,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // --- PRELOAD ASSETS (ROBUST) ---
    // Przygotowujemy listę assetów
    const assetsToLoad = BLOCK_ASSET_PATHS.map((path, index) => ({
        alias: `block_${index}`, 
        src: path
    }));

    // ZMIANA: Zamiast ładować wszystko jedną metodą, która wywala się przy pierwszym błędzie,
    // tworzymy tablicę obietnic (Promises), gdzie każda próbuje załadować JEDEN plik.
    // Dzięki temu brak jednego pliku nie przerywa ładowania pozostałych.
    const loadPromises = assetsToLoad.map(async (asset) => {
        try {
            await PIXI.Assets.load(asset);
            // console.log(`Loaded: ${asset.alias}`);
        } catch (e) {
            console.warn(`Failed to load asset: ${asset.alias} (${asset.src}). Will use text fallback.`);
            // Nie rzucamy błędu dalej, połykamy go, żeby Promise.all się nie wywaliło
        }
    });

    // Czekamy, aż wszystkie próby się zakończą (sukcesem lub porażką)
    await Promise.all(loadPromises);

    console.log("Asset loading complete (with potential failures). Starting game.");

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