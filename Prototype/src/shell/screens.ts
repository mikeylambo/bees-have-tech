import type { Actions } from '../core/input';
import type { Settings } from './settings';
import { SENS_MIN, SENS_MAX, FOV_MIN, FOV_MAX } from './settings';

// THE SCREENS — title, pause, settings, controls.
//
// One menu primitive, four uses. The rules it enforces are the ones that are
// easy to get wrong and impossible to un-notice:
//
//   · every row is reachable by KEYBOARD ALONE and by PAD ALONE. The workshop
//     already solved this with edge-detected menuDelta; this reuses the
//     convention rather than inventing a second one.
//   · the mouse works too, because the first click on the title screen is also
//     the click that takes pointer lock and starts audio, and asking for two
//     clicks to express one intention is a tax.
//   · one visual language: the HUD's honey-gold on near-black, ui-monospace.
//     A title screen that looks like a different product than the HUD under it
//     is worse than no title screen.

export type Row =
  | { kind: 'action'; label: string; hint?: string; disabled?: boolean; run: () => void }
  | { kind: 'toggle'; label: string; get: () => boolean; set: (v: boolean) => void }
  | {
      kind: 'slider'; label: string; min: number; max: number; step: number;
      get: () => number; set: (v: number) => void; format: (v: number) => string;
    }
  | { kind: 'note'; label: string };

function selectable(r: Row): boolean {
  return r.kind !== 'note' && !(r.kind === 'action' && r.disabled);
}

export class Menu {
  private sel = 0;
  private rows: Row[] = [];

  constructor(private host: HTMLElement, private onRender?: () => void) {}

  /**
   * A new list of rows means a new screen — Screens only calls this on a
   * change, never on an in-place redraw — so the cursor goes to the top.
   * Carrying it over meant opening Settings landed you on whichever row index
   * the last screen happened to leave behind, and A/D then adjusted a setting
   * nobody was looking at. `focus()` moves it deliberately where that matters.
   */
  set(rows: Row[]) {
    this.rows = rows;
    this.sel = Math.max(0, this.rows.findIndex(selectable));
    this.render();
  }

  /** Start at a named row — "Continue" should be highlighted, not "Settings". */
  focus(label: string) {
    const i = this.rows.findIndex((r) => r.label === label && selectable(r));
    if (i >= 0) this.sel = i;
    this.render();
  }

  move(delta: number) {
    if (!delta || this.rows.length === 0) return;
    const step = Math.sign(delta);
    for (let i = 0; i < this.rows.length; i++) {
      this.sel = (this.sel + step + this.rows.length) % this.rows.length;
      if (selectable(this.rows[this.sel])) break;
    }
    this.render();
  }

  /** Left/right on the highlighted row. Only sliders and toggles care. */
  adjust(delta: number) {
    if (!delta) return;
    const r = this.rows[this.sel];
    if (!r) return;
    if (r.kind === 'toggle') r.set(delta > 0);
    else if (r.kind === 'slider') {
      const v = Math.max(r.min, Math.min(r.max, r.get() + r.step * Math.sign(delta)));
      r.set(v);
    } else return;
    this.render();
  }

  confirm() {
    const r = this.rows[this.sel];
    if (!r) return;
    if (r.kind === 'action' && !r.disabled) r.run();
    else if (r.kind === 'toggle') {
      r.set(!r.get());
      this.render();
    }
  }

