import * as THREE from 'three';
import type { Physics } from '../core/physics';
import type { DynamicProp, SalvageKind } from '../world/props';
import { params } from '../core/tuning';
import { M } from '../world/estateWorld';

/**
 * The hive is roughly 1.2 m across — big enough to be a landmark from the far
 * fence, and big enough that a shop counter on the front of it reads as a
 * place rather than a decal.
 */
const S = M * 0.055;

// THE HIVE — where stolen tech becomes bee tech.
//
// It exists so the loop has somewhere to CLOSE. Stealing a battery is a
// physics toy; carrying it home and watching it become a gadget is a game.
// Per the scope doc the hive lives inside the fence cavity, which also makes
// it a place humans can see but never reach.
//
// It is also the shop counter. Salvage is a BALANCE now, not a running total:
// `stored` is what you can spend, `lifetime` is what you ever brought home.

export class Hive {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  /** Spendable salvage sitting in the hive right now. */
  stored = 0;
  /** Everything ever delivered. Never goes down — it's the score, not the bank. */
  lifetime = 0;

  private glowMat: THREE.MeshStandardMaterial;
  private pulse = 0;

  constructor(physics: Physics, at: THREE.Vector3) {
    this.position.copy(at);

    const wax = new THREE.MeshStandardMaterial({
      color: 0xd8a13a, roughness: 0.75, metalness: 0.05,
    });
    // Stack of hexagonal cells — reads as "hive" instantly at any distance.
    const cell = new THREE.CylinderGeometry(3.2 * S, 3.2 * S, 3.4 * S, 6);
    const rows = [
      { y: 4 * S, n: 1, r: 0 },
      { y: 10 * S, n: 6, r: 6.4 * S },
      { y: 17 * S, n: 6, r: 6.4 * S },
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
    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6 * S, 2.6 * S, 1.2 * S, 6), this.glowMat,
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 10 * S, 2.2 * S);
    this.group.add(mouth);

    // The workbench: a landing ledge under the mouth with a lamp over it, so
    // the shop is somewhere you can SEE before you're told it exists.
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(16 * S, 0.8 * S, 6 * S),
      new THREE.MeshStandardMaterial({ color: 0x6b5334, roughness: 0.85 }),
    );
    ledge.position.set(0, 5.6 * S, 3.4 * S);
    this.group.add(ledge);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(1 * S, 5.4 * S, 1 * S),
        new THREE.MeshStandardMaterial({ color: 0x4d3b26, roughness: 0.9 }),
      );
      leg.position.set(s * 6.5 * S, 2.8 * S, 3.4 * S);
      this.group.add(leg);
    }
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c0, emissive: 0xffcc55, emissiveIntensity: 1.4, roughness: 0.4,
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9 * S, 10, 8), lampMat);
    lamp.position.set(0, 7.6 * S, 4.6 * S);
    this.group.add(lamp);

    this.group.position.copy(at);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    // Solid, at last. The hive used to be pure decoration, which meant the
    // camera slid inside it and the human could see straight through it —
    // and now that the workshop makes you HOVER here, both showed.
    // The box stops short of the mouth so flying salvage in still works.
    const { RAPIER, world } = physics;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(9.8 * S, 10.2 * S, 2.1 * S)
        .setTranslation(at.x, at.y + 10.4 * S, at.z - 1.8 * S),
    );
    // The workbench ledge is a landing pad: park salvage on it and the mouth
    // takes it, because the deposit radius reaches down here.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(8 * S, 0.4 * S, 3 * S)
        .setTranslation(at.x, at.y + 5.6 * S, at.z + 3.4 * S),
    );
  }

  /** Delivery point — slightly proud of the fence so you can fly into it. */
  mouthPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.position.x, this.position.y + 10 * S, this.position.z + 3 * S);
  }

  /** Quest and workshop payouts both land here. */
  credit(amount: number) {
    this.stored += amount;
    this.lifetime += amount;
  }

  /** Spending never touches `lifetime` — you did still bring it home. */
  spend(amount: number): boolean {
    if (amount > this.stored) return false;
    this.stored -= amount;
    return true;
  }

  /**
   * Anything salvage-flagged inside the mouth radius is absorbed. Works for
   * the player's tractor beam and for swarm bees identically — the hive
   * doesn't care who did the carrying.
   *
   * Returns what it took, in order, so quests can ask for a SPECIFIC thing.
   */
  tryDeposit(props: DynamicProp[], mouth: THREE.Vector3): SalvageKind[] {
    const taken: SalvageKind[] = [];
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
      this.lifetime += 1;
      if (p.kind) taken.push(p.kind);
    }
    return taken;
  }

  /** Close enough to the mouth to use the workbench. */
  nearMouth(p: THREE.Vector3, radius = M * 0.5): boolean {
    return Math.hypot(
      p.x - this.position.x,
      p.y - (this.position.y + 10 * S),
      p.z - (this.position.z + 3 * S),
    ) < radius;
  }

  update(dt: number) {
    this.pulse += dt;
    this.glowMat.emissiveIntensity = 0.75 + Math.sin(this.pulse * 2.4) * 0.25;
  }
}
