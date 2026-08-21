// REVERSE ENGINEERING — the half of the flywheel that pays you back.
//
// The loop only closes if stealing tech visibly BECOMES tech. Deposits feed a
// short ladder of unlocks, each one changing what the bee can do, so a battery
// hauled home is progress rather than a collectible.
//
// Deliberately auto-unlocking rather than a spend-menu: a shop would make this
// an economy, and the fantasy is reverse-engineering, not shopping.

export interface ResearchNode {
  id: string;
  name: string;
  cost: number; // total salvage delivered, not spent
  blurb: string;
}

export const RESEARCH: ResearchNode[] = [
  {
    id: 'swarm-beacon',
    name: 'Swarm Beacon',
    cost: 3,
    blurb: 'Throw it. Nearby bees converge and make themselves useful.',
  },
  {
    id: 'drone-wingman',
    name: 'Drone Wingman',
    cost: 7,
    blurb: 'A second bee, permanently on the payroll.',
  },
  {
    id: 'overdrive-ii',
    name: 'Overdrive Mk II',
    cost: 12,
    blurb: 'Wing overdrive runs hotter. Considerably hotter.',
  },
];

export class Research {
  unlocked = new Set<string>();
  onUnlock?: (node: ResearchNode) => void;

  /** The next thing to work toward, or null when the ladder is finished. */
  next(): ResearchNode | null {
    return RESEARCH.find((n) => !this.unlocked.has(n.id)) ?? null;
  }

  has(id: string): boolean {
    return this.unlocked.has(id);
  }

  /** Call whenever total delivered salvage changes. */
  evaluate(totalSalvage: number) {
    for (const node of RESEARCH) {
      if (this.unlocked.has(node.id)) continue;
      if (totalSalvage < node.cost) continue;
      this.unlocked.add(node.id);
      this.onUnlock?.(node);
    }
  }
}