  private render() {
    this.host.innerHTML = '';
    this.rows.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'sm-row';
      if (r.kind === 'note') {
        el.classList.add('sm-note');
        el.textContent = r.label;
        this.host.appendChild(el);
        return;
      }
      if (i === this.sel) el.classList.add('sel');
      if (r.kind === 'action' && r.disabled) el.classList.add('off');

      const name = document.createElement('span');
      name.className = 'sm-name';
      name.textContent = r.label;
      el.appendChild(name);

      const val = document.createElement('span');
      val.className = 'sm-val';
      if (r.kind === 'toggle') val.textContent = r.get() ? 'ON' : 'OFF';
      else if (r.kind === 'slider') {
        const t = (r.get() - r.min) / (r.max - r.min);
        // Ten cells, drawn in text: a real <input type=range> would drag in a
        // second widget vocabulary for one control.
        const filled = Math.round(t * 10);
        val.textContent = `${'█'.repeat(filled)}${'·'.repeat(10 - filled)} ${r.format(r.get())}`;
      } else if (r.kind === 'action' && r.hint) {
        val.textContent = r.hint;
      }
      el.appendChild(val);

      if (selectable(r)) {
        el.addEventListener('mouseenter', () => { this.sel = i; this.render(); });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sel = i;
          this.confirm();
        });
      }
      this.host.appendChild(el);
    });
    this.onRender?.();
  }
}

export type ScreenId =
  | 'title' | 'pause' | 'settings' | 'controls' | 'confirmNew' | 'journal';

/** Everything the Journal needs to describe a run back to the player. */
export interface JournalEntry {
  title: string;
  done: boolean;
  objectives: Array<{ text: string; have: number; need: number }>;
}

export interface JournalData {
  quests: JournalEntry[];
  salvage: number;
  lifetime: number;
  blueprints: Array<{ icon: string; name: string; effect: string; cost: number; state: 'built' | 'known' | 'locked' }>;
}

export interface ScreenHooks {
  hasSave: () => boolean;
  play: () => void;
  newGame: () => void;
  resume: () => void;
  quitToTitle: () => void;
  settings: Settings;
  /** Read once per open — the Journal is a snapshot, not a live view. */
  journal: () => JournalData;
}

const CONTROLS: Array<[string, string, string]> = [
  ['Fly', 'W A S D', 'left stick'],
  ['Altitude', 'Space / C', 'RT / LT'],
  ['Overdrive', 'Shift', 'A'],
  ['Look', 'mouse', 'right stick'],
  ['Use tech', 'left click / E', 'RB'],
  ['Sting', 'right click / Q', 'B'],
  ['Tech alt', 'F', 'X'],
  ['Tech wheel', 'hold Tab', 'hold LB'],
  ['Cycle tech', 'scroll', 'd-pad'],
  ['Hive workshop', 'R (at the hive)', 'Y'],
  ['Come home', 'hold X', 'hold Back'],
  ['Pause', 'Esc', 'Start'],
  ['Hide the HUD', 'H', '—'],
];

export class Screens {
  private root: HTMLElement;
  private panel: HTMLElement;
  private list: HTMLElement;
  private menu: Menu;
  private stack: ScreenId[] = [];

