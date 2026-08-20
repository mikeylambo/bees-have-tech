import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';

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

  private body: RAPIER_API.RigidBody;
  private yaw = 0;
  private stateT = 0;
  private swatCooldownT = 0;
  private walkPhase = 0;
  private lastKnown = new THREE.Vector3();
  private patrolTarget = new THREE.Vector3();
  private moveTarget: THREE.Vector3 | null = null;
  private stopDistance = 3;
  private arrived = false;
  private didStrike = false;

  // parts we animate
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private head!: THREE.Mesh;

  /** Fired once per swat that connects. */
  onSwatHit?: (dir: THREE.Vector3) => void;
  /** Fired once per swat that misses — still a near-miss shove. */
  onSwatMiss?: (dir: THREE.Vector3, distance: number) => void;

  constructor(physics: Physics, start: THREE.Vector3) {
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
    const h = params.human.height;
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
    const h = params.human.height;
    const denim = new THREE.MeshLambertMaterial({ color: 0x3c4a63 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0xc4552f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a06b });
    const shoe = new THREE.MeshLambertMaterial({ color: 0x2a2723 });

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

  /** World-space eye position — perception rays start here, not at the feet. */
  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.root.position.x,
      this.root.position.y + params.human.height * 0.855,
      this.root.position.z,
    );
  }

  /** Shoulder joint the swatting arm pivots around. */
  shoulderPosition(out: THREE.Vector3): THREE.Vector3 {
    const h = params.human.height;
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
    const h = params.human.height;
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
    if (dist > p.sightRange || dist < 0.01) return false;
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
      const cosLimit = Math.cos((p.fovDegrees * Math.PI) / 360);
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
        if (this.root.position.distanceTo(this.patrolTarget) < 6 || this.stateT > 9) {
          const a = rand() * Math.PI * 2;
          const r = 12 + rand() * 34;
          this.patrolTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          this.stateT = 0;
        }
        if (seen) this.setState('suspicious');
        break;
      }
      case 'suspicious': {
        this.moveTarget = null; // stop and stare
        this.faceToward(this.lastKnown, dt, p.turnSpeed * 1.6);
        if (!seen && this.stateT > 1.4) this.setState('idle');
        else if (seen && this.stateT > 0.55) this.setState('investigate');
        break;
      }
      case 'investigate': {
        this.moveTarget = this.lastKnown;
        // Close to the distance that puts the bee ON the hand's sweep sphere,
        // which depends on how high it's flying. A fixed standoff leaves low
        // bees permanently out of reach and high ones overshot.
        const armLen = ARM_LENGTH * p.height;
        const shoulderY = this.root.position.y + 0.75 * p.height;
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
        const desperate = this.arrived && reachDist < armLen + p.swatRange * 2;
        if (seen && (canConnect || desperate) && this.swatCooldownT <= 0) {
          this.setState('swat');
        } else if (!seen && this.stateT > p.investigateTime) {
          this.setState('idle');
        }
        break;
      }
      case 'swat': {
        this.moveTarget = null;
        this.faceToward(this.lastKnown, dt, p.turnSpeed * 2.2);
        // The hand sweeps an arc, so test it CONTINUOUSLY rather than at one
        // chosen instant. A fixed strike frame only ever connects with bees at
        // whatever height the arm happens to be passing then — it whiffed
        // every bee at head height while swiping at ankle level.
        if (!this.didStrike && this.stateT >= p.swatWindup) {
          if (this.handPosition(_hand).distanceTo(beePos) <= p.swatRange) {
            this.didStrike = true;
            this.resolveStrike(beePos, true);
          }
        }
        if (this.stateT > p.swatWindup + SWING_TIME) {
          if (!this.didStrike) {
            this.didStrike = true;
            this.resolveStrike(beePos, false);
          }
          this.swatCooldownT = p.swatCooldown;
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
    this.animate(dt);
    this.syncBody();
    return { seen };
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

    if (connected) this.onSwatHit?.(dir);
    else this.onSwatMiss?.(dir, dist);
  }

  private faceToward(target: THREE.Vector3, dt: number, speed: number) {
    const want = Math.atan2(
      target.x - this.root.position.x,
      target.z - this.root.position.z,
    );
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
    const step = Math.min(p.walkSpeed * dt, dist);
    this.root.position.x += (dx / dist) * step;
    this.root.position.z += (dz / dist) * step;
    this.walkPhase += (step / 14) * Math.PI;
  }

  private animate(dt: number) {
    const p = params.human;
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
