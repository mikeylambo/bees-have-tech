import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { params } from '../core/tuning';

// STINGER GRAPPLE — the first real interaction verb.
//
// Fire a filament at whatever the camera is aimed at, attach, reel in.
// Modelled as a rope joint (max distance, free below it) so you SWING rather
// than getting rigidly winched. Reeling shortens the rope; the swing is the
// comedy.
//
// The mass ratio decides who moves: grapple a pebble and it comes to you,
// grapple the fence and you go to it. That asymmetry is free physics comedy,
// so nothing here special-cases it.

export type GrappleState = 'idle' | 'flying' | 'attached';

export class Grapple {
  state: GrappleState = 'idle';

  private world: RAPIER_API.World;
  private RAPIER: typeof RAPIER_API;
  private beeBody: RAPIER_API.RigidBody;

  private joint: RAPIER_API.ImpulseJoint | null = null;
  private anchorBody: RAPIER_API.RigidBody | null = null; // temp static body for world geometry
  private targetBody: RAPIER_API.RigidBody | null = null;
  private localAnchor = { x: 0, y: 0, z: 0 };
  private ropeLength = 0;

  // visuals
  readonly line: THREE.Line;
  private lineGeo: THREE.BufferGeometry;
  private tip = new THREE.Vector3();
  private flightT = 0; // 0..1 travel animation for the filament
  private flightFrom = new THREE.Vector3();
  private flightTo = new THREE.Vector3();
  private pendingHit: {
    body: RAPIER_API.RigidBody | null;
    point: THREE.Vector3;
  } | null = null;

  constructor(physics: Physics, beeBody: RAPIER_API.RigidBody) {
    this.world = physics.world;
    this.RAPIER = physics.RAPIER;
    this.beeBody = beeBody;

    this.lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.line = new THREE.Line(
      this.lineGeo,
      new THREE.LineBasicMaterial({ color: 0xf7f2d8 }),
    );
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  /** Where the filament is currently anchored, in world space. */
  anchorPoint(out: THREE.Vector3): THREE.Vector3 | null {
    if (this.state === 'idle') return null;
    return out.copy(this.tip);
  }

  /**
   * Raycast from the camera through the crosshair. Aiming from the camera
   * (not the bee) is what makes the crosshair honest.
   */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, beeCollider?: RAPIER_API.Collider) {
    if (this.state !== 'idle') return;

    const ray = new this.RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = this.world.castRayAndGetNormal(
      ray,
      params.grapple.range,
      true,
      undefined,
      undefined,
      beeCollider,
      this.beeBody,
    );

    const beePos = this.beeBody.translation();
    this.flightFrom.set(beePos.x, beePos.y, beePos.z);

    if (!hit) {
      // Miss: still show the filament shooting out and falling short.
      this.flightTo.copy(origin).addScaledVector(dir, params.grapple.range);
      this.pendingHit = null;
    } else {
      const p = ray.pointAt(hit.timeOfImpact);
      this.flightTo.set(p.x, p.y, p.z);
      this.pendingHit = {
        body: hit.collider.parent(),
        point: this.flightTo.clone(),
      };
    }

    this.state = 'flying';
    this.flightT = 0;
    this.tip.copy(this.flightFrom);
    this.line.visible = true;
  }

  private attach() {
    const hit = this.pendingHit;
    this.pendingHit = null;
    if (!hit) {
      this.release();
      return;
    }

    const beePos = this.beeBody.translation();
    this.ropeLength = Math.max(
      params.grapple.minLength,
      Math.hypot(hit.point.x - beePos.x, hit.point.y - beePos.y, hit.point.z - beePos.z),
    );

    let other: RAPIER_API.RigidBody;
    if (hit.body && hit.body.isDynamic()) {
      // Attach to the moving thing itself, in ITS local space, so the rope
      // tracks the object as it tumbles.
      other = hit.body;
      this.targetBody = hit.body;
      const t = other.translation();
      const r = other.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert();
      const local = new THREE.Vector3(
        hit.point.x - t.x,
        hit.point.y - t.y,
        hit.point.z - t.z,
      ).applyQuaternion(q);
      this.localAnchor = { x: local.x, y: local.y, z: local.z };
    } else {
      // World geometry: pin a temporary fixed body at the hit point.
      other = this.world.createRigidBody(
        this.RAPIER.RigidBodyDesc.fixed().setTranslation(
          hit.point.x,
          hit.point.y,
          hit.point.z,
        ),
      );
      this.anchorBody = other;
      this.targetBody = null;
      this.localAnchor = { x: 0, y: 0, z: 0 };
    }

    const jd = this.RAPIER.JointData.rope(
      this.ropeLength,
      { x: 0, y: 0, z: 0 },
      this.localAnchor,
    );
    this.joint = this.world.createImpulseJoint(jd, this.beeBody, other, true);
    this.state = 'attached';
  }

  /** Held input reels the filament in. */
  reel(dt: number, reeling: boolean) {
    if (this.state !== 'attached' || !this.joint) return;
    if (!reeling) return;

    const next = Math.max(
      params.grapple.minLength,
      this.ropeLength - params.grapple.reelSpeed * dt,
    );
    if (next === this.ropeLength) return;
    this.ropeLength = next;

    // Rapier has no rope-length setter, so rebuild the joint at the new length.
    const other = this.targetBody ?? this.anchorBody;
    if (!other) return;
    this.world.removeImpulseJoint(this.joint, true);
    const jd = this.RAPIER.JointData.rope(
      this.ropeLength,
      { x: 0, y: 0, z: 0 },
      this.localAnchor,
    );
    this.joint = this.world.createImpulseJoint(jd, this.beeBody, other, true);
  }

  release() {
    if (this.joint) {
      this.world.removeImpulseJoint(this.joint, true);
      this.joint = null;
    }
    if (this.anchorBody) {
      this.world.removeRigidBody(this.anchorBody);
      this.anchorBody = null;
    }
    this.targetBody = null;
    this.pendingHit = null;
    this.state = 'idle';
    this.line.visible = false;
  }

  update(dt: number, beePos: THREE.Vector3) {
    if (this.state === 'idle') return;

    if (this.state === 'flying') {
      this.flightT += dt / Math.max(0.016, params.grapple.travelTime);
      if (this.flightT >= 1) {
        this.tip.copy(this.flightTo);
        this.attach();
      } else {
        this.tip.lerpVectors(this.flightFrom, this.flightTo, this.flightT);
      }
    } else if (this.state === 'attached') {
      // Track the anchor as the target moves.
      if (this.targetBody) {
        const t = this.targetBody.translation();
        const r = this.targetBody.rotation();
        this.tip
          .set(this.localAnchor.x, this.localAnchor.y, this.localAnchor.z)
          .applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
          .add(new THREE.Vector3(t.x, t.y, t.z));
      }
    }

    const pos = this.lineGeo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, beePos.x, beePos.y, beePos.z);
    pos.setXYZ(1, this.tip.x, this.tip.y, this.tip.z);
    pos.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
  }
}
