import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import type { InputState } from '../core/input';
import { params } from '../core/tuning';


// The whole prototype bet lives in this file: does hover-flight feel good?
// Model: zero-G dynamic body + linear damping ("air thickness") + camera-
// relative acceleration. Damping gives the floaty drift; accel/maxSpeed give
// the zip; Wing Overdrive multiplies both.
export class FlightController {
  readonly body: RAPIER_API.RigidBody;
  readonly collider: RAPIER_API.Collider;
  private lastDamping: number;

  constructor(physics: Physics, start: THREE.Vector3) {
    const { RAPIER, world } = physics;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x, start.y, start.z)
      .lockRotations()
      .setGravityScale(0)
      .setLinearDamping(params.flight.damping)
      .setCcdEnabled(true);
    this.body = world.createRigidBody(desc);
    const col = RAPIER.ColliderDesc.ball(0.32)
      .setDensity(1.0)
      .setFriction(0.6)
      .setRestitution(0.25);
    this.collider = world.createCollider(col, this.body);
    this.lastDamping = params.flight.damping;
  }

  /** `load` is 0..1 from a carried object — heavy cargo slows the bee down. */
  applyInput(input: InputState, cameraYaw: number, load = 0) {
    if (params.flight.damping !== this.lastDamping) {
      this.body.setLinearDamping(params.flight.damping);
      this.lastDamping = params.flight.damping;
    }

    const p = params.flight;
    const haul = 1 - load * params.carry.haulPenalty;
    const boost = (input.boost ? p.boostMul : 1) * haul;
    const m = this.body.mass();

    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // Camera-relative thrust.
    //   forward = ( sin, 0,  cos)
    //   right   = forward x up = (-cos, 0, sin)
    // Strafe must follow +right, or A/D come out backwards.
    const ax = (sin * input.forward - cos * input.strafe) * p.accel * boost;
    const az = (cos * input.forward + sin * input.strafe) * p.accel * boost;
    const ay =
      input.vertical > 0
        ? p.ascend * boost
        : input.vertical < 0
          ? -p.descend * boost
          : 0;

    this.body.resetForces(true);
    this.body.addForce({ x: ax * m, y: ay * m, z: az * m }, true);

    // soft speed cap (horizontal and vertical separately)
    const v = this.body.linvel();
    const maxH = p.maxSpeed * boost;
    const hs = Math.hypot(v.x, v.z);
    let clamped = false;
    let { x, y, z } = v;
    if (hs > maxH) {
      const s = maxH / hs;
      x *= s;
      z *= s;
      clamped = true;
    }
    const maxV = maxH * 0.75;
    if (Math.abs(y) > maxV) {
      y = Math.sign(y) * maxV;
      clamped = true;
    }
    if (clamped) this.body.setLinvel({ x, y, z }, true);
  }

  position(out: THREE.Vector3): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  velocity(out: THREE.Vector3): THREE.Vector3 {
    const v = this.body.linvel();
    return out.set(v.x, v.y, v.z);
  }
}
