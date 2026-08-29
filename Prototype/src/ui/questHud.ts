import * as THREE from 'three';
import type { Objective, Quest } from '../game/quests';

// QUEST UI — four surfaces, each answering a different question:
//
//   the card     "what am I being asked to do?"   (once, on offer)
//   the tracker  "what am I doing?"               (always, quiet)
//   the toast    "did that count?"                (on every increment)
//   the banner   "what did I get?"                (once, on completion)
//   the waypoint "which way?"                     (always, while it matters)
//
// The waypoint is not decoration. The yard got roughly four times bigger this
// milestone, and a collect quest in a world you can get lost in is a chore
// without one.

const _v = new THREE.Vector3();

// One honeycomb cell, pointy-top, drawn once and reused three times: the dark
// backing, the clip the honey rises inside, and the gold rim on top. A regular
// hexagon with a circumradius of 19 is 38 tall and 32.9 wide, which is where
// these numbers come from — they are not eyeballed.
const CELL = 'M16.5 0 L33 9.5 L33 28.5 L16.5 38 L0 28.5 L0 9.5 Z';
const CELL_H = 38;

function objectiveRow(o: Objective): string {
  const done = o.have >= o.need;
  const count = o.need > 1 ? `<b>${o.have}/${o.need}</b>` : '';
  return `<li class="${done ? 'done' : ''}"><span class="tick">${
    done ? '✔' : '▢'
  }</span><span>${o.text}</span>${count}</li>`;
}

export class QuestHud {
  private track: HTMLElement;
  private card: HTMLElement;
  private toast: HTMLElement;
  private banner: HTMLElement;
  private waypoint: HTMLElement;
  private wpLabel: HTMLElement;
  private wpDist: HTMLElement;
  private toastTimer = 0;
  private pill: HTMLElement;
  private pillVerb: HTMLElement;
  private pillCount: HTMLElement;
  private pillHoney: SVGRectElement;
  private pillMeniscus: SVGRectElement;
  private lastPill = '';

  constructor() {
    const mk = (id: string, html = '') => {
      const el = document.createElement('div');
      el.id = id;
      el.innerHTML = html;
      document.body.appendChild(el);
      return el;
    };

    this.track = mk('questTrack');
    this.card = mk('questCard');
    this.toast = mk('questToast');

    // THE OBJECTIVE TAG — a honeycomb cell with a pill protruding from it.
    //
    // The tracker in the corner EXPLAINS the task; this answers "what am I
    // doing right now" at a glance while flying at 3.4 m/s, which is a
    // different job and needs a different amount of text. Two or three words,
    // centred where the eye already is.
    //
    // The gauge is the CELL, and it fills with honey rather than sweeping a
    // ring. A ring is every other game's progress indicator; a comb filling up
    // is this one's, it costs the same one number, and it reads at a glance
    // because a half-full cell is a shape and not an arc you have to measure.
    this.pill = document.createElement('div');
    this.pill.id = 'objPill';
    this.pill.innerHTML = `
      <svg class="op-comb" viewBox="-2 -2 37 42" aria-hidden="true">
        <defs>
          <clipPath id="opCombClip"><path d="${CELL}" /></clipPath>
          <linearGradient id="opHoney" gradientUnits="userSpaceOnUse"
                          x1="0" y1="0" x2="0" y2="38">
            <stop offset="0" stop-color="#ffe9a8" />
            <stop offset="1" stop-color="#d99a1f" />
          </linearGradient>
        </defs>
        <path class="op-cell" d="${CELL}" />
        <g clip-path="url(#opCombClip)">
          <rect class="op-honey" x="0" y="38" width="33" height="38" />
          <rect class="op-meniscus" x="0" y="38" width="33" height="1.5" />
        </g>
        <path class="op-rim" d="${CELL}" />
      </svg>
      <div class="op-tag">
        <span class="op-verb"></span>
        <span class="op-count"></span>
      </div>`;
    document.body.appendChild(this.pill);
    this.pillVerb = this.pill.querySelector('.op-verb') as HTMLElement;
    this.pillCount = this.pill.querySelector('.op-count') as HTMLElement;
    this.pillHoney = this.pill.querySelector('.op-honey') as SVGRectElement;
    this.pillMeniscus = this.pill.querySelector('.op-meniscus') as SVGRectElement;
    this.banner = mk('questBanner');
    this.waypoint = mk(
      'waypoint',
      '<span class="wp-pip"></span><span class="wp-label"></span><span class="wp-dist"></span>',
    );
    this.wpLabel = this.waypoint.querySelector('.wp-label') as HTMLElement;
    this.wpDist = this.waypoint.querySelector('.wp-dist') as HTMLElement;
  }

  /** The offer card: shown once, when a quest starts. */
  offer(q: Quest) {
    this.card.innerHTML = `
      <div class="qc-giver">${q.giver} · NEW ORDERS</div>
      <div class="qc-title">${q.title}</div>
      <div class="qc-pitch">${q.pitch}</div>
      <ul class="qc-objs">${q.objectives.map(objectiveRow).join('')}</ul>
      <div class="qc-reward">${q.reward.text}</div>`;
    this.card.classList.remove('show');
    void this.card.offsetWidth; // restart the animation
    this.card.classList.add('show');
    this.tracker(q);
  }

