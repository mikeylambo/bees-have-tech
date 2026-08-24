import * as THREE from 'three';
import type { DynamicProp } from '../world/props';
import type { Hive } from '../game/hive';
import { params } from '../core/tuning';

// THE SWARM — the player is still one bee; these are colleagues.
//
// Per the pillar, there is never a command camera. You throw a beacon and
// bees converge on it, then decide what to do from CONTEXT: salvage nearby
// gets hauled home, a human nearby gets harassed. One verb for the player,
// contextual behaviour underneath — the same rule the appliances follow.
//
// They're deliberately non-physical: they push nothing and collide with
// nothing, so a dozen of them cost almost nothing and can never wedge the
// player into geometry.

type Job = 'idle' | 'converge' | 'haul' | 'distract';

const _v = new THREE.Vector3();
const _cargo = new THREE.Vector3();
const _mouth = new THREE.Vector3();
const _pull = new THREE.Vector3();

class SwarmBee {
  readonly mesh: THREE.Group;
  job: Job = 'idle';
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private carrying: DynamicProp | null = null;
  private wobble = Math.random() * Math.PI * 2;
  private wings: THREE.Mesh;

  constructor(at: THREE.Vector3, private index: number) {
    this.pos.copy(at);
    this.mesh = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8bb3f }),
    );
    body.scale.z = 1.35;
    this.mesh.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x24201c }),
    );
    head.position.z = 0.4;
    this.mesh.add(head);
    const stripe = new THREE.Mesh(
      new THREE.SphereGeometry(0.345, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x24201c }),
    );
    stripe.scale.set(1.01, 1.01, 0.28);
    stripe.position.z = -0.12;
    this.mesh.add(stripe);
    this.wings = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.4),
      new THREE.MeshLambertMaterial({
        color: 0xe8f4ff, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    this.wings.position.y = 0.28;
    this.wings.rotation.x = -Math.PI / 2;
    this.mesh.add(this.wings);
    this.mesh.position.copy(at);
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }

  get hauling(): DynamicProp | null {
    return this.carrying;
  }

  dropCargo() {
    this.carrying = null;
  }

  assign(job: Job, carrying: DynamicProp | null = null) {
    this.job = job;
    this.carrying = carrying;
  }

  /** Steer toward a point with a bit of character — never a straight line. */
  private steerTo(target: THREE.Vector3, dt: number, speed: number) {
    _v.subVectors(target, this.pos);
    const d = _v.length();
    if (d > 0.001) _v.divideScalar(d);
    this.vel.lerp(_v.multiplyScalar(speed), 1 - Math.exp(-4 * dt));
    this.pos.addScaledVector(this.vel, dt);
    return d;
  }

  update(
    dt: number,
    beacon: THREE.Vector3 | null,
    hive: Hive,
    humanPos: THREE.Vector3,
    playerPos: THREE.Vector3,
  ) {
    const p = params.swarm;
    this.wobble += dt * (9 + this.index);

    switch (this.job) {
      case 'haul': {
        const cargo = this.carrying;
        if (!cargo || cargo.consumed) {
          this.carrying = null;
          this.job = 'idle';
          break;
        }
        const t = cargo.body.translation();
        // Own vector, NOT the shared scratch — steerTo clobbers _v, and
        // computing the servo from a clobbered position makes the correction
        // explode and fires the cargo into the sky.
        _cargo.set(t.x, t.y, t.z);
        const grabbed = this.pos.distanceTo(_cargo) < p.grabRadius;
        if (!grabbed) {
          this.steerTo(_cargo, dt, p.speed);
        } else {
          // Drive the cargo's velocity, same feed-forward idea as the tractor
          // beam: match the carrier's velocity, then correct the offset.
          this.steerTo(hive.mouthPosition(_mouth), dt, p.speed * 0.8);
          _pull.subVectors(this.pos, _cargo).multiplyScalar(6);
          // Clamp, or any gap that opens feeds back on itself.
          if (_pull.length() > p.speed) _pull.setLength(p.speed);
          cargo.body.setLinvel(
            {
              x: this.vel.x + _pull.x,
              y: this.vel.y + _pull.y + 4,
              z: this.vel.z + _pull.z,
            },
            true,
          );
        }
        break;
      }
      case 'distract': {
        // Orbit the human's head. Being mobbed is the point.
        const a = this.wobble * 0.6;
        _v.set(
          humanPos.x + Math.cos(a) * p.orbitRadius,
          humanPos.y + params.human.height * 0.8,
          humanPos.z + Math.sin(a) * p.orbitRadius,
        );
        this.steerTo(_v, dt, p.speed);
        break;
      }
      case 'converge': {
        if (beacon) this.steerTo(beacon, dt, p.speed);
        else this.job = 'idle';
        break;
      }
      default: {
        // Loose formation around the player, offset so they don't stack.
        const a = this.wobble * 0.35 + (this.index / 3) * Math.PI * 2;
        _v.set(
          playerPos.x + Math.cos(a) * p.followRadius,
          playerPos.y + 2 + Math.sin(this.wobble * 0.5) * 1.5,
          playerPos.z + Math.sin(a) * p.followRadius,
        );
        this.steerTo(_v, dt, p.speed * 0.85);
      }
    }

    this.mesh.position.copy(this.pos);
    this.mesh.position.y += Math.sin(this.wobble) * 0.18;
    if (this.vel.lengthSq() > 0.01) {
      _v.copy(this.pos).add(this.vel);
      this.mesh.lookAt(_v);
    }
    this.wings.rotation.y = Math.sin(this.wobble * 6) * 0.7;
  }
}

