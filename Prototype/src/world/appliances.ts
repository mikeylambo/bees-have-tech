import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { FanZone } from './atmosphere';
import { params } from '../core/tuning';

// HACKABLE APPLIANCES — M3's whole point.
//
// Design rule, held hard: **every hackable object exposes exactly ONE verb.**
// On or off. All depth comes from combining objects, never from any single
// object having a complicated interface. Three appliances with one verb each
// produce more interesting play than one appliance with three verbs, because
// the interesting part is the overlap between their effects.
//
//   Sprinkler  → water. Wets ground, pushes down, soaks people.
//   Bug zapper → electricity. Arcs. Lethal to bugs, alarming to people.
//   Box fan    → moving air. Throws you and the props around.
//
// The chain nobody scripted: water reaches the zapper, and now the puddle is
// electrified.

export type ApplianceKind = 'sprinkler' | 'zapper' | 'fan';

export interface Appliance {
  kind: ApplianceKind;
  label: string;
  on: boolean;
  /** Where the hack beam should terminate, and where the human looks. */
  readonly position: THREE.Vector3;
  /** Collider you have to aim at to hack it. */
  colliderHandle: number;
  toggle(): void;
  update(dt: number): void;
  /** True while this appliance is doing something a human would notice. */
  readonly conspicuous: boolean;
}

const _v = new THREE.Vector3();

// ---------------------------------------------------------------- sprinkler
export class Sprinkler implements Appliance {
  kind: ApplianceKind = 'sprinkler';
  label = 'Sprinkler';
  on = false;
  readonly position = new THREE.Vector3();
  colliderHandle = -1;

  readonly group = new THREE.Group();
  /** Ground area this has soaked. Grows while on, dries slowly while off. */
  wetRadius = 0;

  private spray: THREE.Points;
  private sprayGeo: THREE.BufferGeometry;
  private velocities: Float32Array;
  private count = 260;
  private head: THREE.Mesh;
  private spin = 0;

  constructor(physics: Physics, at: THREE.Vector3) {
    this.position.copy(at);

    const metal = new THREE.MeshStandardMaterial({
      color: 0x6f7a72, roughness: 0.5, metalness: 0.6,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 1.6, 14), metal);
    base.position.y = 0.8;
    this.group.add(base);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 7, 12), metal);
    stalk.position.y = 4.4;
    this.group.add(stalk);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 1.6), metal);
    this.head.position.y = 8.2;
    this.group.add(this.head);
    this.group.position.copy(at);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    // Particle spray. Points, not meshes — hundreds of droplets for one draw.
    const pos = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) this.resetDrop(i, pos, true);
    this.sprayGeo = new THREE.BufferGeometry();
    this.sprayGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.spray = new THREE.Points(
      this.sprayGeo,
      new THREE.PointsMaterial({
        color: 0xa8dcff, size: 0.7, transparent: true, opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.spray.frustumCulled = false;
    this.spray.visible = false;
    this.group.add(this.spray);

    const { RAPIER, world } = physics;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z),
    );
    const col = world.createCollider(
      RAPIER.ColliderDesc.cylinder(4.6, 4).setTranslation(0, 4.6, 0),
      body,
    );
    this.colliderHandle = col.handle;
  }

  private resetDrop(i: number, pos: Float32Array, scatter = false) {
    const a = Math.random() * Math.PI * 2;
    const speed = 16 + Math.random() * 12;
    const pitch = 0.5 + Math.random() * 0.5;
    pos[i * 3] = 0;
    pos[i * 3 + 1] = 8.2;
    pos[i * 3 + 2] = 0;
    if (scatter) pos[i * 3 + 1] += Math.random() * 4;
    this.velocities[i * 3] = Math.cos(a) * speed * Math.cos(pitch);
    this.velocities[i * 3 + 1] = speed * Math.sin(pitch);
    this.velocities[i * 3 + 2] = Math.sin(a) * speed * Math.cos(pitch);
  }

  get conspicuous(): boolean {
    return this.on;
  }

  toggle() {
    this.on = !this.on;
    this.spray.visible = this.on;
  }

  update(dt: number) {
    const p = params.appliance;
    if (this.on) {
      this.spin += dt * 5;
      this.head.rotation.y = this.spin;
      this.wetRadius = Math.min(p.sprinklerWetRadius, this.wetRadius + p.wetGrow * dt);

      const pos = this.sprayGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < this.count; i++) {
        this.velocities[i * 3 + 1] -= 30 * dt;
        pos[i * 3] += this.velocities[i * 3] * dt;
        pos[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0) this.resetDrop(i, pos);
      }
      this.sprayGeo.attributes.position.needsUpdate = true;
    } else {
      this.wetRadius = Math.max(0, this.wetRadius - p.wetDry * dt);
    }
  }

  /** Is this world point currently under water? */
  wets(p: THREE.Vector3): boolean {
    if (this.wetRadius <= 0) return false;
    _v.set(p.x - this.position.x, 0, p.z - this.position.z);
    return _v.length() <= this.wetRadius;
  }
}

// ------------------------------------------------------------------- zapper
export class BugZapper implements Appliance {
  kind: ApplianceKind = 'zapper';
  label = 'Bug Zapper';
  on = false;
  readonly position = new THREE.Vector3();
  colliderHandle = -1;

  readonly group = new THREE.Group();
  /** Set by the world when its arc is standing in sprinkler water. */
  electrifiedWater = false;

  private core: THREE.Mesh;
  private glowMat: THREE.MeshStandardMaterial;
  private arc: THREE.LineSegments;
  private arcGeo: THREE.BufferGeometry;
  private flicker = 0;

