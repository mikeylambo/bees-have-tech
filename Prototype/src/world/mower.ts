import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';
import type { Appliance, ApplianceKind } from './appliances';
import { M, cutGrass, zone, zoneRect, rectContains, type Rect } from './estateWorld';

// THE MOWER — the first thing on this property that hunts you.
//
// Straight off the pillars' scale-inversion table: "lawn mower → roaming
// world boss". Until now the only pressure in the game was two adults with
// seven metres of eyesight on ten thousand square metres, which meant long
// stretches of no danger at all. A machine that roams changes the character
// of the open ground without adding a single new object to it.
//
// It is a ROBOT mower, and that is a design choice rather than a detail:
//   · it roams on its own, so the threat exists whether or not a human does
//   · bump-and-turn is honest AI for it rather than a simplification
//   · and nobody has to animate a person pushing a thing for 90 metres
//
// It obeys the M3 rule that every hackable object exposes exactly ONE verb —
// on or off. All the depth is in the overlap: a mower you switch ON near
// Marla is a joke, a mower you switch OFF to cross the east lawn is a tactic,
// and a mower running with nobody near it is the most incriminating thing on
// the property. Dale's 1.9x curiosity was built for exactly this.

const m = (metres: number) => metres * M;

/** Deck half-extents, metres. A robot mower is about 70 x 55 cm. */
const DECK_W = 0.35;
const DECK_D = 0.28;
const DECK_H = 0.24;

/** Blade disc. Wider than the bee is long by a factor of about twenty. */
const CUT_RADIUS = m(0.3);
/**
 * The danger band. Deliberately WIDER than the deck (0.35 x 0.28 m half
 * extents): at 0.42 m the strike zone barely cleared the collider, so in
 * practice you bumped into the machine and were never caught by it — a hazard
 * you can only trigger from inside a solid object is not a hazard. At 0.6 m
 * there is a real skirt of danger around it, which is where the blades are.
 */
const HAZARD = m(0.6);

const _v = new THREE.Vector3();
const _away = new THREE.Vector3();
const _p = new THREE.Vector3();

/** The panels it is allowed to work. Anything else is somebody's flowerbed. */
const LAWN_IDS = ['lawn-west', 'lawn-east', 'meadow'];

export class Mower implements Appliance {
  // Reported as a fan to the hacker and the quest log: `ApplianceKind` is the
  // hackable-object vocabulary and widening it would touch the quest schema,
  // the HUD and the save format for one string. The label is what a player
  // ever sees.
  kind: ApplianceKind = 'fan';
  label = 'Robot Mower';
  readonly position = new THREE.Vector3();
  colliderHandle = -1;

  /**
   * It runs on a duty cycle, because a hazard that only exists when the
   * player switches it on is a toy, not weather. The property has to have
   * something happening on it whether you are involved or not.
   */
  private scheduled = false;
  /** The player overrode the schedule. Flipped by the one verb. */
  private hacked = false;
  private dutyT = 0;

  /**
   * Running is the schedule XOR the override, which makes the single verb
   * mean "not what it was about to do" rather than "on".
   */
  get on(): boolean {
    return this.scheduled !== this.hacked;
  }

  /** Fired when the duty cycle wakes it up by itself. */
  onWake?: () => void;

  readonly group = new THREE.Group();
  /** Radians. Where it is pointed, which is also where it will go. */
  private heading = Math.PI * 0.25;
  private body: RAPIER_API.RigidBody;
  private blades!: THREE.Mesh;
  private bladeSpin = 0;
  private lawns: Rect[];
  private stuckT = 0;

  /** Fired when the blades take something down that was still standing. */
  onCut?: (x: number, z: number) => void;
  /** Fired when it throws the bee. */
  onStrikeBee?: (dir: THREE.Vector3) => void;

