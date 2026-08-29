import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';
import {
  M, WALKABLE, WALK_BLOCKERS, WALK_BLOCK_CIRCLES, rectContains, type Rect,
} from './estateWorld';

/** How far to hold him off a building he's walked into. */
const EJECT = M * 0.35;

/**
 * WHO this person is. The state machine below is the same for everyone —
 * what differs is how far they see, how fast they lose their temper, and
 * what seeing a bee with a laser on its back MEANS to them.
 *
 * Every number is a multiplier over `params.human`, so the tuning panel still
 * moves the whole household at once and a profile only says "more than the
 * others" or "less".
 */
export interface HumanProfile {
  id: string;
  /** Shown on the exposure HUD when this person can see you. */
  name: string;
  /** Their job in the household — the cast card's kicker line. */
  role: string;
  /** Their read on the situation, quoted when they clock you. */
  quote: string;
  /** Body height as a fraction of params.human.height. */
  heightScale: number;
  colors: { shirt: number; pants: number; skin: number; shoe: number; hair: number };
  /** Sight range multiplier. */
  sight: number;
  /** Horizontal field-of-view multiplier. */
  fov: number;
  /** Walking speed multiplier. */
  pace: number;
  /** Shorter fuse: scales swat cooldown down and patience with it. */
  nerve: number;
  /** Swat impulse multiplier — how hard being hit hurts. */
  clout: number;
  /**
   * Signed contribution to the household's exposure rise while they can see
   * you. Negative means this person's attention makes you SAFER.
   */
  suspicion: number;
  /** Multiplies the household's total rise while they can see you. <1 = talks everyone down. */
  dampen: number;
  /** How strongly they react to the world behaving impossibly. */
  curiosity: number;
  /** Some people chase; not everyone swings. */
  swats: boolean;
  /** Where they idle, as fractions (0..1) of the walkable rect: x0, x1, z0, z1. */
  home: [number, number, number, number];
}

/** The lone human from M2, unchanged — the baseline every profile scales. */
export const SOLO_PROFILE: HumanProfile = {
  id: 'solo',
  name: 'The Homeowner',
  role: 'THE HOMEOWNER',
  quote: '"...huh."',
  heightScale: 1,
  colors: { shirt: 0xc4552f, pants: 0x3c4a63, skin: 0xd9a06b, shoe: 0x2a2723, hair: 0x3a2a1e },
  sight: 1, fov: 1, pace: 1, nerve: 1, clout: 1,
  suspicion: 1, dampen: 1, curiosity: 1, swats: true,
  home: [0, 1, 0, 1],
};

/** Turn a profile's 0..1 home fractions into a patrol rect in world units. */
export function homeRect(home: [number, number, number, number]): Rect {
  const w = WALKABLE.maxX - WALKABLE.minX;
  const d = WALKABLE.maxZ - WALKABLE.minZ;
  return {
    minX: WALKABLE.minX + home[0] * w,
    maxX: WALKABLE.minX + home[1] * w,
    minZ: WALKABLE.minZ + home[2] * d,
    maxZ: WALKABLE.minZ + home[3] * d,
  };
}

// THE HUMAN — M2's whole point, and the riskiest thing in the design.
//
// At bee scale a person is a hundred units of walking weather. What matters
// isn't that they're big, it's that they're LEGIBLE: you must be able to read
// "unaware / suspicious / coming for me / swinging" at a glance, or trolling
// them isn't a game, it's a lottery.
//
// Perception has three gates — range, field of view, and line of sight — plus
// one gameplay rule that earns the grass its render budget: fly below the
// grass line and you're concealed unless you're right in their face.

export type HumanState = 'idle' | 'suspicious' | 'investigate' | 'swat' | 'recoil';

const ARM_LENGTH = 0.37; // fraction of body height, shoulder to hand
const SHOULDER_OFFSET = 0.19; // fraction of body height, centre to shoulder
const SWING_TIME = 0.28; // seconds of forward whip after the windup

const _toBee = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _hand = new THREE.Vector3();

export class Human {
  readonly root = new THREE.Group();
  state: HumanState = 'idle';
  /** 0..1 — short-term "something's over there", drives the lean/turn. */
  alert = 0;
  /** Set each frame by the swarm: decoy bees are in his face right now. */
  distracted = false;

