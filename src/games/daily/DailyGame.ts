import * as PIXI from 'pixi.js';
import { BoardRenderer } from '../../views/BoardRenderer';
import { BoardLogic } from '../../engine/BoardLogic';
import { MatchSession } from '../../engine/session/MatchSession';
import { BlockRegistry } from '../../engine/BlockDef';
import { TILE_SIZE, GAP } from '../../engine/Config';
import { createDailySession, shareString, type DailyDef, type DailyResult } from './DailyChallenge';

/**
 * DAILY GAME — front w modelu HYBRYDOWYM:
 *   • plansza (siatka, animacje, cząsteczki) w Pixi (reużyty BoardRenderer),
 *   • cała obudowa (nagłówek, licznik ruchów, pasek celu, modal wyniku/share) w DOM + Tailwind.
 * Logika i wynik pochodzą z silnika (MatchSession/DailyChallenge) — headless-testowalne.
 */
export class DailyGame {
    private app: PIXI.Application;
    private def: DailyDef;

    private logic!: BoardLogic;
    private session!: MatchSession;
    private renderer: BoardRenderer | null = null;

    // Stan inputu (swipe/klik) — własny, sprzęgnięty z MatchSession (nie z GameManagerem).
    private selectedId = -1;
    private dragging = false;
    private startX = 0; private startY = 0; private startId = -1;

    private finished = false;
    private ui!: DailyUI;

    constructor(app: PIXI.Application, def: DailyDef) {
        this.app = app;
        this.def = def;
        this.ui = new DailyUI(def, {
            onShare: () => this.copyShare(),
            onReplay: () => this.newRound(),
        });
        this.newRound();
        this.app.ticker.add((t) => this.update(t.deltaTime));
    }

    /** (Ponownie) buduje planszę tej samej łamigłówki. */
    private newRound() {
        if (this.renderer) { this.app.stage.removeChild(this.renderer); this.renderer.destroy({ children: true }); }
        this.finished = false;
        this.selectedId = -1; this.dragging = false; this.startId = -1;

        const { logic, session } = createDailySession(this.def, (won) => this.onFinished(won));
        this.logic = logic;
        this.session = session;

        const r = new BoardRenderer(this.app, logic);
        r.x = GAP; r.y = GAP;
        this.app.stage.addChild(r);
        r.initVisuals();
        this.bindInput(r);
        this.renderer = r;

        this.ui.hideEnd();
        this.refreshHud();
    }

    private update(dt: number) {
        this.session.update(dt);
        this.logic.update(dt);
        this.renderer?.update(dt, this.selectedId);
        this.refreshHud();
    }

    private refreshHud() {
        this.ui.setMoves(this.session.movesLeft, this.def.moveLimit);
        this.ui.setGoal(this.session.getGoalProgress(0), this.def.goalAmount);
    }

    private onFinished(won: boolean) {
        if (this.finished) return;
        this.finished = true;
        this.lastWon = won;
        this.ui.showEnd(won, this.buildResult(won));
    }

    private buildResult(won: boolean): DailyResult {
        return {
            won,
            movesUsed: this.def.moveLimit - this.session.movesLeft,
            moveLimit: this.def.moveLimit,
            collected: this.session.getGoalProgress(0),
            goalAmount: this.def.goalAmount,
            moves: [],
        };
    }

    private async copyShare() {
        const text = shareString(this.def, this.buildResult(this.lastWon));
        try {
            await navigator.clipboard.writeText(text);
            this.ui.flashShare('✅ Skopiowano!');
        } catch {
            this.ui.flashShare('Skopiuj ręcznie ⬆'); // np. brak uprawnień do schowka
        }
    }
    private lastWon = false;

    // --- INPUT (klik lub swipe na sąsiedni klocek) → session.requestMove ---

    private bindInput(r: BoardRenderer) {
        const c = r.getInputContainer();
        c.eventMode = 'static';
        c.on('pointerdown', (e) => this.onDown(e));
        c.on('pointermove', (e) => this.onMove(e));
        c.on('pointerup', (e) => this.onUp(e));
        c.on('pointerupoutside', () => { this.dragging = false; this.startId = -1; });
    }

