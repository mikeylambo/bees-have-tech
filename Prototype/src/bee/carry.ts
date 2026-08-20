import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';

// TRACTOR BEAM — grab a prop, hold it in front of you, throw it.
//
// Velocity-servo rather than a joint: each frame we steer the held body's
// velocity toward a hold point ahead of the bee. That stays stable at any
// mass, lets heavy things visibly lag and sag, and makes throwing a matter of
// just letting go with the velocity we already gave it.
//
// Heavy objects fight back on purpose — a bee dragging a soda can should look
// like it is losing.

export class Carry {
  held: RAPIER_API.RigidBody | null = null;

  private world: RAPIER_API.World;
  private beeBody: RAPIER_API.RigidBody;
  private holdPoint = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private savedDamping = 0;
  private savedAngularDamping = 0;

  readonly beam: THREE.Mesh;

  constructor(physics: Physics, beeBody: RAPIER_API.RigidBody) {
    this.world = physics.world;
    this.beeBody = beeBody;

    // Cone of light from the bee to the held object.
    const geo = new THREE.ConeGeometry(0.55, 1, 12, 1, true);
    geo.translate(0, -0.5, 0); // tip at origin, opening downward along -Y
    this.beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x7fd8ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.beam.visible = false;
  }

  get isCarrying(): boolean {
    return this.held !== null;
  }

  /** Grab the nearest dynamic body within reach of the aim ray. */
  tryGrab(
    physics: Physics,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    beeCollider?: RAPIER_API.Collider,
  ): boolean {
    if (this.held) return false;

    const ray = new physics.RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = this.world.castRay(
      ray,
      params.carry.range,
      true,
      undefined,
      undefined,
      beeCollider,
      this.beeBody,
    );
    if (!hit) return false;

    const body = hit.collider.parent();
    if (!body || !body.isDynamic()) return false;
    if (body.mass() > params.carry.maxMass) return false; // too heavy to lift

    this.held = body;
    this.savedDamping = body.linearDamping();
    this.savedAngularDamping = body.angularDamping();
    // Damp hard while held so the object doesn't oscillate around the servo.
    body.setLinearDamping(6);
    body.setAngularDamping(6);
    body.setGravityScale(0, true);
    this.beam.visible = true;
    return true;
  }

  /** Let go, keeping whatever velocity the object currently has. */
  drop() {
    this.restore();
  }

  /** Let go with an added shove along `dir`. */
  throwIt(dir: THREE.Vector3) {
    const body = this.held;
    if (!body) return;
    const impulse = params.carry.throwImpulse * body.mass();
    body.applyImpulse(
      { x: dir.x * impulse, y: dir.y * impulse, z: dir.z * impulse },
      true,
    );
    this.restore();
  }

  private restore() {
    const body = this.held;
    if (!body) return;
    body.setLinearDamping(this.savedDamping);
    body.setAngularDamping(this.savedAngularDamping);
    body.setGravityScale(1, true);
    this.held = null;
    this.beam.visible = false;
  }

  update(beePos: THREE.Vector3, aimDir: THREE.Vector3) {
    const body = this.held;
    if (!body) return;

    // Hold point sits ahead of and slightly below the bee.
    this.holdPoint
      .copy(beePos)
      .addScaledVector(aimDir, params.carry.holdDistance)
      .addScaledVector(new THREE.Vector3(0, 1, 0), -params.carry.holdDrop);

    const t = body.translation();
    this.tmp.set(
      this.holdPoint.x - t.x,
      this.holdPoint.y - t.y,
      this.holdPoint.z - t.z,
    );

    const dist = this.tmp.length();
    if (dist > params.carry.breakDistance) {
      // Yanked out of the beam — a heavy prop dragging you around wins.
      this.restore();
      return;
    }

    // Heavier objects follow more sluggishly, so weight reads visually.
    // Measured against a reference pebble, not 1.0 — every prop in this yard
    // weighs well under a kilo, so an absolute scale would call them all light.
    const massFactor = THREE.MathUtils.clamp(
      params.carry.refMass / Math.max(0.005, body.mass()),
      0.15,
      1,
    );
    const speed = params.carry.pullSpeed * massFactor;
    const desired = this.tmp.normalize().multiplyScalar(Math.min(dist * 8, speed));
    body.setLinvel({ x: desired.x, y: desired.y, z: desired.z }, true);

    // Point the beam cone from the bee to the object.
    this.beam.position.copy(beePos);
    const to = new THREE.Vector3(t.x - beePos.x, t.y - beePos.y, t.z - beePos.z);
    const len = Math.max(0.3, to.length());
    this.beam.scale.set(1, len, 1);
    this.beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      to.normalize(),
    );
  }
}