  constructor(physics: Physics, start: THREE.Vector3) {
    this.lawns = LAWN_IDS.map((id) => zoneRect(zone(id), -m(1.2)));
    this.build();
    this.position.copy(start);
    this.group.position.copy(start);

    const { RAPIER, world } = physics;
    // Docked clear of the corners on purpose. Bump-and-turn handles an edge
    // fine, but a machine that starts wedged in one spends its first ten
    // seconds spinning, which reads as broken rather than as weather.
    // Kinematic, like the household: it is driven by its own logic but still
    // shoves props and gives the bee something solid to bounce off.
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(start.x, start.y, start.z),
    );
    const c = world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(DECK_W), m(DECK_H) / 2, m(DECK_D))
        .setTranslation(0, m(DECK_H) / 2, 0),
      this.body,
    );
    this.colliderHandle = c.handle;
  }

  private build() {
    const shell = new THREE.MeshLambertMaterial({ color: 0x2f3a34 });
    const trim = new THREE.MeshLambertMaterial({ color: 0xd8683a });
    const metal = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    const eye = new THREE.MeshLambertMaterial({ color: 0x63ffa8 });

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(m(DECK_W * 2), m(DECK_H), m(DECK_D * 2)), shell,
    );
    deck.position.y = m(DECK_H) / 2;
    deck.castShadow = true;
    this.group.add(deck);

    // A wedge at the front, so which way it is pointed reads from above —
    // which is the only angle a bee ever has on it.
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(m(DECK_W * 1.5), m(DECK_H * 0.6), m(DECK_D * 0.5)), trim,
    );
    nose.position.set(0, m(DECK_H * 0.75), m(DECK_D * 0.8));
    nose.castShadow = true;
    this.group.add(nose);

    // The status lamp. Green while it is working, and visible a long way off:
    // "is the mower on" is a question you want answered from altitude.
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(m(0.05), 8, 6), eye);
    lamp.position.set(0, m(DECK_H * 1.2), 0);
    this.group.add(lamp);

    for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(m(0.09), m(0.09), m(0.06), 10), metal,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(s * m(DECK_W), m(0.09), -m(DECK_D * 0.55));
      this.group.add(wheel);
    }

    // The business end: a disc under the deck, spun while running. It never
    // gets a collider — the deck is what you bump into, and a spinning mesh
    // collider would be a physics problem in exchange for nothing.
    this.blades = new THREE.Mesh(
      new THREE.BoxGeometry(CUT_RADIUS * 2, m(0.012), m(0.05)),
      new THREE.MeshLambertMaterial({ color: 0xb9c0c4 }),
    );
    this.blades.position.y = m(0.05);
    this.group.add(this.blades);
  }

  get bodyHandle(): number {
    return this.body.handle;
  }

  /** The one verb. */
  toggle() {
    this.hacked = !this.hacked;
    this.stuckT = 0;
  }

  /**
   * A mower crossing a lawn at its usual hour is not evidence — it is a
   * Tuesday, and if it were, the exposure meter would climb while the player
   * did nothing at all, which would quietly make the whole ladder meaningless.
   *
   * A mower running because a BEE turned it on is the most incriminating
   * thing on the property. So conspicuous is exactly the override — which
   * also makes hacking it a real decision instead of a free toy.
   */
  get conspicuous(): boolean {
    return this.hacked;
  }

  /** For the HUD and the tests: is it doing this on its own? */
  get onSchedule(): boolean {
    return this.scheduled;
  }

  private inLawn(x: number, z: number): boolean {
    return this.lawns.some((r) => rectContains(r, x, z));
  }

  update(dt: number) {
    // Duty cycle. The override does not survive the schedule changing under
    // it — otherwise one hack sticks for the rest of the run and the machine
    // stops being weather.
    this.dutyT += dt;
    const span = this.scheduled ? params.mower.dutyOn : params.mower.dutyOff;
    if (this.dutyT >= span) {
      this.dutyT = 0;
      this.scheduled = !this.scheduled;
      this.hacked = false;
      if (this.scheduled) this.onWake?.();
    }

    if (this.on) {
      this.bladeSpin += dt * 46;
      this.blades.rotation.y = this.bladeSpin;
      this.drive(dt);
    }
    // The lamp is the readout, so it has to die with the machine.
    this.group.visible = true;
    (this.group.children[2] as THREE.Mesh).visible = this.on;
  }

  private drive(dt: number) {
    const speed = params.mower.speed;
    const step = speed * dt;
    const nx = this.position.x + Math.sin(this.heading) * step;
    const nz = this.position.z + Math.cos(this.heading) * step;

    if (this.inLawn(nx, nz)) {
      this.position.set(nx, this.position.y, nz);
      this.stuckT = 0;
    } else {
      // Bump and turn. Deliberately not a clean reflection: a mower that
      // bounces perfectly off an edge traces the same path forever, and the
      // whole point is that you cannot learn where it will be.
      this.heading += Math.PI * (0.55 + (this.stuckT % 0.37));
      this.stuckT += dt;
      // Cornered badly enough to be spinning on the spot — walk it back to the
      // middle of the nearest panel rather than leaving a boss stuck in a hedge.
      if (this.stuckT > 1.4) {
        const r = this.lawns[0];
        this.heading = Math.atan2(
          (r.minX + r.maxX) / 2 - this.position.x,
          (r.minZ + r.maxZ) / 2 - this.position.z,
        );
        this.stuckT = 0;
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
    this.body.setNextKinematicTranslation({
      x: this.position.x, y: this.position.y, z: this.position.z,
    });
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), this.heading,
    );
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    // Take the grass down. Only reports a cut when something was actually
    // still standing, so the grass field is not asked to re-scatter a tile
    // the mower is merely driving back across.
    if (cutGrass(this.position.x, this.position.z, CUT_RADIUS)) {
      this.onCut?.(this.position.x, this.position.z);
    }
  }

  /** Throw anything loose that the deck runs over. */
  punt(bodies: RAPIER_API.RigidBody[]) {
    if (!this.on) return;
    const reach = HAZARD * 1.2;
    for (const b of bodies) {
      const t = b.translation();
      const dx = t.x - this.position.x;
      const dz = t.z - this.position.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (t.y > this.position.y + m(0.5)) continue; // it only hits what it can reach
      const im = params.mower.puntImpulse * Math.min(b.mass(), 1);
      _away.set(dx, 0, dz);
      if (_away.lengthSq() < 1e-6) _away.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      _away.normalize();
      // Upward, hard. A mower does not nudge things; it launches them.
      b.applyImpulse(
        { x: _away.x * im, y: params.mower.puntImpulse * 0.7 * Math.min(b.mass(), 1), z: _away.z * im },
        true,
      );
    }
  }

  /**
   * Is the bee in the blades? Returns the direction to throw it, or null.
   * The caller owns the consequences — this only answers the question.
   */
  strikes(beePos: THREE.Vector3): THREE.Vector3 | null {
    if (!this.on) return null;
    _v.subVectors(beePos, this.position);
    if (Math.abs(_v.y - m(0.1)) > m(0.3)) return null; // fly over it and you're fine
    _v.y = 0;
    if (_v.lengthSq() > HAZARD * HAZARD) return null;
    if (_v.lengthSq() < 1e-6) _v.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    _v.normalize();
    _v.y = 0.8; // mostly up: being flung skyward is survivable and funny
    // CLONED, not the shared temp. Returning `_v` meant a caller who held the
    // result watched it change under them on the next call — fine for the
    // frame loop, which uses it immediately, and a trap for everyone else.
    // A strike happens at most once a second and a half; the allocation is
    // not the thing to economise on.
    return _v.clone().normalize();
  }

  /** Where a curious human should walk to. */
  lookAt(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.position).setY(m(0.2));
  }

  /** Park it back where it started — New Game and the quest reset both want this. */
  reset(to: THREE.Vector3) {
    this.scheduled = false;
    this.hacked = false;
    this.dutyT = 0;
    this.position.copy(to);
    this.group.position.copy(to);
    this.body.setNextKinematicTranslation({ x: to.x, y: to.y, z: to.z });
    void _p;
  }
}
