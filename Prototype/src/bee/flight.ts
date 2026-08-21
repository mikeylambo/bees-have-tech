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

  /**
   * `load` is 0..1 from a carried object — heavy cargo slows the bee down.
   * `air` is the local atmosphere: damping and a steady push, sampled where
   * the bee actually is. Air being a FIELD rather than a constant is what
   * makes a fan feel like a place instead of a prop.
   */
  applyInput(
    input: InputState,
    cameraYaw: number,
    load = 0,
    air?: { damping: number; force: THREE.Vector3 },
  ) {
    const damping = air ? air.damping : params.flight.damping;
    if (damping !== this.lastDamping) {
      this.body.setLinearDamping(damping);
      this.lastDamping = damping;
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
    let fx = (sin * input.forward - cos * input.strafe) * p.accel * boost * m;
    let fz = (cos * input.forward + sin * input.strafe) * p.accel * boost * m;
    let fy =
      (input.vertical > 0
        ? p.ascend * boost
        : input.vertical < 0
          ? -p.descend * boost
          : 0) * m;

    // Speed limiting is DRAG, not a hard clamp. A clamp would erase every
    // external impulse the instant it lands — grapple swings, swat knockback,
    // fan gusts — which is exactly the momentum the game is built on. Drag
    // limits powered flight while letting borrowed speed bleed off naturally.
    const v = this.body.linvel();
    const maxH = p.maxSpeed * boost;
    const hs = Math.hypot(v.x, v.z);
    if (hs > maxH) {
      const k = (p.overspeedDrag * m * (hs - maxH)) / hs;
      fx -= v.x * k;
      fz -= v.z * k;
    }
    const maxV = maxH * 0.75;
    const vs = Math.abs(v.y);
    if (vs > maxV) {
      fy -= Math.sign(v.y) * p.overspeedDrag * m * (vs - maxV);
    }

    // Wind is a force on the bee's mass, so it shoves you the same way a swat
    // does — you can fight it, but not ignore it.
    if (air) {
      fx += air.force.x * m;
      fy += air.force.y * m;
      fz += air.force.z * m;
    }

    this.body.resetForces(true);
    this.body.addForce({ x: fx, y: fy, z: fz }, true);
  }

  /** External hit — a swat, a gust. Applied as a real impulse. */
  knockback(dir: THREE.Vector3, speed: number) {
    const m = this.body.mass();
    this.body.applyImpulse(
      { x: dir.x * speed * m, y: dir.y * speed * m, z: dir.z * speed * m },
      true,
    );
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