    private posOf(e: PIXI.FederatedPointerEvent): number | null {
        const c = this.renderer!.getInputContainer();
        const p = c.toLocal(e.global);
        const col = Math.floor(p.x / TILE_SIZE);
        const row = Math.floor(p.y / TILE_SIZE);
        if (col < 0 || col >= this.logic.cols || row < 0 || row >= this.logic.rows) return null;
        return col + row * this.logic.cols;
    }

    private canPlay(): boolean {
        return !this.finished && this.session.isMyTurn(this.session.getCurrentPlayerId());
    }

    private onDown(e: PIXI.FederatedPointerEvent) {
        if (!this.canPlay()) return;
        const id = this.posOf(e);
        if (id === null) return;
        this.dragging = true; this.startX = e.global.x; this.startY = e.global.y; this.startId = id;
        if (this.selectedId === -1) this.selectedId = id; else this.tryMoveTo(id);
    }

    private onMove(e: PIXI.FederatedPointerEvent) {
        if (!this.dragging || !this.canPlay()) return;
        const dx = e.global.x - this.startX, dy = e.global.y - this.startY;
        const TH = TILE_SIZE * 0.5;
        if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
        let dirX = 0, dirY = 0;
        if (Math.abs(dx) > Math.abs(dy)) dirX = dx > 0 ? 1 : -1; else dirY = dy > 0 ? 1 : -1;
        this.session.requestMove(this.session.getCurrentPlayerId(), this.startId, dirX, dirY);
        this.dragging = false; this.startId = -1; this.selectedId = -1;
    }

    private onUp(e: PIXI.FederatedPointerEvent) {
        if (this.dragging) {
            const id = this.posOf(e);
            if (id !== null && id !== this.startId) this.tryMoveTo(id);
        }
        this.dragging = false; this.startId = -1;
    }

    private tryMoveTo(target: number) {
        if (this.selectedId === -1) return;
        const cols = this.logic.cols;
        const diff = Math.abs(target - this.selectedId);
        const adjacent = (diff === 1 && Math.floor(target / cols) === Math.floor(this.selectedId / cols)) || diff === cols;
        if (!adjacent) { this.selectedId = target; return; }
        let dirX = 0, dirY = 0;
        if (target === this.selectedId + 1) dirX = 1;
        else if (target === this.selectedId - 1) dirX = -1;
        else if (target === this.selectedId + cols) dirY = 1;
        else dirY = -1;
        this.session.requestMove(this.session.getCurrentPlayerId(), this.selectedId, dirX, dirY);
        this.selectedId = -1;
    }
}

/** Warstwa DOM+Tailwind: nagłówek, licznik ruchów, pasek celu, modal wyniku. */
class DailyUI {
    private movesEl: HTMLElement;
    private goalCurEl: HTMLElement;
    private goalBarEl: HTMLElement;
    private end: HTMLElement;
    private endEmoji: HTMLElement;
    private endTitle: HTMLElement;
    private endSub: HTMLElement;
    private endBar: HTMLElement;
    private shareBtn: HTMLButtonElement;
    private def: DailyDef;

