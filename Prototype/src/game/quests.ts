import * as THREE from 'three';
import type { SalvageKind } from '../world/yard';
import { SALVAGE_LABEL } from '../world/yard';
import type { ApplianceKind } from '../world/appliances';

// QUESTS — the framing device, per the pillar: "missions are framing devices
// and punchlines; the sandbox generates the actual comedy."
//
// So this is deliberately thin. A quest names a thing to do and points at
// where to do it; it never scripts HOW. Every objective below is satisfied by
// systems that already existed and didn't know about each other — deliver a
// battery, flip a switch, get water onto a live zapper. The quest just
// notices.
//
// One active at a time. A list of six open objectives is a checklist screen,
// and a checklist screen is the thing this game is least trying to be.

export type ObjectiveKind = 'deliver' | 'visit' | 'hack' | 'build' | 'event';

export interface Objective {
  kind: ObjectiveKind;
  text: string;
  need: number;
  have: number;
  /** deliver: which salvage counts. */
  salvage?: SalvageKind;
  /** hack: which appliance counts. */
  appliance?: ApplianceKind;
  /** event: an arbitrary tag main fires when something notable happens. */
  tag?: string;
  /** visit: fly within `radius` of this point. */
  at?: THREE.Vector3;
  radius?: number;
  /** Where the waypoint points while this objective is open. */
  marker?: THREE.Vector3;
  markerLabel?: string;
}

export interface QuestReward {
  salvage?: number;
  blueprints?: string[];
  text: string;
}

export interface Quest {
  id: string;
  title: string;
  giver: string;
  pitch: string;
  /** Where to look, when the objective can't say it with a waypoint. */
  hint?: string;
  objectives: Objective[];
  reward: QuestReward;
}

export interface QuestWorld {
  hive: THREE.Vector3;
  sprinkler: THREE.Vector3;
  zapper: THREE.Vector3;
  deck: THREE.Vector3;
  shed: THREE.Vector3;
}

const deliver = (
  salvage: SalvageKind, need: number, hive: THREE.Vector3,
): Objective => ({
  kind: 'deliver',
  text: `Deliver ${need} ${SALVAGE_LABEL[salvage]}${need > 1 ? 's' : ''} to the hive`,
  need,
  have: 0,
  salvage,
  marker: hive,
  markerLabel: 'HIVE',
});

export function buildQuests(w: QuestWorld): Quest[] {
  return [
    {
      id: 'homecoming',
      title: 'Home Base',
      giver: 'THE HIVE',
      pitch: 'Something in the back fence is humming. That would be everyone you know.',
      objectives: [{
        kind: 'visit',
        text: 'Find the hive in the back fence',
        need: 1,
        have: 0,
        at: w.hive,
        radius: 18,
        marker: w.hive,
        markerLabel: 'HIVE',
      }],
      reward: {
        blueprints: ['beacon'],
        text: 'The hive can build a Swarm Beacon — if you can pay for it.',
      },
    },
    {
      id: 'batteries',
      title: 'Batteries Not Included',
      giver: 'THE HIVE',
      pitch: 'Anything with a charge left in it, we can take apart. Bring three.',
      hint: 'Batteries die where the tools live — around the shed.',
      objectives: [deliver('battery', 3, w.hive)],
      reward: {
        salvage: 3,
        blueprints: ['harness'],
        text: '+3 salvage · Blueprint: Cargo Harness',
      },
    },
    {
      id: 'workshop',
      title: 'Make Something of Yourself',
      giver: 'THE HIVE',
      pitch: 'Salvage is not a trophy. Come home and spend it on something you can wear.',
      hint: 'Hover at the hive mouth and press R (or Y) to open the workshop.',
      objectives: [{
        kind: 'build',
        text: 'Build anything at the hive workshop',
        need: 1,
        have: 0,
        marker: w.hive,
        markerLabel: 'WORKSHOP',
      }],
      reward: {
        blueprints: ['filament'],
        text: 'Blueprint: Long-Line Filament',
      },
    },
    {
      id: 'boards',
      title: 'Board Meeting',
      giver: 'THE HIVE',
      pitch: 'Green boards with gold lines on them. Four. Do not ask what they do.',
      hint: 'Scattered across the open lawn.',
      objectives: [deliver('board', 4, w.hive)],
      reward: {
        salvage: 3,
        blueprints: ['wingman'],
        text: '+3 salvage · Blueprint: Drone Wingman',
      },
    },
    {
      id: 'caps',
      title: 'Bottle Service',
      giver: 'THE HIVE',
      pitch: 'Three bottle caps. Stamped steel, perfectly good, and they left them lying about.',
      hint: 'Up on the deck, where the drinks were.',
      objectives: [deliver('cap', 3, w.hive)],
      reward: {
        salvage: 3,
        blueprints: ['cloak'],
        text: '+3 salvage · Blueprint: Pollen Cloak',
      },
    },
    {
      id: 'waterworks',
      title: 'Weather Machine',
      giver: 'THE HIVE',
      pitch: 'Turn the water on. Then turn the blue light on. Then stand somewhere else.',
      hint: 'Water reaching a live bug zapper does something the manual does not mention.',
      objectives: [
        {
          kind: 'hack',
          text: 'Hack the sprinkler',
          need: 1,
          have: 0,
          appliance: 'sprinkler',
          marker: w.sprinkler,
          markerLabel: 'SPRINKLER',
        },
        {
          kind: 'event',
          text: 'Electrify the puddle',
          need: 1,
          have: 0,
          tag: 'electrified',
          marker: w.zapper,
          markerLabel: 'ZAPPER',
        },
      ],
      reward: {
        salvage: 4,
        blueprints: ['antenna'],
        text: '+4 salvage · Blueprint: Antenna Mk II',
      },
    },
    {
      id: 'firstcontact',
      title: 'Considerably Hotter',
      giver: 'THE HIVE',
      pitch: 'One last thing. Remind him whose yard this is.',
      hint: 'The stinger is not tech. It came with the bee.',
      objectives: [{
        kind: 'event',
        text: 'Sting the human',
        need: 1,
        have: 0,
        tag: 'sting-human',
      }],
      reward: {
        salvage: 4,
        blueprints: ['overdrive'],
        text: '+4 salvage · Blueprint: Overdrive Mk II',
      },
    },
  ];
}

