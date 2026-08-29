// CAST CARDS — introduce the people, once each, ever.
//
// M8 gave the property four residents with names, jobs, colours and opinions
// that add up to the exposure meter. The player met all of that as: four
// anonymous figures walking around. The whole social system was invisible.
//
// Dumpster Gang introduces its Exterminator with a full character card —
// portrait, name badge, title — and that is the pattern worth taking, because
// an antagonist you have been INTRODUCED to is a different thing from a
// silhouette on a lawn. What is NOT worth taking is their look: heavy
// outlined display type is their language, and we already have one.
//
// So: a lower-third card, in the HUD's own honey-gold on near-black, carrying
// the one thing a 3D portrait would otherwise have to convey — the person's
// COLOUR, so the card and the figure in the world are obviously the same
// individual. Fired once, on the first time each of them clocks you, and
// remembered across a refresh because it rides in the save's taught set.

export interface CastMember {
  /** Stable id — this is what gets written to the save. */
  id: string;
  name: string;
  /** THE SHORT FUSE, THE HANDY ONE. Their job in the household. */
  role: string;
  /** Their read on you, in their own words. */
  quote: string;
  /** Shirt colour, so the card and the figure on the lawn are one person. */
  color: number;
}

const HOLD = 4.2;

export class CastCard {
  private root: HTMLElement;
  private timer = 0;
  private queue: CastMember[] = [];
  private showing = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'castCard';
    this.root.innerHTML = `
      <div class="cc-swatch"></div>
      <div class="cc-body">
        <div class="cc-role"></div>
        <div class="cc-name"></div>
        <div class="cc-quote"></div>
      </div>`;
    document.body.appendChild(this.root);
  }

  /**
   * Queue an introduction. Two people clocking you in the same second is
   * normal on a small terrace, and two cards on top of each other reads as a
   * bug — so they line up and play one at a time.
   */
  show(m: CastMember) {
    this.queue.push(m);
  }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.root.classList.remove('show');
        this.showing = false;
      }
      return;
    }
    if (this.showing || this.queue.length === 0) return;
    const m = this.queue.shift()!;
    this.showing = true;
    this.timer = HOLD;
    (this.root.querySelector('.cc-role') as HTMLElement).textContent = m.role;
    (this.root.querySelector('.cc-name') as HTMLElement).textContent = m.name;
    (this.root.querySelector('.cc-quote') as HTMLElement).textContent = m.quote;
    (this.root.querySelector('.cc-swatch') as HTMLElement).style.background =
      `#${m.color.toString(16).padStart(6, '0')}`;
    // Re-trigger the entrance from the start position, then let the
    // transition carry it in on the next frame.
    this.root.classList.remove('show');
    void this.root.offsetWidth;
    requestAnimationFrame(() => {
      if (this.showing) this.root.classList.add('show');
    });
  }

  /** Nothing should be mid-introduction on the title screen. */
  clear() {
    this.queue.length = 0;
    this.timer = 0;
    this.showing = false;
    this.root.classList.remove('show');
  }
}
