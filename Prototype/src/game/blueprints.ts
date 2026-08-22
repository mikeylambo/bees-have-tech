import { params } from '../core/tuning';

// THE HIVE WORKSHOP — where salvage stops being a score and becomes a choice.
//
// M4 auto-unlocked tech at fixed salvage totals, deliberately: a spend-menu
// makes this an economy, and the fantasy is reverse-engineering, not shopping.
// That reasoning still holds for a MENU. It doesn't hold for a PLACE.
//
// So the shop is diegetic and it costs you something to reach: the catalog
// only opens at the hive, with the bee hovering in front of it, in the middle
// of the world where a human can still walk up. You are never lifted out of
// the body — which is the actual pillar. "No RTS camera. Ever."
//
// Division of labour with the quest log:
//   quests  decide WHAT IS AVAILABLE — a blueprint is knowledge, and knowledge
//           comes from doing something in the yard
//   the shop decides WHAT GETS BUILT — salvage is finite, so wearing one thing
//           means not wearing another
//
// Total catalog cost is tuned just above what a careless run collects. Running
// out is the design, not a shortfall.

export interface BuildContext {
  /** Add a belt item by blueprint id. Main owns what that actually means. */
  addTech: (id: string) => void;
  /** Put another bee on the payroll. */
  recruitBee: () => void;
}

export interface Blueprint {
  id: string;
  name: string;
  icon: string;
  cost: number;
  /** One line in the shop row: what it does to you. */
  effect: string;
  /** The joke, shown when highlighted. */
  blurb: string;
  build: (ctx: BuildContext) => void;
}

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'beacon',
    name: 'Swarm Beacon',
    icon: '🟡',
    cost: 3,
    effect: 'New tech · throw it, bees converge',
    blurb: 'Throw it. Nearby bees converge and make themselves useful.',
    build(ctx) {
      ctx.addTech('beacon');
      ctx.recruitBee();
    },
  },
  {
    id: 'harness',
    name: 'Cargo Harness',
    icon: '🎒',
    cost: 4,
    effect: 'Lift 80% heavier · half the haul drag',
    blurb: 'Load-bearing webbing. The bee is now a forklift with wings.',
    build() {
      params.carry.maxMass *= 1.8;
      params.carry.haulPenalty *= 0.5;
    },
  },
  {
    id: 'filament',
    name: 'Long-Line Filament',
    icon: '🧵',
    cost: 4,
    effect: 'Grapple +70 range · faster reel',
    blurb: 'More cable on the spool. The fence is now a shortcut.',
    build() {
      params.grapple.range += 70;
      params.grapple.reelSpeed += 8;
    },
  },
  {
    id: 'wingman',
    name: 'Drone Wingman',
    icon: '🐝',
    cost: 5,
    effect: 'A second bee, permanently',
    blurb: 'A second bee, permanently on the payroll.',
    build(ctx) {
      ctx.recruitBee();
      ctx.recruitBee();
    },
  },
  {
    id: 'cloak',
    name: 'Pollen Cloak',
    icon: '🌾',
    cost: 5,
    effect: 'Noticed 40% slower · hide in taller grass',
    blurb: 'You are covered in pollen. You are, technically, a flower.',
    build() {
      params.exposure.riseSeen *= 0.6;
      params.exposure.riseTech *= 0.6;
      params.human.grassConcealHeight += 2.2;
    },
  },
  {
    id: 'antenna',
    name: 'Antenna Mk II',
    icon: '📡',
    cost: 6,
    effect: 'Hack from clear across the yard · nearly twice as fast',
    blurb: 'Hack it from across the lawn, before anyone looks up.',
    build() {
      params.hack.range += 110;
      params.hack.time *= 0.55;
    },
  },
  {
    id: 'overdrive',
    name: 'Overdrive Mk II',
    icon: '🔥',
    cost: 8,
    effect: 'Wing overdrive runs 50% hotter',
    blurb: 'Wing overdrive runs hotter. Considerably hotter.',
    build() {
      params.flight.boostMul *= 1.5;
    },
  },
];

export function blueprintById(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}

/**
 * What the hive knows how to make, what it has made, and what it can afford.
 * Salvage lives on the Hive; this only ever asks it to spend.
 */
export class Workshop {
  /** Blueprints the hive has figured out. Quests hand these over. */
  readonly known = new Set<string>();
  readonly built = new Set<string>();

  onLearn?: (bp: Blueprint) => void;
  onBuild?: (bp: Blueprint) => void;

  /** Fires when a quest teaches the hive something new. */
  learn(id: string): boolean {
    const bp = blueprintById(id);
    if (!bp || this.known.has(id)) return false;
    this.known.add(id);
    this.onLearn?.(bp);
    return true;
  }

  /** Catalog rows, in cost order, cheapest first — known ones only. */
  catalog(): Blueprint[] {
    return BLUEPRINTS.filter((b) => this.known.has(b.id));
  }

  canBuild(id: string, salvage: number): boolean {
    const bp = blueprintById(id);
    if (!bp) return false;
    return this.known.has(id) && !this.built.has(id) && salvage >= bp.cost;
  }

  /**
   * Spend and build. Returns the cost so the caller can debit the hive — the
   * workshop never reaches into the bank itself.
   */
  build(id: string, salvage: number, ctx: BuildContext): number {
    if (!this.canBuild(id, salvage)) return 0;
    const bp = blueprintById(id)!;
    this.built.add(id);
    bp.build(ctx);
    this.onBuild?.(bp);
    return bp.cost;
  }
}
