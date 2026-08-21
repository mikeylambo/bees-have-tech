import type RAPIER_API from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/physics';
import type { AimResult } from './aiming';

// THE TECH SYSTEM — how a bee with a growing arsenal actually reaches it.
//
// The wearable pillar sets the rule: a bee can only WEAR so much. The hive can
// research twenty gadgets; the bee flies with what fits on its back. So tech is
// a swappable list reached through a radial, not a button per gadget — a
// controller runs out of buttons long before the tech tree runs out of ideas.
//
// Split of responsibilities:
//   innate  — flight, wing overdrive, stinger. Part of the bee's body.
//   tech    — everything else, one active at a time, one button to use it.

export interface TechContext {
  physics: Physics;
  beePos: THREE.Vector3;
  aim: AimResult;
  beeCollider: RAPIER_API.Collider;
  dt: number;
}

export interface TechItem {
  readonly id: string;
  readonly name: string;
  /** Shown in the radial and the HUD strip. */
  readonly icon: string;
  /** One line, shown in the radial while highlighted. */
  readonly blurb: string;

  useStart?(ctx: TechContext): void;
  useHold?(ctx: TechContext): void;
  useEnd?(ctx: TechContext): void;
  /** Secondary action — throw, detach, alt-fire. */
  altUse?(ctx: TechContext): void;
  /** Called when swapped away from; drop anything held. */
  unequip?(): void;
  /** Drives the reticle: 'engaged' when actively doing something. */
  status?(): 'idle' | 'engaged';
}

/**
 * Holds everything researched. Deliberately NOT slot-capped yet — how much a
 * bee can wear at once depends on what the gadgets turn out to do, and that's
 * not knowable until they exist. When we do cap it, it's a filter over this
 * list (researched vs. worn), not a rewrite: the radial shows worn items, the
 * hive picks which ones those are.
 */
export class TechBelt {
  private items: TechItem[] = [];
  activeIndex = 0;

  add(item: TechItem) {
    this.items.push(item);
  }

  get all(): readonly TechItem[] {
    return this.items;
  }

  get active(): TechItem | null {
    return this.items[this.activeIndex] ?? null;
  }

  /** Swapping puts away whatever the old tool was holding. */
  select(index: number) {
    if (index === this.activeIndex) return;
    if (index < 0 || index >= this.items.length) return;
    this.active?.unequip?.();
    this.activeIndex = index;
  }

  cycle(delta: number) {
    if (this.items.length === 0) return;
    const n = this.items.length;
    this.select((((this.activeIndex + delta) % n) + n) % n);
  }
}
