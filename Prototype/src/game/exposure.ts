import { params } from '../core/tuning';

// EXPOSURE — the difficulty curve, told as a story.
//
// It is deliberately REVERSIBLE. If the meter only climbed, players would stop
// using the fun toys to keep it down, which quietly kills the game. Break line
// of sight, drop into the grass, and the household talks itself back down.

export const EXPOSURE_LEVELS = [
  { name: 'NATURE', quote: '"just a bee"', at: 0 },
  { name: 'NUISANCE', quote: '"annoying bee"', at: 25 },
  { name: 'INFESTATION', quote: '"we have a problem"', at: 50 },
  { name: 'ANOMALY', quote: '"that bee has a LASER"', at: 75 },
  { name: 'SPECIES', quote: '"first contact"', at: 100 },
] as const;

export class Exposure {
  /** 0..100 */
  value = 0;
  private unseenFor = 0;

  get level(): number {
    let lvl = 0;
    for (let i = EXPOSURE_LEVELS.length - 1; i >= 0; i--) {
      if (this.value >= EXPOSURE_LEVELS[i].at) {
        lvl = i;
        break;
      }
    }
    return lvl;
  }

  get levelInfo() {
    return EXPOSURE_LEVELS[this.level];
  }

  update(dt: number, seen: boolean, techVisible: boolean) {
    const e = params.exposure;
    if (seen) {
      this.unseenFor = 0;
      this.value += (techVisible ? e.riseTech : e.riseSeen) * dt;
    } else {
      this.unseenFor += dt;
      if (this.unseenFor >= e.decayDelay) {
        this.value -= e.decay * dt;
      }
    }
    this.value = Math.max(0, Math.min(100, this.value));
  }

  /** One-off jolt: something happened that can't be explained away. */
  spike(amount: number) {
    this.value = Math.max(0, Math.min(100, this.value + amount));
    this.unseenFor = 0;
  }
}
