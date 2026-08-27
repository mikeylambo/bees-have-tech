import type { BuildContext, Workshop } from '../game/blueprints';

// THE WORKSHOP PANEL — the shop, but at a place, in the world.
//
// It only opens at the hive mouth, and it slows time rather than stopping it,
// exactly like the tech radial: a human can still be walking toward you while
// you shop, which is the only thing keeping this from being a menu screen.

export class WorkshopUI {
  open = false;
  private root: HTMLElement;
  private list: HTMLElement;
  private bank: HTMLElement;
  private blurb: HTMLElement;
  private prompt: HTMLElement;
  private sel = 0;

  constructor(private shop: Workshop) {
    this.root = document.createElement('div');
    this.root.id = 'shop';
    this.root.innerHTML = `
      <div class="shop-panel">
        <div class="shop-head">
          <span>🍯 HIVE WORKSHOP</span>
          <span class="shop-bank"></span>
        </div>
        <ul class="shop-list"></ul>
        <div class="shop-blurb"></div>
        <div class="shop-keys">
          <b>W/S</b> choose &nbsp; <b>Enter</b>/<b>A</b> build &nbsp;
          <b>Esc</b>/<b>B</b> or <b>R</b>/<b>Y</b> close
        </div>
      </div>`;
    document.body.appendChild(this.root);
    this.list = this.root.querySelector('.shop-list') as HTMLElement;
    this.bank = this.root.querySelector('.shop-bank') as HTMLElement;
    this.blurb = this.root.querySelector('.shop-blurb') as HTMLElement;

    this.prompt = document.createElement('div');
    this.prompt.id = 'shopPrompt';
    this.prompt.innerHTML = '<b>R</b> · <b>Y</b> &nbsp; hive workshop';
    document.body.appendChild(this.prompt);
  }

  /** "You could shop here" — shown while hovering at the hive mouth. */
  showPrompt(visible: boolean) {
    this.prompt.classList.toggle('show', visible && !this.open);
  }

  show(salvage: number) {
    if (this.open) return;
    this.open = true;
    this.sel = 0;
    this.root.classList.add('show');
    this.prompt.classList.remove('show');
    this.render(salvage);
  }

  hide() {
    this.open = false;
    this.root.classList.remove('show');
  }

  move(delta: number, salvage: number) {
    const n = this.shop.catalog().length;
    if (n === 0) return;
    this.sel = (((this.sel + delta) % n) + n) % n;
    this.render(salvage);
  }

  /** Returns the blueprint id built, or null if the choice wasn't affordable. */
  confirm(salvage: number, ctx: BuildContext): { id: string; cost: number } | null {
    const rows = this.shop.catalog();
    const bp = rows[this.sel];
    if (!bp) return null;
    const cost = this.shop.build(bp.id, salvage, ctx);
    if (cost === 0) {
      this.root.classList.remove('deny');
      void this.root.offsetWidth;
      this.root.classList.add('deny');
      return null;
    }
    return { id: bp.id, cost };
  }

  render(salvage: number) {
    const rows = this.shop.catalog();
    this.bank.textContent = `${salvage} salvage banked`;
    if (rows.length === 0) {
      this.list.innerHTML =
        '<li class="shop-empty">No blueprints yet. The hive learns by doing.</li>';
      this.blurb.textContent = '';
      return;
    }
    this.sel = Math.min(this.sel, rows.length - 1);
    this.list.innerHTML = rows
      .map((b, i) => {
        const owned = this.shop.built.has(b.id);
        const poor = !owned && salvage < b.cost;
        const cls = [
          i === this.sel ? 'sel' : '',
          owned ? 'owned' : '',
          poor ? 'poor' : '',
        ].filter(Boolean).join(' ');
        return `<li class="${cls}">
          <span class="ic">${b.icon}</span>
          <span class="nm">${b.name}</span>
          <span class="ef">${b.effect}</span>
          <span class="ct">${owned ? 'BUILT' : b.cost}</span>
        </li>`;
      })
      .join('');
    const hot = rows[this.sel];
    this.blurb.textContent = hot ? hot.blurb : '';
  }
}