  /** The persistent tracker. Pass null when there's nothing to do. */
  tracker(q: Quest | null) {
    if (!q) {
      this.track.classList.remove('show');
      return;
    }
    this.track.innerHTML = `
      <div class="qt-head">QUEST · ${q.giver}</div>
      <div class="qt-title">${q.title}</div>
      <ul class="qt-objs">${q.objectives.map(objectiveRow).join('')}</ul>
      ${q.hint ? `<div class="qt-hint">${q.hint}</div>` : ''}`;
    this.track.classList.add('show');
  }

  /** "That counted." Deliberately tiny — it fires a lot. */
  progress(o: Objective) {
    this.toast.textContent = o.need > 1
      ? `${o.text} — ${o.have}/${o.need}`
      : `${o.text} ✔`;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    this.toastTimer = 2.2;
  }

  /**
   * A line of world-state, not quest progress. The household's arithmetic is
   * invisible by design — the meter just moves — so the first time each rule
   * fires, say it out loud once and then never again.
   */
  say(text: string, secs = 3.2) {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    this.toastTimer = secs;
  }

  complete(q: Quest) {
    this.banner.innerHTML = `
      <div class="kicker">QUEST COMPLETE</div>
      <div class="name">${q.title}</div>
      <div class="blurb">${q.reward.text}</div>`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  /** Everything finished — say so once, then get out of the way. */
  allDone() {
    this.track.innerHTML = `
      <div class="qt-head">QUEST LOG</div>
      <div class="qt-title">Nothing left to prove</div>
      <div class="qt-hint">The yard is yours. Go break it.</div>`;
    this.track.classList.add('show');
  }

  /**
   * The pill, once a frame.
   *
   * `proximity` is 0..1 and only used when the objective is a single thing to
   * REACH rather than a count to fill. A ring that sits empty until the one
   * moment it fills is a ring doing nothing; on a 90 x 120 m property, "how
   * close am I" is the honest progress for that kind of objective — and it is
   * the closest thing the build has to spatial awareness.
   */
  objective(o: Objective | null, proximity: number) {
    if (!o) {
      this.pill.classList.remove('show');
      this.lastPill = '';
      return;
    }
    const counted = o.need > 1;
    const t = counted ? o.have / o.need : proximity;
    const key = `${o.verb}|${o.have}/${o.need}`;
    if (key !== this.lastPill) {
      this.lastPill = key;
      this.pillVerb.textContent = o.verb;
      this.pillCount.textContent = counted ? `${o.have}/${o.need}` : '';
      // Re-trigger the entrance whenever the objective itself changes, not on
      // every tick of the ring.
      this.pill.classList.remove('show');
      void this.pill.offsetWidth;
    }
    this.pill.classList.add('show');
    // The honey is one rect sliding up behind a hexagonal clip: no per-frame
    // path maths, and the surface line rides with it so it reads as liquid
    // rather than as a bar that happens to be hex-shaped.
    const fill = CELL_H * (1 - Math.max(0, Math.min(1, t)));
    this.pillHoney.setAttribute('y', fill.toFixed(2));
    this.pillMeniscus.setAttribute('y', (fill - 0.75).toFixed(2));
    this.pill.classList.toggle('near', !counted && t > 0.86);
  }

  update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }

  /**
   * Point at the objective. Off-screen and behind-you targets get pinned to
   * the screen edge rather than vanishing, which is the only part of a
   * waypoint that's actually hard.
   */
  marker(
    camera: THREE.Camera,
    point: THREE.Vector3 | null,
    label: string,
    from: THREE.Vector3,
  ) {
    if (!point) {
      this.waypoint.classList.remove('show');
      return;
    }
    const dist = _v.subVectors(point, from).length();
    _v.copy(point).project(camera);
    const behind = _v.z > 1;
    let x = behind ? -_v.x : _v.x;
    let y = behind ? -_v.y : _v.y;

    const edge = 0.88;
    let pinned = behind;
    if (behind) {
      // Projection of a point behind the camera is meaningless in magnitude,
      // so keep only the direction and throw it at the border.
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m;
      y /= m;
    }
    if (Math.abs(x) > edge || Math.abs(y) > edge) {
      const m = Math.max(Math.abs(x), Math.abs(y));
      x = (x / m) * edge;
      y = (y / m) * edge;
      pinned = true;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.waypoint.style.left = `${(x * 0.5 + 0.5) * w}px`;
    this.waypoint.style.top = `${(-y * 0.5 + 0.5) * h}px`;
    this.waypoint.classList.toggle('pinned', pinned);
    this.waypoint.classList.add('show');
    this.wpLabel.textContent = label;
    this.wpDist.textContent = `${Math.round(dist)}`;
  }
}
