import * as THREE from 'three';

// RESCUE — hold to come home.
//
// 325 colliders, hollow buildings, a gutter you fly inside and a 25 cm terrace
// lip that is a fifteen-storey drop at bee scale. Sooner or later a bee gets
// wedged somewhere it cannot fly out of, and today that costs the whole run.
//
// Three decisions, all of them about what this must NOT become:
//
//   · It is a HOLD, with a fill ring. A tap would be a fast-travel button, and
//     this property is meant to be crossed — the 80 m drive only means
//     something if flying it is the only way to be at the other end of it.
//   · It does NOT reset exposure. Rescue is for geometry, not consequences.
//     Teleporting away from a household that just watched you steal a battery
//     and having them forget is a cheat, and the meter is the game's spine.
//   · On a pad it is Back/Select, because X/Square is already `alt`.

const HOLD_TIME = 1.2;

export class Rescue {
  /** 0..1 — how far through the hold we are. */
  progress = 0;
  private ring: HTMLElement;
  private fill: HTMLElement;
  private fired = false;

  /** Called once when the hold completes. */
  onRescue?: () => void;

  constructor() {
    this.ring = document.createElement('div');
    this.ring.id = 'rescueRing';
    this.ring.innerHTML = `
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle class="rr-track" cx="22" cy="22" r="19" />
        <circle class="rr-fill" cx="22" cy="22" r="19" />
      </svg>
      <span class="rr-label">HOME</span>`;
    document.body.appendChild(this.ring);
    this.fill = this.ring.querySelector('.rr-fill') as HTMLElement;
  }

  /**
   * `held` is the raw button state; this owns the timing. Pass `active: false`
   * while a menu is up so a held key doesn't charge a rescue behind a screen.
   */
  update(dt: number, held: boolean, active: boolean) {
    if (!held || !active) {
      // Drain faster than it fills: letting go should visibly abandon the
      // attempt, not leave a ring hanging around implying it half-counted.
      this.progress = Math.max(0, this.progress - dt / (HOLD_TIME * 0.45));
      this.fired = false;
    } else {
      this.progress = Math.min(1, this.progress + dt / HOLD_TIME);
      if (this.progress >= 1 && !this.fired) {
        this.fired = true;
        this.onRescue?.();
      }
    }
    this.render();
  }

  private render() {
    const p = this.progress;
    this.ring.classList.toggle('show', p > 0.02);
    // 119.4 is the circumference of r=19. Drawn as a dash offset so the ring
    // fills clockwise from the top without any per-frame path maths.
    this.fill.style.strokeDashoffset = `${119.4 * (1 - p)}`;
    this.ring.classList.toggle('done', p >= 1);
  }
}

/**
 * Put the bee at the hive mouth, stopped, empty-handed.
 *
 * Deliberately takes the pieces rather than the whole game: this is the only
 * place in the shell that writes to the simulation, and keeping the surface
 * to "one body, one position" is what makes that safe to say.
 */
export function rescueToHive(
  body: { setTranslation: (t: { x: number; y: number; z: number }, wake: boolean) => void;
    setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
    setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void; },
  mouth: THREE.Vector3,
  drop: () => void,
) {
  drop();
  // Just outside the mouth, not inside it — arriving embedded in the hive is a
  // rescue that needs a rescue.
  body.setTranslation({ x: mouth.x, y: mouth.y + 6, z: mouth.z + 14 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
