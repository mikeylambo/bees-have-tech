import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';

// THE STINGER — innate, not tech. It's part of the bee's body, which is why
// it's never in the radial and never swapped away. The grappling cable is an
// attachment TO it (per the original design doc: "stinger grappling cable"),
// which is how tech and anatomy stay distinct.
//
// A short, fast jab: shoves props, and stings a human hard enough that they
// stop thinking of you as wildlife.

export class Stinger {
  /** 0..1 lunge animation progress, drives the visual. */
  lunge = 0;
  private cooldown = 0;

  /** Fired when the jab connects with the human. */
  onStingHuman?: (dir: THREE.Vector3) => void;

  constructor(
    private physics: Physics,
    private beeBody: RAPIER_API.RigidBody,
    private beeCollider: RAPIER_API.Collider,
  ) {}

  get ready(): boolean {
    return this.cooldown <= 0;
  }

  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Lunge decays fast — a jab, not a swing.
    this.lunge = Math.max(0, this.lunge - dt / params.stinger.lungeTime);
  }

  /**
   * Jab along `dir`. Returns true if it connected with anything.
   * The bee lunges forward slightly — commitment, and it reads at a glance.
   */
  jab(dir: THREE.Vector3, beePos: THREE.Vector3, humanBodyHandle: number): boolean {
    if (this.cooldown > 0) return false;
    const p = params.stinger;
    this.cooldown = p.cooldown;
    this.lunge = 1;

    // Small self-impulse: the bee throws itself at the target.
    const m = this.beeBody.mass();
    this.beeBody.applyImpulse(
      { x: dir.x * p.lungeImpulse * m, y: dir.y * p.lungeImpulse * m, z: dir.z * p.lungeImpulse * m },
      true,
    );

    const ray = new this.physics.RAPIER.Ray(
      { x: beePos.x, y: beePos.y, z: beePos.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = this.physics.world.castRay(
      ray, p.range, true, undefined, undefined, this.beeCollider, this.beeBody,
    );
    if (!hit) return false;

    const body = hit.collider.parent();
    if (!body) return true; // hit static geometry — connected, no effect

    if (body.handle === humanBodyHandle) {
      this.onStingHuman?.(dir);
      return true;
    }

    if (body.isDynamic()) {
      // Shove props around — a stinger is a tiny spear, not a weapon of mass.
      const im = p.propImpulse * Math.min(body.mass(), 1);
      body.applyImpulse(
        { x: dir.x * im, y: dir.y * im, z: dir.z * im },
        true,
      );
    }
    return true;
  }
}
