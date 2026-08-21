import * as THREE from 'three';
import { params } from '../core/tuning';

// ATMOSPHERE — air as a field, not a constant.
//
// `damping` decides how the bee feels to fly and to stop, so making it a
// property of WHERE YOU ARE means the same yard can contain many different
// flying experiences: a fan's blast, still indoor air, humid steam, a draft
// you can ride. That's the cheapest way to make one property feel like many
// places, and it's why the box fan is a system rather than a prop.
//
// Zones are simple shapes sampled per frame. The architecture matters more
// than the zone count — once sampling exists, every new zone is content.

export interface AirSample {
  /** Replaces params.flight.damping at this point. */
  damping: number;
  /** Steady push, in units/sec^2. */
  force: THREE.Vector3;
}

export interface AirZone {
  /** Contribution at `p`, or null if the point is outside the zone. */
  sample(p: THREE.Vector3, out: AirSample): boolean;
}

/**
 * A cone of moving air. Strongest on the axis, fading to nothing at the edge
 * and at max range — so you can skim the edge of a fan and get nudged, or fly
 * down the middle and get thrown.
 */
export class FanZone implements AirZone {
  enabled = false;
  readonly origin = new THREE.Vector3();
  readonly dir = new THREE.Vector3(0, 0, 1);

  private toP = new THREE.Vector3();

  constructor(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    private range: number,
    private spread: number, // radians, half-angle
  ) {
    this.origin.copy(origin);
    this.dir.copy(dir).normalize();
  }

  /** 0..1 strength at a point — also drives the visual so they can't disagree. */
  strengthAt(p: THREE.Vector3): number {
    if (!this.enabled) return 0;
    this.toP.subVectors(p, this.origin);
    const dist = this.toP.length();
    if (dist > this.range || dist < 0.001) return 0;
    this.toP.divideScalar(dist);
    const cos = this.toP.dot(this.dir);
    if (cos <= 0) return 0;
    const angle = Math.acos(Math.min(1, cos));
    if (angle > this.spread) return 0;
    const radial = 1 - angle / this.spread;
    const axial = 1 - dist / this.range;
    return radial * radial * axial;
  }

  sample(p: THREE.Vector3, out: AirSample): boolean {
    const s = this.strengthAt(p);
    if (s <= 0) return false;
    const a = params.atmosphere;
    // Moving air is thin air: low damping plus a shove. That combination is
    // what makes a fan feel like being thrown rather than merely pushed.
    out.damping = THREE.MathUtils.lerp(params.flight.damping, a.fanDamping, s);
    out.force.copy(this.dir).multiplyScalar(a.fanForce * s);
    return true;
  }
}

export class Atmosphere {
  private zones: AirZone[] = [];
  private scratch: AirSample = { damping: 0, force: new THREE.Vector3() };

  add(zone: AirZone) {
    this.zones.push(zone);
  }

  /** Strongest-zone-wins. Simple, and avoids zones cancelling into mush. */
  sample(p: THREE.Vector3, out: AirSample): AirSample {
    out.damping = params.flight.damping;
    out.force.set(0, 0, 0);
    let best = -Infinity;
    for (const z of this.zones) {
      if (!z.sample(p, this.scratch)) continue;
      const magnitude = this.scratch.force.length();
      if (magnitude > best) {
        best = magnitude;
        out.damping = this.scratch.damping;
        out.force.copy(this.scratch.force);
      }
    }
    return out;
  }

  static emptySample(): AirSample {
    return { damping: params.flight.damping, force: new THREE.Vector3() };
  }
}