  constructor(private hooks: ScreenHooks) {
    this.root = document.createElement('div');
    this.root.id = 'shellScreen';
    this.root.innerHTML = `
      <div class="sm-panel">
        <div class="sm-head"></div>
        <div class="sm-list"></div>
        <div class="sm-keys"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.panel = this.root.querySelector('.sm-panel') as HTMLElement;
    this.list = this.root.querySelector('.sm-list') as HTMLElement;
    this.menu = new Menu(this.list);
  }

  get open(): boolean {
    return this.stack.length > 0;
  }

  /** How deep we are — the shell only lets Esc resume from the root. */
  get depth(): number {
    return this.stack.length;
  }

  get top(): ScreenId | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  show(id: ScreenId) {
    this.stack = [id];
    this.render();
  }

  push(id: ScreenId) {
    this.stack.push(id);
    this.render();
  }

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.render();
    }
  }

  hide() {
    this.stack = [];
    this.root.classList.remove('show');
  }

  /** One frame of menu input. Returns true if it consumed the cancel. */
  update(act: Actions): boolean {
    if (!this.open) return false;
    this.menu.move(act.menuDelta);
    this.menu.adjust(act.menuDeltaX);
    if (act.confirmPressed) this.menu.confirm();
    if (act.cancelPressed && this.stack.length > 1) {
      this.back();
      return true;
    }
    return false;
  }

  private render() {
    const id = this.top;
    if (!id) return this.hide();
    this.root.classList.add('show');
    this.root.classList.toggle('is-title', id === 'title');
    const head = this.panel.querySelector('.sm-head') as HTMLElement;
    const keys = this.panel.querySelector('.sm-keys') as HTMLElement;
    this.panel.classList.toggle('wide', id === 'controls');
    // Reference screens have nothing to choose or adjust, so they must not
    // claim otherwise — a keys strip that lists controls the screen ignores
    // is the kind of small lie that makes a player distrust the rest of it.
    const reference = id === 'controls' || id === 'journal';
    keys.innerHTML = reference
      ? '<b>Esc</b>/<b>B</b> back'
      : this.stack.length > 1
        ? '<b>W/S</b> choose &nbsp; <b>A/D</b> adjust &nbsp; <b>Enter</b>/<b>A</b> select &nbsp; <b>Esc</b>/<b>B</b> back'
        : '<b>W/S</b> choose &nbsp; <b>Enter</b>/<b>A</b> select';

    switch (id) {
      case 'title': {
        head.innerHTML = `
          <div class="sm-title">THE BEES HAVE TECH!</div>
          <div class="sm-tag">Scientists thought bees built hives.<br />
            They actually built civilization.</div>`;
        const saved = this.hooks.hasSave();
        this.menu.set([
          {
            kind: 'action', label: 'Continue', disabled: !saved,
            hint: saved ? '' : 'no run yet',
            run: () => this.hooks.play(),
          },
          {
            kind: 'action',
            label: 'New Game',
            // Losing a run to a mis-press is the one destructive thing a title
            // screen can do, so an existing save gets asked about — once.
            run: () => (saved ? this.push('confirmNew') : this.hooks.newGame()),
          },
          { kind: 'action', label: 'Settings', run: () => this.push('settings') },
          { kind: 'action', label: 'Controls', run: () => this.push('controls') },
          {
            kind: 'action', label: 'Estate blockout', hint: 'dev',
            run: () => { window.location.href = './estate.html'; },
          },
        ]);
        this.menu.focus(saved ? 'Continue' : 'New Game');
        break;
      }

      case 'confirmNew': {
        head.innerHTML = '<div class="sm-h2">START OVER?</div>'
          + '<div class="sm-sub">There is a run in progress. A new game throws it away.</div>';
        this.menu.set([
          { kind: 'action', label: 'Keep my run', run: () => this.back() },
          { kind: 'action', label: 'Start over', run: () => this.hooks.newGame() },
        ]);
        this.menu.focus('Keep my run');
        break;
      }

      case 'pause': {
        head.innerHTML = '<div class="sm-h2">PAUSED</div>';
        this.menu.set([
          { kind: 'action', label: 'Resume', run: () => this.hooks.resume() },
          { kind: 'action', label: 'Journal', run: () => this.push('journal') },
          { kind: 'action', label: 'Settings', run: () => this.push('settings') },
          { kind: 'action', label: 'Controls', run: () => this.push('controls') },
          { kind: 'action', label: 'Quit to title', run: () => this.hooks.quitToTitle() },
        ]);
        this.menu.focus('Resume');
        break;
      }

      case 'journal': {
        // Read-only. Everything here was previously visible ONLY by flying to
        // the hive and opening the shop, which meant "what have I done and
        // what do I own" was a trip across the property rather than a glance.
        const j = this.hooks.journal();
        head.innerHTML = '<div class="sm-h2">JOURNAL</div>'
          + `<div class="sm-sub">${j.salvage} salvage banked`
          + ` · ${j.lifetime} brought home all told</div>`;
        this.menu.set([]);
        const objRow = (o: { text: string; have: number; need: number }) => `
          <div class="sm-obj${o.have >= o.need ? ' done' : ''}">
            <span>${o.have >= o.need ? '✔' : '□'} ${o.text}</span>
            <b>${o.need > 1 ? `${o.have}/${o.need}` : ''}</b>
          </div>`;
        const questBlock = j.quests.length === 0
          ? '<div class="sm-note">Nothing yet.</div>'
          : j.quests.map((q) => `
              <div class="sm-jq${q.done ? ' done' : ''}">
                <div class="sm-jq-title">${q.done ? '✔' : '▸'} ${q.title}</div>
                ${q.done ? '' : q.objectives.map(objRow).join('')}
              </div>`).join('');
        const bpBlock = j.blueprints.map((b) => `
          <div class="sm-bp ${b.state}">
            <span class="ic">${b.icon}</span>
            <span class="nm">${b.name}</span>
            <span class="ef">${b.state === 'locked' ? 'not yet learned' : b.effect}</span>
            <span class="ct">${b.state === 'built' ? 'BUILT' : b.state === 'known' ? b.cost : '—'}</span>
          </div>`).join('');
        this.list.innerHTML = `
          <div class="sm-jhead">QUESTS</div>${questBlock}
          <div class="sm-jhead">BLUEPRINTS</div>${bpBlock}`;
        break;
      }

      case 'settings': {
        const s = this.hooks.settings;
        head.innerHTML = '<div class="sm-h2">SETTINGS</div>';
        this.menu.set([
          {
            kind: 'slider', label: 'Master volume', min: 0, max: 1, step: 0.1,
            get: () => s.values.volume,
            set: (v) => s.set('volume', Math.round(v * 10) / 10),
            format: (v) => `${Math.round(v * 100)}%`,
          },
          {
            kind: 'slider', label: 'Look sensitivity',
            min: SENS_MIN, max: SENS_MAX, step: (SENS_MAX - SENS_MIN) / 10,
            get: () => s.values.sensitivity,
            set: (v) => s.set('sensitivity', v),
            format: (v) => `${((v - SENS_MIN) / (SENS_MAX - SENS_MIN) * 100).toFixed(0)}%`,
          },
          {
            kind: 'toggle', label: 'Invert look Y',
            get: () => s.values.invertY, set: (v) => s.set('invertY', v),
          },
          {
            kind: 'slider', label: 'Field of view',
            min: FOV_MIN, max: FOV_MAX, step: 5,
            get: () => s.values.fov,
            set: (v) => s.set('fov', Math.round(v)),
            format: (v) => `${Math.round(v)}°`,
          },
          {
            kind: 'toggle', label: 'Show HUD',
            get: () => s.values.showHud, set: (v) => s.set('showHud', v),
          },
          {
            kind: 'toggle', label: 'Reduced motion',
            get: () => s.values.reducedMotion, set: (v) => s.set('reducedMotion', v),
          },
          {
            kind: 'action', label: 'Reset to defaults', hint: 'all of the above',
            run: () => { s.reset(); this.render(); },
          },
          {
            kind: 'note',
            label: 'Reduced motion also stops the speed FOV kick and camera dolly,'
              + ' which CSS alone cannot reach.',
          },
        ]);
        break;
      }

      case 'controls': {
        head.innerHTML = '<div class="sm-h2">CONTROLS</div>';
        // Emptied FIRST: the menu owns this element and clears it on set().
        // Painting the table before that clears it is how the screen ends up
        // blank on every second visit.
        this.menu.set([]);
        this.list.innerHTML = `
          <div class="sm-ctl-head"><span></span><span>KEYBOARD</span><span>PAD</span></div>
          ${CONTROLS.map(([what, kb, pad]) => `
            <div class="sm-ctl"><span>${what}</span><span>${kb}</span><span>${pad}</span></div>
          `).join('')}`;
        break;
      }
    }
  }
}
