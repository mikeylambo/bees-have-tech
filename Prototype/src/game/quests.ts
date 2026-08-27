import * as THREE from 'three';
import type { SalvageKind } from '../world/props';
import { SALVAGE_LABEL } from '../world/props';
import type { ApplianceKind } from '../world/appliances';
import { M } from '../world/estateBlockout';

/**
 * How close counts as "you got there", in metres of world. Generous on
 * purpose: on a 90 x 120 m property arriving at a 55 cm sphere while cruising
 * at 3.4 m/s is a precision task nobody asked for.
 */
const ARRIVE_R = M * 1.6;

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
  /**
   * Where the THING IS, as opposed to where it goes. On a 90 x 120 m estate
   * "deliver 4 boards" is not a task until you know boards live in the
   * potting shed, so the waypoint points at the source until the first one
   * lands, then turns round and points home.
   */
  findAt?: THREE.Vector3;
  findLabel?: string;
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
  /** Where each kind of salvage actually lives, so quests can send you there. */
  firepit: THREE.Vector3;
  playground: THREE.Vector3;
  service: THREE.Vector3;
  pottingShed: THREE.Vector3;
}

const deliver = (
  salvage: SalvageKind, need: number, hive: THREE.Vector3,
  findAt?: THREE.Vector3, findLabel?: string,
): Objective => ({
  kind: 'deliver',
  text: `Deliver ${need} ${SALVAGE_LABEL[salvage]}${need > 1 ? 's' : ''} to the hive`,
  need,
  have: 0,
  salvage,
  marker: hive,
  markerLabel: 'HIVE',
  findAt,
  findLabel,
});

export function buildQuests(w: QuestWorld): Quest[] {
  return [
    {
      id: 'homecoming',
      title: 'Home Base',
      giver: 'THE HIVE',
      pitch: 'Something in the west gate pillar is humming. That would be everyone you know.',
      objectives: [{
        kind: 'visit',
        text: 'Find the hive in the gate pillar',
        need: 1,
        have: 0,
        at: w.hive,
        radius: ARRIVE_R,
        marker: w.hive,
        markerLabel: 'HIVE',
      }],
      reward: {
        blueprints: ['beacon'],
        text: 'The hive can build a Swarm Beacon — if you can pay for it.',
      },
    },
    {
      id: 'caps',
      title: 'Bottle Service',
      giver: 'THE HIVE',
      pitch: 'Three bottle caps. Stamped steel, perfectly good, and they left them lying about.',
      hint: 'Somebody was drinking at the fire pit. Somebody always is.',
      objectives: [deliver('cap', 3, w.hive, w.firepit, 'FIRE PIT')],
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
      id: 'screws',
      title: 'Loose Fittings',
      giver: 'THE HIVE',
      pitch: 'The big climbing frame is held together with our next four projects.',
      hint: 'Under the playground, on the east lawn. Mind the child.',
      objectives: [deliver('screw', 4, w.hive, w.playground, 'PLAYGROUND')],
      reward: {
        salvage: 6,
        text: '+6 salvage · nothing new to learn, just a very good payday',
      },
    },
    {
      id: 'batteries',
      title: 'Batteries Not Included',
      giver: 'THE HIVE',
      pitch: 'Anything with a charge left in it, we can take apart. Bring three.',
      hint: 'The service yard, behind the garage. That is the far end of the drive.',
      objectives: [deliver('battery', 3, w.hive, w.service, 'SERVICE YARD')],
      reward: {
        salvage: 3,
        blueprints: ['wingman'],
        text: '+3 salvage · Blueprint: Drone Wingman',
      },
    },
    {
      id: 'boards',
      title: 'Board Meeting',
      giver: 'THE HIVE',
      pitch: 'Green boards with gold lines on them. Four. Do not ask what they do.',
      hint: 'The potting shed is four square metres of other people\'s useful rubbish.',
      objectives: [deliver('board', 4, w.hive, w.pottingShed, 'POTTING SHED')],
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
      hint: 'Both are at the south end of the pool terrace.',
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
      pitch: 'One last thing. Remind them whose property this is.',
      hint: 'The stinger is not tech. It came with the bee.',
      objectives: [{
        kind: 'event',
        text: 'Sting somebody',
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

/** The shell's view of quest progress. Position only, never content. */
export interface QuestSave {
  index: number;
  finished: boolean;
  have: number[][];
  backlog: Array<[string, number]>;
}

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

  /** Read-only view of the chain, for the Journal. Content, never mutation. */
  all(): readonly Quest[] {
    return this.quests;
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
    if (!o) return null;
    // Send them to the source first. Once one has been delivered they know
    // where home is, and the useful arrow is the one pointing back at it.
    if (o.findAt && o.have === 0) {
      return { point: o.findAt, label: o.findLabel ?? 'LOOK HERE' };
    }
    if (!o.marker) return null;
    return { point: o.marker, label: o.markerLabel ?? '' };
  }

  /** First unfinished objective of the active quest. */
  currentObjective(): Objective | null {
    const q = this.active;
    if (!q) return null;
    return q.objectives.find((o) => o.have < o.need) ?? null;
  }

  // ---- persistence. Additive: the shell reads and writes position, never
  // content. What a quest IS lives in buildQuests() and the shell never sees
  // it — this is only where you had got to. ----

  /** Everything the shell needs to put the log back exactly as it was. */
  snapshot(): QuestSave {
    return {
      index: this.index,
      finished: this.finished,
      // The handoff is deliberately NOT saved. It is a 3.4 s pause so a
      // completion banner can land; restoring mid-pause would open a save on
      // a blank quest log for no reason.
      have: this.quests.map((q) => q.objectives.map((o) => o.have)),
      backlog: [...this.backlog.entries()],
    };
  }

  /**
   * Put the log back. Returns false if the save does not describe THIS chain —
   * a quest added or removed since it was written — in which case the caller
   * discards rather than half-restoring somebody into a chain that moved.
   */
  restore(save: QuestSave): boolean {
    if (!Array.isArray(save.have) || save.have.length !== this.quests.length) return false;
    for (let i = 0; i < this.quests.length; i++) {
      const row = save.have[i];
      if (!Array.isArray(row) || row.length !== this.quests[i].objectives.length) return false;
    }
    if (typeof save.index !== 'number' || save.index < 0 || save.index > this.quests.length) {
      return false;
    }
    for (let i = 0; i < this.quests.length; i++) {
      this.quests[i].objectives.forEach((o, j) => {
        o.have = Math.max(0, Math.min(o.need, save.have[i][j] | 0));
      });
    }
    this.index = save.index;
    this.finished = !!save.finished;
    this.handoff = 0;
    this.backlog = new Map(save.backlog ?? []);
    return true;
  }

  /** Re-offer whatever is current, without re-crediting the backlog. */
  resume() {
    const q = this.active;
    if (!q) return;
    this.onOffer?.(q);
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
    if (_d.subVectors(beePos, o.at).length() > (o.radius ?? ARRIVE_R)) return;
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