  constructor(physics: Physics, at: THREE.Vector3) {
    this.position.copy(at);
    const shell = new THREE.MeshStandardMaterial({
      color: 0x2b2f27, roughness: 0.7, metalness: 0.3,
    });
    // Wireframe, not a solid box — a zapper's cage IS a wire mesh, and a solid
    // one hides the glowing core that tells you the thing is live.
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x3c443a, wireframe: true,
    });
    const cage = new THREE.Mesh(new THREE.BoxGeometry(9, 13, 9, 3, 4, 3), cageMat);
    cage.position.y = 10;
    this.group.add(cage);
    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0x7fd0ff, emissive: 0x2a5fff, emissiveIntensity: 0,
      roughness: 0.2,
    });
    this.core = new THREE.Mesh(new THREE.BoxGeometry(5.5, 9, 5.5), this.glowMat);
    this.core.position.y = 10;
    this.group.add(this.core);
    const hanger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 8, 8), shell,
    );
    hanger.position.y = 20;
    this.group.add(hanger);
    this.group.position.copy(at);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    // Crackle: a handful of line segments jittered each frame.
    const segs = 14;
    const verts = new Float32Array(segs * 6);
    this.arcGeo = new THREE.BufferGeometry();
    this.arcGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    this.arc = new THREE.LineSegments(
      this.arcGeo,
      new THREE.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.95 }),
    );
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    this.arc.position.y = 10;
    this.group.add(this.arc);

    const { RAPIER, world } = physics;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z),
    );
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(4.5, 6.5, 4.5).setTranslation(0, 10, 0),
      body,
    );
    this.colliderHandle = col.handle;
  }

  get conspicuous(): boolean {
    return this.on;
  }

  toggle() {
    this.on = !this.on;
    this.arc.visible = this.on;
    this.glowMat.emissiveIntensity = this.on ? 1.4 : 0;
  }

  update(dt: number) {
    if (!this.on) return;
    this.flicker += dt;
    const jolt = this.electrifiedWater ? 2.2 : 1;
    this.glowMat.emissiveIntensity =
      (1.1 + Math.sin(this.flicker * 37) * 0.5) * jolt;
    const v = this.arcGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < v.length; i += 6) {
      const r = 2.6 * jolt;
      v[i] = (Math.random() - 0.5) * r;
      v[i + 1] = (Math.random() - 0.5) * 8;
      v[i + 2] = (Math.random() - 0.5) * r;
      v[i + 3] = (Math.random() - 0.5) * r;
      v[i + 4] = (Math.random() - 0.5) * 8;
      v[i + 5] = (Math.random() - 0.5) * r;
    }
    this.arcGeo.attributes.position.needsUpdate = true;
  }

  /** Anything inside this radius while live gets zapped. */
  get hazardRadius(): number {
    return this.electrifiedWater
      ? params.appliance.zapperRadius * params.appliance.wetZapMultiplier
      : params.appliance.zapperRadius;
  }
}

// ---------------------------------------------------------------------- fan
export class BoxFan implements Appliance {
  kind: ApplianceKind = 'fan';
  label = 'Box Fan';
  on = false;
  readonly position = new THREE.Vector3();
  colliderHandle = -1;

  readonly group = new THREE.Group();
  readonly zone: FanZone;

  private blades: THREE.Mesh;
  private spin = 0;

  constructor(physics: Physics, at: THREE.Vector3, facing: THREE.Vector3) {
    this.position.copy(at);
    const dir = facing.clone().normalize();

    const shell = new THREE.MeshStandardMaterial({
      color: 0xb9bcc0, roughness: 0.6, metalness: 0.25,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 3.4), shell);
    frame.position.y = 10;
    this.group.add(frame);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x76797d, roughness: 0.4, metalness: 0.5,
    });
    this.blades = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 0.6), bladeMat);
    this.blades.position.set(0, 10, 2);
    this.group.add(this.blades);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 0.6), bladeMat);
    blade2.position.set(0, 0, 0);
    this.blades.add(blade2);

    this.group.position.copy(at);
    this.group.lookAt(at.clone().add(dir));
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    const origin = at.clone().addScaledVector(dir, 2).setY(at.y + 10);
    this.zone = new FanZone(
      origin, dir, params.atmosphere.fanRange, params.atmosphere.fanSpread,
    );

    const { RAPIER, world } = physics;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z),
    );
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(10, 10, 1.7).setTranslation(0, 10, 0),
      body,
    );
    this.colliderHandle = col.handle;
  }

  get conspicuous(): boolean {
    return this.on;
  }

  toggle() {
    this.on = !this.on;
    this.zone.enabled = this.on;
  }

  update(dt: number) {
    if (!this.on) return;
    this.spin += dt * 26;
    this.blades.rotation.z = this.spin;
  }

  /** Push loose props too — the fan shouldn't only affect the player. */
  applyToProps(bodies: RAPIER_API.RigidBody[], dt: number) {
    if (!this.on) return;
    for (const b of bodies) {
      _v.set(b.translation().x, b.translation().y, b.translation().z);
      const s = this.zone.strengthAt(_v);
      if (s <= 0) continue;
      const f = params.atmosphere.fanForce * s * b.mass() * dt * 0.6;
      b.applyImpulse(
        {
          x: this.zone.dir.x * f,
          y: this.zone.dir.y * f + f * 0.25,
          z: this.zone.dir.z * f,
        },
        true,
      );
    }
  }
}