  private body: RAPIER_API.RigidBody;
  /** Where this person idles when nothing is going on. */
  private patrolArea: Rect;
  private yaw = 0;
  private stateT = 0;
  private swatCooldownT = 0;
  private walkPhase = 0;
  private lastKnown = new THREE.Vector3();
  private patrolTarget = new THREE.Vector3();
  private moveTarget: THREE.Vector3 | null = null;
  private stopDistance = 3;
  private arrived = false;
  private leadShoulder = false;
  private didStrike = false;
  private stungT = 0;
  private soakedT = 0;

  // parts we animate
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private head!: THREE.Mesh;

  /** Fired once per swat that connects. */
  onSwatHit?: (dir: THREE.Vector3, who: Human) => void;
  /** Fired once per swat that misses — still a near-miss shove. */
  onSwatMiss?: (dir: THREE.Vector3, distance: number, who: Human) => void;

  constructor(
    physics: Physics,
    start: THREE.Vector3,
    readonly profile: HumanProfile = SOLO_PROFILE,
  ) {
    this.patrolArea = homeRect(profile.home);
    this.build();
    this.root.position.copy(start);
    this.patrolTarget.copy(start);

    const { RAPIER, world } = physics;
    // Kinematic: driven by the state machine, but still shoves props around
    // and gives the bee something solid to land on, bump into and grapple.
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        start.x, start.y, start.z,
      ),
    );
    const h = this.h;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.16 * h, 0.38 * h, 0.09 * h)
        .setTranslation(0, 0.38 * h, 0),
      this.body,
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.09 * h, 0.08 * h, 0.09 * h)
        .setTranslation(0, 0.84 * h, 0),
      this.body,
    );
  }

  private build() {
    const h = this.h;
    const c = this.profile.colors;
    const denim = new THREE.MeshLambertMaterial({ color: c.pants });
    const shirt = new THREE.MeshLambertMaterial({ color: c.shirt });
    const skin = new THREE.MeshLambertMaterial({ color: c.skin });
    const shoe = new THREE.MeshLambertMaterial({ color: c.shoe });

    const mkLeg = (side: number) => {
      const g = new THREE.Group();
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 * h, 0.42 * h, 0.1 * h), denim,
      );
      leg.position.y = -0.21 * h;
      g.add(leg);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.11 * h, 0.05 * h, 0.18 * h), shoe,
      );
      foot.position.set(0, -0.44 * h, 0.04 * h);
      g.add(foot);
      g.position.set(side * 0.09 * h, 0.44 * h, 0);
      return g;
    };
    // Groups pivot at the hip so rotation.x swings the whole leg.
    const legLG = mkLeg(-1);
    const legRG = mkLeg(1);
    this.root.add(legLG, legRG);
    this.legL = legLG as unknown as THREE.Mesh;
    this.legR = legRG as unknown as THREE.Mesh;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 * h, 0.34 * h, 0.17 * h), shirt,
    );
    torso.position.y = 0.61 * h;
    this.root.add(torso);

    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.17 * h, 0.17 * h, 0.17 * h), skin,
    );
    this.head.position.y = 0.855 * h;
    this.root.add(this.head);
    // A hair cap. From bee altitude you mostly look DOWN at these people, so
    // the top of the head is the one surface that always faces you — it has
    // to be the thing that says which of them is standing under you.
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * h, 0.045 * h, 0.18 * h),
      new THREE.MeshLambertMaterial({ color: c.hair }),
    );
    hair.position.y = 0.945 * h;
    this.root.add(hair);
    // A face, so "which way am I looking" is readable from bee altitude.
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.025 * h, 0.03 * h, 0.01 * h), eyeMat,
      );
      eye.position.set(s * 0.04 * h, 0.87 * h, 0.088 * h);
      this.root.add(eye);
    }

    const mkArm = (side: number) => {
      const g = new THREE.Group();
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(0.075 * h, 0.34 * h, 0.075 * h), shirt,
      );
      upper.position.y = -0.17 * h;
      g.add(upper);
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 * h, 0.1 * h, 0.06 * h), skin,
      );
      hand.position.y = -0.37 * h;
      g.add(hand);
      g.position.set(side * 0.19 * h, 0.75 * h, 0);
      return g;
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    this.root.add(this.armL, this.armR);

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /** This person's height in world units — profile-scaled off the tuned base. */
  private get h(): number {
    return params.human.height * this.profile.heightScale;
  }

  get name(): string {
    return this.profile.name;
  }

  /** So other systems can tell "did I just hit the human?" */
  get bodyHandle(): number {
    return this.body.handle;
  }

  /** World-space eye position — perception rays start here, not at the feet. */
  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.root.position.x,
      this.root.position.y + this.h * 0.855,
      this.root.position.z,
    );
  }

  /** Shoulder joint the swatting arm pivots around. */
  shoulderPosition(out: THREE.Vector3): THREE.Vector3 {
    const h = this.h;
    const rx = Math.cos(this.yaw) * 0.19 * h;
    const rz = -Math.sin(this.yaw) * 0.19 * h;
    return out.set(
      this.root.position.x + rx,
      this.root.position.y + 0.75 * h,
      this.root.position.z + rz,
    );
  }

  /** Where the swatting hand currently is, in world space. */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    const h = this.h;
    this.shoulderPosition(out);
    // Arm hangs down -Y and rotates about local X, in a body-yawed frame.
    const a = this.armR.rotation.x;
    const localY = -Math.cos(a) * ARM_LENGTH * h;
    const localZ = Math.sin(a) * ARM_LENGTH * h;
    out.y += localY;
    out.x += Math.sin(this.yaw) * localZ;
    out.z += Math.cos(this.yaw) * localZ;
    return out;
  }


  canSee(
    physics: Physics,
    beePos: THREE.Vector3,
    beeCollider: RAPIER_API.Collider,
  ): boolean {
    const p = params.human;
    const eye = this.eyePosition(_tmp);
    _toBee.subVectors(beePos, eye);
    const dist = _toBee.length();
    // Being mobbed by decoys shortens how far he can pick YOU out of the
    // noise. This is what makes the beacon a tool rather than decoration.
    const sight = p.sightRange * this.profile.sight;
    const range = this.distracted
      ? sight * params.swarm.distractPerception
      : sight;
    if (dist > range || dist < 0.01) return false;
    _toBee.divideScalar(dist);

    // Grass concealment — the reason the grass isn't just scenery.
    if (beePos.y < p.grassConcealHeight && dist > p.closeSeeRange) return false;

    // FOV is split into yaw and pitch on purpose. Dotting the full 3D
    // direction against a horizontal forward vector makes vertical offset eat
    // the horizontal budget — a person then goes blind to a bee hovering right
    // in front of their chest, which is where bees actually are.
    _fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const flat = Math.hypot(_toBee.x, _toBee.z);
    if (flat > 1e-4) {
      const cosLimit = Math.cos((p.fovDegrees * this.profile.fov * Math.PI) / 360);
      const cosH = (_fwd.x * _toBee.x + _fwd.z * _toBee.z) / flat;
      if (cosH < cosLimit) return false;
    }
    // Steeply overhead or right at their feet is a genuine blind spot.
    const pitch = Math.abs(Math.atan2(_toBee.y, flat));
    if (pitch > (p.fovVerticalDegrees * Math.PI) / 360) return false;

    // Line of sight: anything solid in between blocks (props, fence, the shed).
    const ray = new physics.RAPIER.Ray(
      { x: eye.x, y: eye.y, z: eye.z },
      { x: _toBee.x, y: _toBee.y, z: _toBee.z },
    );
    const hit = physics.world.castRay(
      ray, dist, true, undefined, undefined, undefined, this.body,
    );
    if (hit && hit.collider.handle !== beeCollider.handle && hit.timeOfImpact < dist - 1) {
      return false;
    }
    return true;
  }

  update(
    dt: number,
    physics: Physics,
    beePos: THREE.Vector3,
    beeCollider: RAPIER_API.Collider,
    rand: () => number,
  ): { seen: boolean } {
    const p = params.human;
    const seen = this.canSee(physics, beePos, beeCollider);
    if (seen) this.lastKnown.copy(beePos);

    this.stateT += dt;
    this.swatCooldownT = Math.max(0, this.swatCooldownT - dt);
    this.alert += ((seen ? 1 : 0) - this.alert) * (1 - Math.exp(-4 * dt));

    switch (this.state) {
      case 'idle': {
        this.moveTarget = this.patrolTarget;
        this.stopDistance = 3;
        this.leadShoulder = false;
        if (this.root.position.distanceTo(this.patrolTarget) < 6 || this.stateT > 9) {
          // Wander the whole property, not a circle around the middle: a
          // person who only ever paces the centre of the lawn stops being a
          // hazard the moment you learn the pattern.
          const area = this.patrolArea;
          for (let i = 0; i < 8; i++) {
            const x = area.minX + rand() * (area.maxX - area.minX);
            const z = area.minZ + rand() * (area.maxZ - area.minZ);
            if (WALK_BLOCKERS.some((b) => rectContains(b, x, z, M * 0.2))) continue;
            if (WALK_BLOCK_CIRCLES.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + M * 0.2)) {
              continue;
            }
            this.patrolTarget.set(x, 0, z);
            break;
          }
          this.stateT = 0;
        }
        if (seen) this.setState('suspicious');
        break;
      }
      case 'suspicious': {
        this.moveTarget = null; // stop and stare
        this.leadShoulder = false;
        this.faceToward(this.lastKnown, dt, p.turnSpeed * 1.6);
        const n = this.profile.nerve;
        if (!seen && this.stateT > 1.4 / n) this.setState('idle');
        else if (seen && this.stateT > 0.55 / n) this.setState('investigate');
        break;
      }
      case 'investigate': {
        this.moveTarget = this.lastKnown;
        this.leadShoulder = true;
        // Close to the distance that puts the bee ON the hand's sweep sphere,
        // which depends on how high it's flying. A fixed standoff leaves low
        // bees permanently out of reach and high ones overshot.
        const armLen = ARM_LENGTH * this.h;
        const shoulderY = this.root.position.y + 0.75 * this.h;
        const dv = Math.abs(this.lastKnown.y - shoulderY);
        const ideal = dv >= armLen ? 4 : Math.sqrt(armLen * armLen - dv * dv) * 0.95;
        // ...but never so close that the bee falls into his own vertical blind
        // spot, or he walks up, loses sight of it, and wanders off.
        this.stopDistance = Math.max(ideal, dv * 0.4);
        // The hand sweeps a circle of radius ARM_LENGTH around the shoulder,
        // so the bee is swattable when it sits NEAR THAT CIRCLE — not merely
        // close. Walking right up to a bee puts it inside the arc, where the
        // hand overshoots it entirely.
        // Tolerance is deliberately tighter than swatRange. At the full width
        // the condition is already true from way out, so he re-triggers a swat
        // before taking a step and flails at empty air forever.
        const reachDist = this.shoulderPosition(_tmp).distanceTo(beePos);
        const canConnect = Math.abs(reachDist - armLen) < p.swatRange * 0.55;
        // If he's already as close as he's going to get, let him take the
        // hopeless swipe anyway. A near miss is a thrill; being ignored isn't.
        // Kept tight — swinging at a bee an arm's length beyond reach reads as
        // frustration, swinging at one across the yard reads as broken.
        const desperate = this.arrived && reachDist < armLen + p.swatHitRadius;
        // Not everyone swings. A child who has found a bee with a laser on
        // its back CHASES it, which is a different kind of pressure: harmless,
        // relentless, and impossible to lose in the grass.
        if (seen && this.profile.swats && (canConnect || desperate)
            && this.swatCooldownT <= 0) {
          this.setState('swat');
        } else if (!seen && this.stateT > p.investigateTime * this.profile.nerve) {
          this.setState('idle');
        }
        break;
      }
      case 'swat': {
        this.moveTarget = null;
        this.leadShoulder = true;
        this.faceToward(this.lastKnown, dt, p.turnSpeed * 2.2);
        // The hand sweeps an arc, so test it CONTINUOUSLY rather than at one
        // chosen instant. A fixed strike frame only ever connects with bees at
        // whatever height the arm happens to be passing then — it whiffed
        // every bee at head height while swiping at ankle level.
        if (!this.didStrike && this.stateT >= p.swatWindup) {
          if (this.handPosition(_hand).distanceTo(beePos) <= p.swatHitRadius) {
            this.didStrike = true;
            this.resolveStrike(beePos, true);
          }
        }
        if (this.stateT > p.swatWindup + SWING_TIME) {
          if (!this.didStrike) {
            this.didStrike = true;
            this.resolveStrike(beePos, false);
          }
          this.swatCooldownT = p.swatCooldown / this.profile.nerve;
          this.setState('recoil');
        }
        break;
      }
      case 'recoil': {
        this.moveTarget = null;
        if (this.stateT > 0.45) {
          this.setState(seen ? 'investigate' : 'idle');
        }
        break;
      }
    }

    this.move(dt);
    // Every frame, not just while walking. Clamping inside move() meant a
    // human who stopped — or got shoved by a sting — could stand inside the
    // deck indefinitely, because the code that pushes him out never ran.
    this.clampToYard();
    this.animate(dt);
    this.syncBody();
    return { seen };
  }

  /**
   * Something in the yard is doing something it shouldn't. Go look at it.
   * Chains only land if the human ACTS on evidence — a rising meter isn't a
   * reaction, it's a number.
   */
  investigateEvidence(at: THREE.Vector3) {
    if (this.state === 'swat' || this.stungT > 0) return;
    // Being drawn off by an appliance while hunting the bee is the point:
    // it's how a hack becomes a distraction rather than just noise.
    this.lastKnown.copy(at);
    this.alert = Math.max(this.alert, 0.7);
    if (this.state !== 'investigate') this.setState('investigate');
  }

  /** Walked into the sprinkler. Recoil, and remember being annoyed. */
  getSoaked() {
    if (this.soakedT > 0) return false;
    this.soakedT = 1.4;
    this.alert = 1;
    this.setState('recoil');
    return true;
  }

  get isSoaked(): boolean {
    return this.soakedT > 0;
  }

  /** Got stung. Flinch hard, then come back angry and swinging without delay. */
  reactToSting() {
    this.swatCooldownT = 0;
    this.alert = 1;
    this.stungT = params.stinger.flinchTime;
    // Stagger back a step — a hundred units of person recoiling is the only
    // read the player gets from bee altitude, so make it big.
    const back = M * 0.35 * this.profile.heightScale;
    this.root.position.x -= Math.sin(this.yaw) * back;
    this.root.position.z -= Math.cos(this.yaw) * back;
    this.clampToYard();
    this.setState('recoil');
  }

  /**
   * Shove out of someone else's personal space. Four people sharing one small
   * yard will otherwise converge on the same bee and stand inside each other,
   * which reads as one flickering four-armed person.
   */
  nudge(dx: number, dz: number) {
    this.root.position.x += dx;
    this.root.position.z += dz;
    this.clampToYard();
    this.syncBody();
  }

  /** Radius of that personal space — bigger people need more of it. */
  get personalSpace(): number {
    return M * 0.34 * this.profile.heightScale;
  }

  private setState(s: HumanState) {
    this.state = s;
    this.stateT = 0;
    if (s === 'swat') this.didStrike = false;
  }

  private resolveStrike(beePos: THREE.Vector3, connected: boolean) {
    const hand = this.handPosition(new THREE.Vector3());
    const dir = new THREE.Vector3().subVectors(beePos, hand);
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.divideScalar(dist);
    dir.y = Math.max(dir.y, 0.35); // always some launch, never straight down
    dir.normalize();

    if (connected) this.onSwatHit?.(dir, this);
    else this.onSwatMiss?.(dir, dist, this);
  }

  private faceToward(target: THREE.Vector3, dt: number, speed: number) {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    let want = Math.atan2(dx, dz);

    // People turn side-on to swat. The arm sweeps in a plane through the
    // shoulder, which sits well off the body's centre line — squared up, that
    // plane misses the target by the whole shoulder offset.
    if (this.leadShoulder) {
      const s = SHOULDER_OFFSET * this.h;
      const horiz = Math.hypot(dx, dz);
      want -= horiz > s ? Math.asin(s / horiz) : Math.PI / 2;
    }

    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-speed * dt));
  }

  private move(dt: number) {
    const p = params.human;
    if (!this.moveTarget) {
      this.walkPhase *= 1 - (1 - Math.exp(-6 * dt));
      return;
    }
    const dx = this.moveTarget.x - this.root.position.x;
    const dz = this.moveTarget.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    this.arrived = dist < this.stopDistance;
    if (this.arrived) {
      this.faceToward(this.moveTarget, dt, p.turnSpeed);
      this.walkPhase *= 1 - (1 - Math.exp(-6 * dt));
      return;
    }

    this.faceToward(this.moveTarget, dt, p.turnSpeed);
    const step = Math.min(p.walkSpeed * this.profile.pace * dt, dist);
    this.root.position.x += (dx / dist) * step;
    this.root.position.z += (dz / dist) * step;
    this.walkPhase += (step / 14) * Math.PI;
  }

  /**
   * A kinematic body isn't stopped by static geometry, so he'd stroll straight
   * through the fence — and through the shed. Keep him on the property by
   * hand, and push him out of anything solid he's standing in.
   */
  private clampToYard() {
    const pos = this.root.position;
    pos.x = Math.min(WALKABLE.maxX, Math.max(WALKABLE.minX, pos.x));
    pos.z = Math.min(WALKABLE.maxZ, Math.max(WALKABLE.minZ, pos.z));

    for (const b of WALK_BLOCKERS) {
      if (!rectContains(b, pos.x, pos.z, EJECT)) continue;
      // Eject along whichever face is nearest — cheapest correct way out of
      // a box, and it never teleports him across the building.
      const outs = [
        { d: pos.x - (b.minX - EJECT), set: () => (pos.x = b.minX - EJECT) },
        { d: (b.maxX + EJECT) - pos.x, set: () => (pos.x = b.maxX + EJECT) },
        { d: pos.z - (b.minZ - EJECT), set: () => (pos.z = b.minZ - EJECT) },
        { d: (b.maxZ + EJECT) - pos.z, set: () => (pos.z = b.maxZ + EJECT) },
      ];
      outs.sort((a, c) => a.d - c.d)[0].set();
    }

    // Round obstacles: push straight out along the radius.
    for (const [cx, cz, r] of WALK_BLOCK_CIRCLES) {
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      const want = r + EJECT;
      if (d >= want) continue;
      if (d < 1e-3) {
        pos.x = cx + want;
        continue;
      }
      pos.x = cx + (dx / d) * want;
      pos.z = cz + (dz / d) * want;
    }
  }

  private animate(dt: number) {
    const p = params.human;
    this.stungT = Math.max(0, this.stungT - dt);

    // Stung: both arms fly up and he rocks back. Unmistakable from any range,
    // which matters because a subtle reaction on a 100-unit body reads as
    // nothing at all from bee altitude.
    if (this.stungT > 0) {
      const f = this.stungT / params.stinger.flinchTime;
      const flail = Math.sin(this.stungT * 46) * 0.5 * f;
      this.armL.rotation.x = -2.4 * f + flail;
      this.armR.rotation.x = -2.4 * f - flail;
      this.legL.rotation.x = 0.3 * f;
      this.legR.rotation.x = -0.3 * f;
      this.root.rotation.y = this.yaw;
      this.head.rotation.x = 0.5 * f;
      return;
    }

    // Soaked: hunched, arms tucked in, shuffling. Different silhouette from
    // the sting flail so you can tell WHICH thing you did to him.
    if (this.soakedT > 0) {
      this.soakedT = Math.max(0, this.soakedT - dt);
      const f = this.soakedT / 1.4;
      const shiver = Math.sin(this.soakedT * 30) * 0.12 * f;
      this.armL.rotation.x = -0.9 * f + shiver;
      this.armR.rotation.x = -0.9 * f - shiver;
      this.head.rotation.x = 0.35 * f;
      this.root.rotation.y = this.yaw;
      this.legL.rotation.x = 0.15 * f;
      this.legR.rotation.x = -0.15 * f;
      return;
    }

    const swing = Math.sin(this.walkPhase) * 0.55;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.root.rotation.y = this.yaw;

    // Idle arms counter-swing; the swat overrides the right arm entirely.
    this.armL.rotation.x = -swing * 0.5;

    if (this.state === 'swat') {
      // Same phase boundaries the strike uses, so what you see is what hits.
      if (this.stateT < p.swatWindup) {
        const t = this.stateT / p.swatWindup;
        this.armR.rotation.x = THREE.MathUtils.lerp(0, -2.1, t);
      } else {
        const t = THREE.MathUtils.clamp((this.stateT - p.swatWindup) / SWING_TIME, 0, 1);
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.1, 1.5, t);
      }
    } else if (this.state === 'recoil') {
      this.armR.rotation.x += (0 - this.armR.rotation.x) * (1 - Math.exp(-8 * dt));
    } else {
      this.armR.rotation.x += (swing * 0.5 - this.armR.rotation.x) * (1 - Math.exp(-8 * dt));
    }

    // Lean in when alert — readable "I'm onto you" posture from any distance.
    this.head.rotation.x = -this.alert * 0.28;
  }

  private syncBody() {
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), this.yaw,
    );
    this.body.setNextKinematicTranslation({
      x: this.root.position.x,
      y: this.root.position.y,
      z: this.root.position.z,
    });
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
}