    constructor(def: DailyDef, cb: { onShare: () => void; onReplay: () => void }) {
        this.def = def;
        const target = BlockRegistry.getById(def.goalTargetId);
        const gemColor = '#' + (target?.color ?? 0xffffff).toString(16).padStart(6, '0');
        const gemName = target?.name ?? 'klejnot';
        const gemSymbol = target?.symbol ?? '◆';

        const root = document.getElementById('daily-root')!;
        root.innerHTML = `
        <div class="min-h-screen flex flex-col items-center gap-3 py-4 px-3 bg-slate-950 text-slate-100 select-none">
          <header class="w-full max-w-md flex items-center justify-between">
            <div>
              <h1 class="text-lg font-bold tracking-tight">Daily <span class="text-indigo-400">#${def.number}</span></h1>
              <p class="text-xs text-slate-500">${def.date}</p>
            </div>
            <div class="rounded-xl bg-slate-800/80 px-4 py-1.5 text-center min-w-[64px]">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Ruchy</div>
              <div id="d-moves" class="text-2xl font-bold leading-tight">${def.moveLimit}</div>
            </div>
          </header>

          <div class="w-full max-w-md">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-300">Zbierz <span class="font-semibold" style="color:${gemColor}">${gemSymbol} ${gemName}</span></span>
              <span class="tabular-nums text-slate-400"><span id="d-goal-cur" class="font-bold text-slate-100">0</span>/${def.goalAmount}</span>
            </div>
            <div class="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div id="d-goal-bar" class="h-full rounded-full transition-all duration-300" style="width:0%;background:${gemColor}"></div>
            </div>
          </div>

          <main id="board-mount" class="flex w-full flex-1 items-center justify-center"></main>
          <p class="text-xs text-slate-600">Przesuń klejnot, aby ułożyć 3+ w linii</p>
        </div>

        <div id="d-end" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div class="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
            <div id="d-end-emoji" class="text-5xl"></div>
            <h2 id="d-end-title" class="mt-2 text-2xl font-bold"></h2>
            <p id="d-end-sub" class="mt-1 text-slate-400"></p>
            <pre id="d-end-bar" class="mt-4 whitespace-pre-wrap break-words font-mono text-lg leading-tight"></pre>
            <div class="mt-6 flex flex-col gap-2">
              <button id="d-share" class="rounded-xl bg-indigo-500 py-2.5 font-semibold transition hover:bg-indigo-400 active:scale-95">📋 Kopiuj wynik</button>
              <button id="d-replay" class="rounded-xl bg-slate-700 py-2.5 font-semibold transition hover:bg-slate-600 active:scale-95">↺ Zagraj ponownie</button>
            </div>
          </div>
        </div>`;

        this.movesEl = root.querySelector('#d-moves')!;
        this.goalCurEl = root.querySelector('#d-goal-cur')!;
        this.goalBarEl = root.querySelector('#d-goal-bar')!;
        this.end = root.querySelector('#d-end')!;
        this.endEmoji = root.querySelector('#d-end-emoji')!;
        this.endTitle = root.querySelector('#d-end-title')!;
        this.endSub = root.querySelector('#d-end-sub')!;
        this.endBar = root.querySelector('#d-end-bar')!;
        this.shareBtn = root.querySelector('#d-share')!;
        this.shareBtn.addEventListener('click', cb.onShare);
        (root.querySelector('#d-replay') as HTMLButtonElement).addEventListener('click', cb.onReplay);
    }

    public get boardMount(): HTMLElement { return document.getElementById('board-mount')!; }

    public setMoves(left: number, max: number) {
        this.movesEl.textContent = String(Math.max(0, left));
        this.movesEl.classList.toggle('text-red-400', left <= Math.max(2, max * 0.15));
    }

    public setGoal(cur: number, amount: number) {
        this.goalCurEl.textContent = String(Math.min(cur, amount));
        this.goalBarEl.style.width = Math.min(100, (cur / amount) * 100) + '%';
    }

    public showEnd(won: boolean, result: DailyResult) {
        this.endEmoji.textContent = won ? '🎉' : '😔';
        this.endTitle.textContent = won ? 'Rozwiązane!' : 'Koniec ruchów';
        this.endSub.textContent = won
            ? `Zebrano cel w ${result.movesUsed}/${result.moveLimit} ruchach`
            : `Zebrano ${result.collected}/${result.goalAmount}`;
        this.endBar.textContent = shareString(this.def, result).split('\n')[1] ?? '';
        this.end.classList.remove('hidden');
        this.end.classList.add('flex');
    }

    public hideEnd() {
        this.end.classList.add('hidden');
        this.end.classList.remove('flex');
    }

    public flashShare(msg: string) {
        const prev = this.shareBtn.textContent;
        this.shareBtn.textContent = msg;
        setTimeout(() => { this.shareBtn.textContent = prev; }, 1500);
    }
}
