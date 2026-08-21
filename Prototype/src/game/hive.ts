import * as THREE from 'three';
import type { Physics } from '../core/physics';
import type { DynamicProp } from '../world/yard';
import { params } from '../core/tuning';

// THE HIVE — where stolen tech becomes bee tech.
//
// It exists so the loop has somewhere to CLOSE. Stealing a battery is a
// physics toy; carrying it home and watching it become a gadget is a game.
// Per the scope doc the hive lives inside the fence cavity, which also makes
// it a place humans can see but never reach.

export class Hive {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  /** Total salvage delivered, ever. Drives research. */
  stored = 0;

  onDeposit?: (total: number) => void;

  private glowMat: THREE.MeshStandardMaterial;
  private pulse = 0;

  constructor(_physics: Physics, at: THREE.Vector3) {
    this.position.copy(at);

    const wax = new THREE.MeshStandardMaterial({
      color: 0xd8a13a, roughness: 0.75, metalness: 0.05,
    });
    // Stack of hexagonal cells — reads as "hive" instantly at any distance.
    const cell = new THREE.CylinderGeometry(3.2, 3.2, 3.4, 6);
    const rows = [
      { y: 4, n: 1, r: 0 },
      { y: 10, n: 6, r: 6.4 },
      { y: 17, n: 6, r: 6.4 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const a = (i / row.n) * Math.PI * 2;
        const m = new THREE.Mesh(cell, wax);
        m.rotation.x = Math.PI / 2;
        m.position.set(Math.cos(a) * row.r, row.y, Math.sin(a) * row.r * 0.35);
        this.group.add(m);
      }
    }

    // The entrance glows — it's the delivery target, so it must be findable.
    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0xffd75e, emissive: 0xffaa22, emissiveIntensity: 0.9, roughness: 0.4,
    });
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 6), this.glowMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 10, 2.2);
    this.group.add(mouth);

    this.group.position.copy(at);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /** Delivery point — slightly proud of the fence so you can fly into it. */
  mouthPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.position.x, this.position.y + 10, this.position.z + 3);
  }

  /**
   * Anything salvage-flagged inside the mouth radius is absorbed. Works for
   * the player's tractor beam and for swarm bees identically — the hive
   * doesn't care who did the carrying.
   */
  tryDeposit(props: DynamicProp[], mouth: THREE.Vector3): number {
    let taken = 0;
    for (const p of props) {
      if (!p.salvage || p.consumed) continue;
      const t = p.body.translation();
      const d = Math.hypot(t.x - mouth.x, t.y - mouth.y, t.z - mouth.z);
      if (d > params.hive.depositRadius) continue;
      p.consumed = true;
      p.mesh.visible = false;
      // Park it far below rather than removing it — deleting bodies mid-frame
      // invalidates handles other systems are still holding. Freeze it too, or
      // it falls forever and keeps costing simulation.
      p.body.setTranslation({ x: t.x, y: -500, z: t.z }, false);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      p.body.setGravityScale(0, false);
      p.body.sleep();
      this.stored += 1;
      taken += 1;
    }
    if (taken > 0) this.onDeposit?.(this.stored);
    return taken;
  }

  update(dt: number) {
    this.pulse += dt;
    this.glowMat.emissiveIntensity = 0.75 + Math.sin(this.pulse * 2.4) * 0.25;
  }
}
