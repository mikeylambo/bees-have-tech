import * as THREE from 'three';
import type { FollowCamera } from '../core/camera';
import { params } from '../core/tuning';

// SPEED FX — the camera's half of the sense of speed.
//
// Motes give you optical flow; this gives you the physiological cues that go
// with going fast. Field of view widens, the camera eases back, and a vignette
// closes in slightly. All three are eased rather than driven directly off
// velocity, because the ugly version of this effect is one that snaps every
// time you tap the stick.

export class SpeedFx {
  private fov = 0;
  private eased = 0;
  private vignette: HTMLElement | null;

  constructor(private cam: FollowCamera) {
    this.fov = cam.camera.fov;
    this.vignette = document.getElementById('speedVignette');
  }

  update(dt: number, speed: number) {
    const p = params.speedFx;
    // Normalised against the CURRENT preset's overdrive ceiling, so the effect
    // means the same thing whichever bee you are flying.
    const top = params.flight.maxSpeed * params.flight.boostMul;
    const t = Math.min(1, Math.max(0, (speed - top * p.startAt) / (top * (1 - p.startAt))));
    // Exponential smoothing: frame-rate independent, and it can't overshoot.
    this.eased += (t - this.eased) * (1 - Math.exp(-p.responsiveness * dt));

    const e = this.eased;
    this.cam.camera.fov = this.fov + e * p.fovKick;
    this.cam.camera.updateProjectionMatrix();
    this.cam.distanceScale = 1 + e * p.dolly;

    if (this.vignette) this.vignette.style.opacity = `${e * p.vignette}`;
  }

  /** Called when the base FOV changes (resize keeps aspect, not fov). */
  rebase(fov: number) {
    this.fov = fov;
  }
}

export const _unused = THREE; // keep the import shape stable for tree-shaking