export class Swarm {
  readonly group = new THREE.Group();
  private bees: SwarmBee[] = [];
  private beacon: THREE.Vector3 | null = null;
  private beaconT = 0;
  readonly beaconMesh: THREE.Mesh;

  constructor() {
    this.beaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd75e, emissive: 0xffaa22, emissiveIntensity: 1.4,
      }),
    );
    this.beaconMesh.visible = false;
    this.group.add(this.beaconMesh);
  }

  get count(): number {
    return this.bees.length;
  }

  recruit(at: THREE.Vector3) {
    const b = new SwarmBee(at, this.bees.length);
    this.bees.push(b);
    this.group.add(b.mesh);
  }

  /** Player threw a beacon. Bees converge and then read the situation. */
  placeBeacon(at: THREE.Vector3) {
    this.beacon = at.clone();
    this.beaconT = params.swarm.beaconTime;
    this.beaconMesh.position.copy(at);
    this.beaconMesh.visible = true;
    for (const b of this.bees) b.assign('converge');
  }

  update(
    dt: number,
    hive: Hive,
    humanPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    props: DynamicProp[],
  ) {
    const p = params.swarm;
    if (this.beacon) {
      this.beaconT -= dt;
      this.beaconMesh.rotation.y += dt * 3;
      if (this.beaconT <= 0) {
        // Beacon expires — each bee reads the situation and takes a job.
        // Claimed cargo is tracked so three bees don't all fight over one
        // battery while a second one sits there untouched.
        const claimed = new Set<DynamicProp>();
        const humanNear = humanPos.distanceTo(this.beacon) < p.contextRadius;
        for (const b of this.bees) {
          const cargo = this.nearestSalvage(props, this.beacon, claimed);
          if (cargo) {
            claimed.add(cargo);
            b.assign('haul', cargo);
          } else if (humanNear) {
            b.assign('distract');
          } else {
            b.assign('idle');
          }
        }
        this.beacon = null;
        this.beaconMesh.visible = false;
      }
    }
    for (const b of this.bees) {
      b.update(dt, this.beacon, hive, humanPos, playerPos);
    }
  }

  /** True while any bee is mobbing the human — used to blunt his perception. */
  get distracting(): boolean {
    return this.bees.some((b) => b.job === 'distract');
  }

  private nearestSalvage(
    props: DynamicProp[],
    near: THREE.Vector3,
    claimed: Set<DynamicProp>,
  ): DynamicProp | null {
    let best: DynamicProp | null = null;
    let bestD = params.swarm.contextRadius;
    for (const p of props) {
      if (!p.salvage || p.consumed || claimed.has(p)) continue;
      const t = p.body.translation();
      const d = Math.hypot(t.x - near.x, t.y - near.y, t.z - near.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
