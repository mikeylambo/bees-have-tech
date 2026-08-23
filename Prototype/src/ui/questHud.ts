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
