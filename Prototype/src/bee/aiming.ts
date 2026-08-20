import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import type { Yard } from '../world/yard';
import { params } from '../core/tuning';

// AIM RESOLUTION — "simulate honestly, assist generously."
//
// The world's physics stay real, but aiming cheats in the player's favour:
//
// 1. Two-stage aim. The camera ray finds a point in the world; the gadget then
//    fires from the BEE toward that point. Without this the filament leaves
//    from the camera, which is behind and above the bee, and close-range shots
//    miss by the parallax between them.
//
// 2. Ground demotion. The lawn is enormous and always under the crosshair, so
//    a raw raycast catches it constantly. If the ray lands on the ground and a
//    real target sits within a small cone of the crosshair, we snap to that
//    target instead. Deliberate ground shots still work — you just have to be
//    aiming at ground with nothing better nearby.

export interface AimResult {
  point: THREE.Vector3;
  /** Direction from the bee to the aim point — what gadgets actually fire along. */
  dirFromBee: THREE.Vector3;
  /** The body under the aim point, if any. */
  body: RAPIER_API.RigidBody | null;
  /** True when assist redirected the shot away from the ground. */
  assisted: boolean;
  /** Light enough for the tractor beam. */
  liftable: boolean;
  /** Anything at all in range. */
  hasTarget: boolean;
}

const _v = new THREE.Vector3();

export class Aiming {
  private candidates: { body: RAPIER_API.RigidBody }[] = [];

  constructor(private yard: Yard) {
    this.refresh();
  }

  /** Props and flower heads are "interesting"; ground and grass are not. */
  refresh() {
    this.candidates = [
      ...this.yard.dynamicProps.map((p) => ({ body: p.body })),
      ...this.yard.flowers.map((f) => ({ body: f.head })),
    ];
  }

  resolve(
    physics: Physics,
    camPos: THREE.Vector3,
    camDir: THREE.Vector3,
    beePos: THREE.Vector3,
    beeCollider: RAPIER_API.Collider,
    beeBody: RAPIER_API.RigidBody,
    out: AimResult,
  ): AimResult {
    const range = params.grapple.range;
    const ray = new physics.RAPIER.Ray(
      { x: camPos.x, y: camPos.y, z: camPos.z },
      { x: camDir.x, y: camDir.y, z: camDir.z },
    );
    const hit = physics.world.castRay(
      ray, range + params.camera.distance, true,
      undefined, undefined, beeCollider, beeBody,
    );

    let body: RAPIER_API.RigidBody | null = null;
    let hitGround = false;
    if (hit) {
      body = hit.collider.parent();
      // Ground and fence have no rigid body of their own; only the ground is
      // the nuisance, and it's the one that's flat under everything.
      hitGround = hit.collider.handle === this.yard.groundColliderHandle;
      out.point.copy(camPos).addScaledVector(camDir, hit.timeOfImpact);
    } else {
      out.point.copy(camPos).addScaledVector(camDir, range);
    }

    // Assist: only rescue the shot when it would otherwise hit dirt or nothing.
    out.assisted = false;
    if (!hit || hitGround) {
      const maxAngle = params.aim.assistAngle;
      let bestAngle = maxAngle;
      let best: RAPIER_API.RigidBody | null = null;
      for (const c of this.candidates) {
        const t = c.body.translation();
        _v.set(t.x - camPos.x, t.y - camPos.y, t.z - camPos.z);
        const dist = _v.length();
        if (dist < 0.001 || dist > range) continue;
        _v.divideScalar(dist);
        const angle = Math.acos(THREE.MathUtils.clamp(_v.dot(camDir), -1, 1));
        if (angle < bestAngle) {
          bestAngle = angle;
          best = c.body;
        }
      }
      if (best) {
        const t = best.translation();
        out.point.set(t.x, t.y, t.z);
        body = best;
        out.assisted = true;
      }
    }

    out.body = body;
    out.hasTarget = !!hit || out.assisted;
    out.liftable =
      body !== null &&
      body.isDynamic() &&
      body.mass() <= params.carry.maxMass &&
      out.point.distanceTo(beePos) <= params.carry.range;

    out.dirFromBee.subVectors(out.point, beePos);
    if (out.dirFromBee.lengthSq() < 1e-6) out.dirFromBee.copy(camDir);
    else out.dirFromBee.normalize();

    return out;
  }

  static emptyResult(): AimResult {
    return {
      point: new THREE.Vector3(),
      dirFromBee: new THREE.Vector3(0, 0, 1),
      body: null,
      assisted: false,
      liftable: false,
      hasTarget: false,
    };
  }
}
