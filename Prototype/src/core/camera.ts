import * as THREE from 'three';
import { params } from './tuning';
import type { LookDelta } from './input';

// Third-person orbit-follow. Mouse steers yaw/pitch; position eases toward
// the desired orbit point so fast flying reads smooth, not rigid.
export class FollowCamera {
  yaw = Math.PI; // start behind the bee (bee faces +Z)
  pitch = 0.35;
  readonly camera: THREE.PerspectiveCamera;
  private desired = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private aimAt = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 600);
  }

  // Mouse deltas are pixels; stick values are -1..1 and need frame time.
  addLook(look: LookDelta, dt: number) {
    const c = params.camera;
    const invX = c.invertX ? -1 : 1;
    const invY = c.invertY ? -1 : 1;

    const dx = look.mouseDX * c.sensitivity + look.stickX * params.pad.lookSpeed * dt;
    const dy = look.mouseDY * c.sensitivity + look.stickY * params.pad.lookSpeed * dt;

    this.yaw -= dx * invX;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * invY, -0.3, 1.25);
  }

  update(dt: number, target: THREE.Vector3, snap = false) {
    const c = params.camera;
    const d = c.distance;

    // Over-the-shoulder offset. Without it the bee sits under the crosshair
    // and blocks the very thing you are aiming at.
    // View dir is -(sin yaw, 0, cos yaw), so screen-right is (cos yaw, 0, -sin yaw).
    const rx = Math.cos(this.yaw) * c.shoulder;
    const rz = -Math.sin(this.yaw) * c.shoulder;

    this.aimAt.set(target.x + rx, target.y + c.shoulderUp, target.z + rz);

    this.desired.set(
      this.aimAt.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.aimAt.y + Math.sin(this.pitch) * d + c.height,
      this.aimAt.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    if (snap) {
      this.camera.position.copy(this.desired);
    } else {
      const t = 1 - Math.exp(-params.camera.smoothing * dt);
      this.camera.position.lerp(this.desired, t);
    }
    this.lookTarget.lerp(this.aimAt, snap ? 1 : 1 - Math.exp(-20 * dt));
    this.camera.lookAt(this.lookTarget);
  }

  // Horizontal forward direction the flight controller steers by.
  forwardYaw(): number {
    return this.yaw + Math.PI; // camera sits behind: flight forward is opposite
  }
}
