import * as THREE from 'three';
import type { TechItem, TechContext } from './tech';
import type { Appliance } from '../world/appliances';
import { params } from '../core/tuning';

// HACKER ANTENNA — the verb that turns props into systems.
//
// Physics lets you MOVE an object. Hacking lets you AIM one object at another,
// which is where chains nobody scripted come from. A sprinkler you can shove
// is scenery; a sprinkler you can switch on from a hiding place is a weather
// machine, a distraction, and an electrical hazard depending on what's nearby.
//
// Holding to hack (rather than tapping) is deliberate: it costs you a moment
// of exposure, so hacking in plain sight is a real decision.

export class Hacker {
  progress = 0; // 0..1
  target: Appliance | null = null;

  readonly beam: THREE.Line;
  private geo: THREE.BufferGeometry;
  private mat: THREE.LineBasicMaterial;

  constructor(private appliances: Appliance[]) {
    this.geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.mat = new THREE.LineBasicMaterial({ color: 0x63ffa8, transparent: true });
    this.beam = new THREE.Line(this.geo, this.mat);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
  }

  /** The appliance currently under the crosshair, if any. */
  aimedAt(ctx: TechContext): Appliance | null {
    const hitHandle = ctx.aim.hasTarget ? ctx.aim.colliderHandle : -1;
    if (hitHandle < 0) return null;
    if (ctx.beePos.distanceTo(ctx.aim.point) > params.hack.range) return null;
    return this.appliances.find((a) => a.colliderHandle === hitHandle) ?? null;
  }

  cancel() {
    this.progress = 0;
    this.target = null;
    this.beam.visible = false;
  }

  update(beePos: THREE.Vector3) {
    if (!this.target) {
      this.beam.visible = false;
      return;
    }
    this.beam.visible = true;
    this.mat.opacity = 0.35 + this.progress * 0.65;
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const t = this.target.position;
    pos.setXYZ(0, beePos.x, beePos.y, beePos.z);
    pos.setXYZ(1, t.x, t.y + 8, t.z);
    pos.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

export function hackerTech(
  hacker: Hacker,
  onToggle: (a: Appliance) => void,
): TechItem {
  return {
    id: 'hacker',
    name: 'Hacker Antenna',
    icon: '📡',
    blurb: 'Hold on an appliance to flip its switch.',
    useStart(ctx: TechContext) {
      hacker.target = hacker.aimedAt(ctx);
      hacker.progress = 0;
    },
    useHold(ctx: TechContext) {
      // Drifting off the target cancels — you have to hold the aim, which is
      // what makes hacking in the open a risk rather than a free action.
      const aimed = hacker.aimedAt(ctx);
      if (!aimed || aimed !== hacker.target) {
        hacker.cancel();
        return;
      }
      hacker.progress += ctx.dt / params.hack.time;
      if (hacker.progress >= 1) {
        const t = hacker.target;
        hacker.cancel();
        t.toggle();
        onToggle(t);
      }
    },
    useEnd() {
      hacker.cancel();
    },
    unequip() {
      hacker.cancel();
    },
    status() {
      return hacker.target ? 'engaged' : 'idle';
    },
  };
}
