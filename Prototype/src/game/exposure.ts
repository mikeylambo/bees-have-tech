import { params } from '../core/tuning';

// EXPOSURE — the difficulty curve, told as a story.
//
// It is deliberately REVERSIBLE. If the meter only climbed, players would stop
// using the fun toys to keep it down, which quietly kills the game. Break line
// of sight, drop into the grass, and the household talks itself back down.
//
// M8 makes "the household talks itself back down" literal. The rise is no
// longer a constant: it's the signed sum of who is watching, multiplied by
// the calmest voice among them. A watcher with negative suspicion (the kid,
// who is covering for you) drives the meter DOWN while looking straight at
// you — being seen by the right person is now a hiding place.

/**
 * The five rungs, and what the household files you under at each.
 *
 * Each one is a different REGISTER rather than a stronger adjective, which is
 * what makes the ladder read as escalation instead of as a volume knob:
 * irritating -> harmful -> inexplicable -> dangerous. The quotes are what a
 * person would actually say at that rung, because the meter is their opinion
 * and not a score.
 */
export const EXPOSURE_LEVELS = [
  { name: 'NATURAL', quote: '"just a bee"', at: 0 },
  { name: 'NUISANCE', quote: '"shoo"', at: 25 },
  { name: 'MENACE', quote: '"it is doing that on purpose"', at: 50 },
  { name: 'ANOMALY', quote: '"that bee has a LASER"', at: 75 },
  { name: 'THREAT', quote: '"who do we call about this"', at: 100 },
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

  /**
   * @param suspicion signed multiplier on the rise — the household's summed
   *   opinion. 1 is the old lone-human behaviour. Negative pulls the meter down.
   * @param dampen multiplies a POSITIVE rise only. Talking the yard down can
   *   slow an accusation; it can't turn one into an alibi.
   */
  update(
    dt: number,
    seen: boolean,
    techVisible: boolean,
    suspicion = 1,
    dampen = 1,
  ) {
    const e = params.exposure;
    if (seen) {
      this.unseenFor = 0;
      const rate = (techVisible ? e.riseTech : e.riseSeen) * suspicion;
      this.value += (rate > 0 ? rate * dampen : rate) * dt;
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
