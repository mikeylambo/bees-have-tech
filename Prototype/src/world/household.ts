import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { mulberry32 } from '../core/rng';
import { params } from '../core/tuning';
import { Human, homeRect, type HumanProfile } from './human';
import { M } from './estateWorld';

// THE HOUSEHOLD — M8.
//
// One human made exposure a meter. Four make it a SOCIAL PROBLEM, which is
// the joke the whole game is built on: the bee isn't hiding from a camera,
// it's hiding from a family that can't agree on what it just saw.
//
// The state machine is identical for everyone. What differs is what seeing a
// bee with a laser on its back MEANS to them, and those meanings add up with
// a sign:
//
//   Dale  — believes the evidence, goes and looks at it, tells everyone.
//   Marla — doesn't need evidence, is already swinging.
//   Robin — a kid who has found the coolest thing alive and is COVERING for
//           it. While Robin is the one watching you, exposure FALLS.
//   Ned   — has seen a lot of bees. While Ned is watching, everyone else's
//           certainty gets multiplied down.
//
// That turns "don't be seen" into "be seen by the right person", which is a
// far better game than a stealth cone.
//
// M9 gave each of them a TERRITORY, and put it on top of a salvage site.
// Nobody patrols 10,800 m2, and a person you can trivially avoid is scenery.
// So: Dale keeps the service yard where the batteries are, Marla owns the
// pool terrace and the appliances, Robin lives at the playground where the
// screws are, and Ned sits at the fire pit next to the bottle caps. Every
// errand the hive gives you is therefore an errand into somebody's patch —
// and WHOSE decides what it costs you.

/** What the household collectively made of this frame. */
export interface HouseholdSense {
  /** Did anybody at all clock the bee? */
  seen: boolean;
  /** Who — in the order they appear in the yard, for the HUD. */
  seenBy: Human[];
  /** Signed sum of watchers' suspicion. Negative means you're getting SAFER. */
  suspicion: number;
  /** Smallest dampen among watchers — the calmest voice in the room wins. */
  dampen: number;
}

export const HOUSEHOLD: HumanProfile[] = [
  {
    id: 'handy',
    name: 'Dale',
    quote: '"that is not stock bee hardware"',
    heightScale: 1.06,
    colors: {
      shirt: 0x4b7f6a, pants: 0x6b5844, skin: 0xd9a06b, shoe: 0x3b2f26, hair: 0x4a3626,
    },
    // Sees further because he's the one actually LOOKING at the yard, and
    // reacts hardest to a thing that shouldn't be running by itself.
    sight: 1.15, fov: 1.0, pace: 1.0, nerve: 1.0, clout: 1.0,
    suspicion: 1.0, dampen: 1, curiosity: 1.9, swats: true,
    // The service yard and garage — bins, compost, and every battery.
    home: [0.03, 0.21, 0.64, 0.78],
  },
  {
    id: 'fuse',
    name: 'Marla',
    quote: '"I have had ENOUGH of this bee"',
    heightScale: 0.99,
    colors: {
      shirt: 0xc4552f, pants: 0x3c4a63, skin: 0xe0ad7d, shoe: 0x2a2723, hair: 0x1f1a16,
    },
    // Escalates fastest, hits hardest, and doesn't need a second look.
    sight: 1.0, fov: 1.1, pace: 1.25, nerve: 1.8, clout: 1.35,
    suspicion: 1.7, dampen: 1, curiosity: 1.0, swats: true,
    // The pool terrace and the cabana: the caps, and all three appliances.
    home: [0.62, 0.90, 0.46, 0.66],
  },
  {
    id: 'kid',
    name: 'Robin',
    quote: '"nobody look over here"',
    heightScale: 0.62,
    colors: {
      shirt: 0xf0c53f, pants: 0x2f6fb0, skin: 0xe8bb8c, shoe: 0xd8d3c8, hair: 0x8a5a2b,
    },
    // Notices everything, chases, never swings — and actively runs cover.
    sight: 1.3, fov: 1.15, pace: 1.15, nerve: 0.6, clout: 0.5,
    suspicion: -1.2, dampen: 1, curiosity: 0.7, swats: false,
    // The playground and the east lawn. The screws are here, and so is the
    // one person on the property who is pleased to see you.
    home: [0.64, 0.94, 0.13, 0.36],
  },
  {
    id: 'skeptic',
    name: 'Ned',
    quote: '"it is a bee, Marla"',
    heightScale: 0.94,
    colors: {
      shirt: 0xbfc3c0, pants: 0x565b62, skin: 0xcf9d72, shoe: 0x39332c, hair: 0xcfcac0,
    },
    // Barely moves, barely looks, and talks the whole yard back down.
    sight: 0.7, fov: 0.85, pace: 0.55, nerve: 0.5, clout: 0.8,
    suspicion: 0.3, dampen: 0.4, curiosity: 0.35, swats: true,
    // The fire pit, 30 m from the gate — the first salvage a new bee reaches
    // is guarded by the one person least inclined to believe his own eyes.
    home: [0.12, 0.34, 0.18, 0.36],
  },
];

const _sep = new THREE.Vector3();

export class Household {
  readonly group = new THREE.Group();
  readonly members: Human[] = [];
  private rands: Array<() => number> = [];
  private handles = new Map<number, Human>();

