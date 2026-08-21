import type { TechItem, TechContext } from './tech';
import type { Grapple } from './grapple';
import type { Carry } from './carry';
import type { Swarm } from './swarm';
import { params } from '../core/tuning';

// Grapple and tractor beam used to be the same verb wearing two hats: both
// "attach to a thing", with the mass ratio silently deciding who moved. Split
// hard so each is worth a slot:
//
//   Grappling Cable — TRAVERSAL. Anchors to world geometry and anything too
//                     heavy to lift. Moves YOU. Never picks anything up.
//   Tractor Beam    — MANIPULATION. Lifts, holds, throws light things.
//                     Never moves you.
//
// The threshold that separates them is the same `carry.maxMass` the tractor
// beam already uses, so there is exactly one number deciding "light or heavy"
// and the two tools can never both claim the same object.

export function grappleTech(grapple: Grapple): TechItem {
  return {
    id: 'grapple',
    name: 'Grappling Cable',
    icon: '🪝',
    blurb: 'Anchor and swing. Traversal only.',
    useStart(ctx: TechContext) {
      if (grapple.state !== 'idle') return;
      // Refuse light objects — that's the tractor beam's job.
      const b = ctx.aim.body;
      if (b && b.isDynamic() && b.mass() <= params.carry.maxMass) return;
      grapple.fire(ctx.beePos, ctx.aim.dirFromBee, ctx.beeCollider);
    },
    useHold(ctx: TechContext) {
      grapple.reel(ctx.dt, true);
    },
    useEnd() {
      if (grapple.state !== 'idle') grapple.release();
    },
    unequip() {
      if (grapple.state !== 'idle') grapple.release();
    },
    status() {
      return grapple.state === 'idle' ? 'idle' : 'engaged';
    },
  };
}

/**
 * One verb for the player — throw it — with the bees reading context
 * underneath. Same rule the appliances follow: complexity lives in the
 * overlap, never in the interface.
 */
export function beaconTech(swarm: Swarm): TechItem {
  return {
    id: 'beacon',
    name: 'Swarm Beacon',
    icon: '🟡',
    blurb: 'Throw it. Bees converge, then find their own job.',
    useStart(ctx: TechContext) {
      swarm.placeBeacon(ctx.aim.point);
    },
    status() {
      return swarm.distracting ? 'engaged' : 'idle';
    },
  };
}

export function tractorTech(carry: Carry): TechItem {
  return {
    id: 'tractor',
    name: 'Tractor Beam',
    icon: '🔵',
    blurb: 'Lift, carry and throw light objects.',
    useStart(ctx: TechContext) {
      if (carry.isCarrying) return;
      carry.tryGrab(ctx.physics, ctx.beePos, ctx.aim.dirFromBee, ctx.beeCollider);
    },
    useEnd() {
      if (carry.isCarrying) carry.drop();
    },
    altUse(ctx: TechContext) {
      if (carry.isCarrying) carry.throwIt(ctx.aim.dirFromBee);
    },
    unequip() {
      if (carry.isCarrying) carry.drop();
    },
    status() {
      return carry.isCarrying ? 'engaged' : 'idle';
    },
  };
}
