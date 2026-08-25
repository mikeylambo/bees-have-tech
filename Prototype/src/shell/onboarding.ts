import * as THREE from 'three';
import { params } from '../core/tuning';

// ONBOARDING — three lines, once each, ever.
//
// The game already teaches by doing: the quest card names the thing, the
// waypoint points at it, the exposure bar names who is looking. What none of
// those cover is the three facts a new bee learns the hard way, and each one
// is a fact that only lands if you are told it AT THE MOMENT IT IS TRUE:
//
//   1. the hive eats salvage — said the first time you are hovering at it
//   2. the grass hides you   — said the first time you are actually hidden
//   3. hold X if you're stuck — said the first time you look stuck
//
// Fired once and remembered across a refresh, which is why the taught set is
// part of the save rather than a page-lifetime variable. They reuse the quest
// HUD's toast: a second notification system for three strings would be the
// definition of over-building.

/** How long the bee has to be barely moving, and low, before we offer a hand. */
const STUCK_TIME = 7;
const STUCK_SPEED = 6; // units/sec — about 10 cm/s. Hovering is faster than this.

export interface OnboardingSignals {
  /** Hovering in front of the hive mouth. */
  atHive: boolean;
  /** Somebody can see the bee's position right now. */
  watched: boolean;
  beePos: THREE.Vector3;
  speed: number;
}

export class Onboarding {
  private stuckT = 0;

  /** `say` returns true if the line was actually new. */
  constructor(private say: (id: string, line: string) => boolean) {}

  update(dt: number, s: OnboardingSignals) {
    if (s.atHive) {
      this.say('hive', 'This is home. Fly salvage into the mouth to bank it.');
    }

    // Only worth saying while somebody is actually looking — told at any other
    // moment it is a rule; told here it is an escape you just used.
    if (s.watched && s.beePos.y < params.human.grassConcealHeight) {
      this.say('grass', 'Below the grass line, they lose you.');
    }

    // "You look stuck" has to be earned, or it fires at every hover. Barely
    // moving, near the ground, for seven seconds — and the hive prompt gets
    // priority, because being parked at the shop is not being stuck.
    const low = s.beePos.y < params.human.height * 0.6;
    if (!s.atHive && low && s.speed < STUCK_SPEED) {
      this.stuckT += dt;
      if (this.stuckT >= STUCK_TIME) {
        this.stuckT = 0;
        this.say('stuck', 'Wedged? Hold X — or Back on a pad — to come home.');
      }
    } else {
      this.stuckT = 0;
    }
  }
}
