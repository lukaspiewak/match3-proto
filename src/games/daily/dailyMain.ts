import './daily.css';
import * as PIXI from 'pixi.js';
import { TILE_SIZE, GAP } from '../../engine/Config';
import { getDaily } from './DailyChallenge';
import { registerDailyBlocks } from './dailyBlocks';
import { DailyGame } from './DailyGame';

function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function boot() {
    registerDailyBlocks();
    const def = getDaily(todayLocal());

    const boardPx = def.cols * TILE_SIZE + GAP * 2;
    const app = new PIXI.Application();
    await app.init({
        width: boardPx,
        height: def.rows * TILE_SIZE + GAP * 2,
        backgroundAlpha: 0,          // przezroczyste — tło daje DOM (Tailwind)
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
    });

    // DailyGame buduje warstwę DOM (w tym #board-mount), więc canvas montujemy po nim.
    new DailyGame(app, def);
    document.getElementById('board-mount')!.appendChild(app.canvas);
}

boot();
