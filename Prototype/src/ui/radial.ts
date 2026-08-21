import type { TechBelt } from '../bee/tech';

// RADIAL TECH SELECTOR — the radial SWITCHES, one button USES.
//
// That split is the whole point: a menu you must open mid-chase would kill the
// pace, but a menu you only touch between moves doesn't. Time slows rather
// than stopping so the physics stays readable (and a bee frozen mid-swing
// looks broken, where a bee in slow motion looks deliberate).

export class RadialMenu {
  open = false;
  /** Index the stick/mouse is currently pointing at, or -1 for "keep current". */
  highlighted = -1;

  private root: HTMLElement;
  private ring: HTMLElement;
  private label: HTMLElement;
  private blurb: HTMLElement;
  private wedges: HTMLElement[] = [];
  private angle = 0;

  constructor(private belt: TechBelt) {
    this.root = document.createElement('div');
    this.root.id = 'radial';
    this.root.innerHTML = `
      <div class="radial-ring"></div>
      <div class="radial-center">
        <div class="radial-label"></div>
        <div class="radial-blurb"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.ring = this.root.querySelector('.radial-ring') as HTMLElement;
    this.label = this.root.querySelector('.radial-label') as HTMLElement;
    this.blurb = this.root.querySelector('.radial-blurb') as HTMLElement;
    this.rebuild();
  }

  /** Call whenever the tech list changes. */
  rebuild() {
    this.ring.innerHTML = '';
    this.wedges = [];
    const items = this.belt.all;
    const n = items.length;
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'radial-wedge';
      el.textContent = item.icon;
      // Lay out around a circle, first item at the top.
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      el.style.left = `${50 + Math.cos(a) * 38}%`;
      el.style.top = `${50 + Math.sin(a) * 38}%`;
      this.ring.appendChild(el);
      this.wedges.push(el);
    });
  }

  /** `dx`/`dy` are a stick vector or accumulated mouse delta, screen-space. */
  update(dx: number, dy: number) {
    if (!this.open) return;
    const mag = Math.hypot(dx, dy);
    if (mag > 0.35) {
      this.angle = Math.atan2(dy, dx);
      const n = this.belt.all.length;
      if (n > 0) {
        // +PI/2 undoes the "first item at top" offset before quantising.
        let t = (this.angle + Math.PI / 2) / (Math.PI * 2);
        t -= Math.floor(t);
        this.highlighted = Math.round(t * n) % n;
      }
    }
    this.render();
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.highlighted = this.belt.activeIndex;
    this.rebuild();
    this.root.classList.add('show');
    this.render();
  }

  /** Commit the highlighted choice and close. */
  hide(): number {
    this.open = false;
    this.root.classList.remove('show');
    const chosen = this.highlighted;
    this.highlighted = -1;
    return chosen;
  }

  private render() {
    const items = this.belt.all;
    this.wedges.forEach((el, i) => {
      el.classList.toggle('hot', i === this.highlighted);
      el.classList.toggle('equipped', i === this.belt.activeIndex);
    });
    const hot = items[this.highlighted];
    this.label.textContent = hot ? hot.name : '';
    this.blurb.textContent = hot ? hot.blurb : '';
  }
}