const _d = new THREE.Vector3();

export class QuestLog {
  private quests: Quest[];
  private index = 0;
  /** Counts down after a completion before the next quest is offered. */
  private handoff = 0;
  /** Things you did before anyone asked you to. See `record`. */
  private backlog = new Map<string, number>();
  finished = false;

  onOffer?: (q: Quest) => void;
  onProgress?: (q: Quest, o: Objective) => void;
  onComplete?: (q: Quest) => void;

  constructor(quests: Quest[]) {
    this.quests = quests;
  }

  get active(): Quest | null {
    if (this.finished || this.handoff > 0) return null;
    return this.quests[this.index] ?? null;
  }

  get completedCount(): number {
    return this.index;
  }

  get total(): number {
    return this.quests.length;
  }

  /** Offer the opening quest. Separate from the constructor so the UI exists. */
  begin() {
    this.offerCurrent();
  }

  update(dt: number) {
    if (this.handoff <= 0) return;
    this.handoff -= dt;
    if (this.handoff > 0) return;
    this.handoff = 0;
    this.offerCurrent();
  }

  private offerCurrent() {
    const q = this.active;
    if (!q) return;
    // Credit anything already done BEFORE showing the card, so a quest you
    // accidentally half-finished opens reading 2/3 rather than 0/3.
    this.drainBacklog();
    // ...and if the backlog finished it outright, the completion path has
    // already taken over. Don't pitch a quest that's already done.
    if (this.active !== q) return;
    this.onOffer?.(q);
  }

  /** The objective the waypoint should point at right now. */
  marker(): { point: THREE.Vector3; label: string } | null {
    const o = this.currentObjective();
    if (!o?.marker) return null;
    return { point: o.marker, label: o.markerLabel ?? '' };
  }

  /** First unfinished objective of the active quest. */
  currentObjective(): Objective | null {
    const q = this.active;
    if (!q) return null;
    return q.objectives.find((o) => o.have < o.need) ?? null;
  }

  // ---- event hooks. Each one just counts; nothing here knows a system. ----

  deliver(kind: SalvageKind | undefined) {
    this.record(`deliver:${kind ?? 'any'}`);
  }

  hacked(kind: ApplianceKind) {
    this.record(`hack:${kind}`);
  }

  built() {
    this.record('build');
  }

  event(tag: string) {
    this.record(`event:${tag}`);
  }

  /** Called every frame with the bee's position, for 'visit' objectives. */
  checkVisit(beePos: THREE.Vector3) {
    const q = this.active;
    if (!q) return;
    const o = this.currentObjective();
    if (!o || o.kind !== 'visit' || !o.at) return;
    if (_d.subVectors(beePos, o.at).length() > (o.radius ?? 12)) return;
    this.advance(q, o);
  }

  /** The event key an objective is waiting for, or null if it isn't one. */
  private static key(o: Objective): string | null {
    switch (o.kind) {
      case 'deliver': return `deliver:${o.salvage ?? 'any'}`;
      case 'hack': return `hack:${o.appliance}`;
      case 'build': return 'build';
      case 'event': return `event:${o.tag}`;
      default: return null; // 'visit' is position-polled, never banked
    }
  }

  /**
   * Anything you did BEFORE being asked still counts.
   *
   * Without this, hauling three batteries home during the 3.4s gap between
   * quests eats them — the salvage is consumed and the objective never sees
   * it. With five batteries in the yard and a quest asking for three, that is
   * a softlock you'd hit by playing well. So unmatched events go in a backlog
   * and the next quest drains it the moment it opens.
   */
  private record(key: string) {
    if (this.applyTo(key)) return;
    this.backlog.set(key, (this.backlog.get(key) ?? 0) + 1);
  }

  /**
   * Objectives are ORDERED: only the first unfinished one can advance. It
   * keeps a two-step quest ("hack the sprinkler, then electrify the puddle")
   * from being satisfied backwards by a chain that happened by accident.
   */
  private applyTo(key: string, quiet = false): boolean {
    const q = this.active;
    if (!q) return false;
    const o = this.currentObjective();
    if (!o || QuestLog.key(o) !== key) return false;
    this.advance(q, o, quiet);
    return true;
  }

  private advance(q: Quest, o: Objective, quiet = false) {
    o.have = Math.min(o.need, o.have + 1);
    if (!quiet) this.onProgress?.(q, o);
    if (q.objectives.every((x) => x.have >= x.need)) this.complete(q);
  }

  /** Pay the backlog into a freshly opened quest, silently. */
  private drainBacklog() {
    // Bounded: every iteration either consumes a backlog entry or stops.
    for (let guard = 0; guard < 64; guard++) {
      const o = this.currentObjective();
      if (!o) return;
      const key = QuestLog.key(o);
      if (!key) return;
      const n = this.backlog.get(key) ?? 0;
      if (n <= 0) return;
      this.backlog.set(key, n - 1);
      if (!this.applyTo(key, true)) return;
    }
  }

  private complete(q: Quest) {
    this.onComplete?.(q);
    this.index++;
    if (this.index >= this.quests.length) {
      this.finished = true;
      return;
    }
    // Let the completion banner land before the next pitch shows up.
    this.handoff = 3.4;
  }
}