  /** Someone connected. `who` is the person whose hand it was. */
  onSwatHit?: (dir: THREE.Vector3, who: Human) => void;
  /** Someone missed. */
  onSwatMiss?: (dir: THREE.Vector3, distance: number, who: Human) => void;

  constructor(physics: Physics, seed: number) {
    HOUSEHOLD.forEach((profile, i) => {
      const area = homeRect(profile.home);
      const start = new THREE.Vector3(
        (area.minX + area.maxX) / 2, 0, (area.minZ + area.maxZ) / 2,
      );
      const h = new Human(physics, start, profile);
      h.onSwatHit = (dir, who) => this.onSwatHit?.(dir, who);
      h.onSwatMiss = (dir, d, who) => this.onSwatMiss?.(dir, d, who);
      this.members.push(h);
      this.group.add(h.root);
      this.handles.set(h.bodyHandle, h);
      // Separate streams, so adding a person doesn't reshuffle everyone
      // else's patrol — the yard would otherwise change character wholesale
      // every time this list is edited.
      this.rands.push(mulberry32(seed ^ (0x9e3779b9 * (i + 1))));
    });
  }

  /** Every body handle in the household — for "did my stinger hit a person?" */
  get bodyHandles(): number[] {
    return this.members.map((m) => m.bodyHandle);
  }

  memberByHandle(handle: number): Human | null {
    return this.handles.get(handle) ?? null;
  }

  /** The person most worth pointing a camera, a decoy swarm or a HUD at. */
  focus(): Human {
    let best = this.members[0];
    for (const m of this.members) {
      if (m.alert > best.alert) best = m;
    }
    return best;
  }

  nearest(to: THREE.Vector3): Human {
    let best = this.members[0];
    let bd = Infinity;
    for (const m of this.members) {
      const d = m.root.position.distanceToSquared(to);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  update(
    dt: number,
    physics: Physics,
    beePos: THREE.Vector3,
    beeCollider: RAPIER_API.Collider,
  ): HouseholdSense {
    const seenBy: Human[] = [];
    let suspicion = 0;
    let dampen = 1;

    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      const { seen } = m.update(dt, physics, beePos, beeCollider, this.rands[i]);
      if (!seen) continue;
      seenBy.push(m);
      suspicion += m.profile.suspicion;
      dampen = Math.min(dampen, m.profile.dampen);
    }

    this.separate();
    return { seen: seenBy.length > 0, seenBy, suspicion, dampen };
  }

  /**
   * Keep people out of each other. They all chase the same bee, so without
   * this they converge to one point and read as a single flickering person
   * with eight arms.
   */
  private separate() {
    for (let i = 0; i < this.members.length; i++) {
      for (let j = i + 1; j < this.members.length; j++) {
        const a = this.members[i];
        const b = this.members[j];
        const want = a.personalSpace + b.personalSpace;
        _sep.subVectors(b.root.position, a.root.position);
        _sep.y = 0;
        const d = _sep.length();
        if (d >= want) continue;
        // Degenerate case: exactly on top of each other. Pick an axis rather
        // than dividing by zero and launching them both to NaN.
        if (d < 1e-4) _sep.set(1, 0, 0);
        else _sep.divideScalar(d);
        const push = (want - d) * 0.5;
        a.nudge(-_sep.x * push, -_sep.z * push);
        b.nudge(_sep.x * push, _sep.z * push);
      }
    }
  }

  /**
   * Mark whoever the decoy swarm is currently in the face of. Distraction is
   * positional, not global: mobbing Marla shouldn't blind Dale on the far
   * side of the yard.
   */
  setDistractedNear(at: THREE.Vector3 | null, radius = M * 1.3) {
    for (const m of this.members) {
      m.distracted = at !== null && m.root.position.distanceTo(at) < radius;
    }
  }

  /**
   * Something in the yard is behaving impossibly. Returns how incriminating
   * that is *to the people who can actually see it* — an appliance running
   * itself in front of Dale is a story; in front of Ned it's a draught.
   */
  witnessEvidence(
    physics: Physics,
    at: THREE.Vector3,
    beeCollider: RAPIER_API.Collider,
    beeSeen: boolean,
  ): number {
    let worst = 0;
    let investigator: Human | null = null;
    for (const m of this.members) {
      if (!m.canSee(physics, at, beeCollider)) continue;
      const c = m.profile.curiosity;
      // The Kid seeing the toaster fly is not evidence, it's Tuesday.
      const weight = m.profile.suspicion < 0 ? 0 : c;
      if (weight > worst) { worst = weight; investigator = m; }
    }
    // Only the most curious witness walks over: a household that all converges
    // on one appliance leaves the rest of the yard unwatched, which makes
    // hacking strictly better than not hacking.
    if (investigator && !beeSeen) investigator.investigateEvidence(at);
    return worst;
  }

  /** Anyone standing in the water gets soaked. Returns how many just did. */
  soakThoseIn(wets: (p: THREE.Vector3) => boolean): number {
    let n = 0;
    for (const m of this.members) {
      if (wets(m.root.position) && m.getSoaked()) n++;
    }
    return n;
  }

  /** Everyone in earshot looks over. Used when the bee does something loud. */
  alertAll(at: THREE.Vector3, radius = params.human.sightRange * 1.6) {
    for (const m of this.members) {
      if (m.root.position.distanceTo(at) < radius) m.investigateEvidence(at);
    }
  }
}
