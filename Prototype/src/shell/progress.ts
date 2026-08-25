import type { QuestLog, QuestSave } from '../game/quests';
import type { Workshop, BuildContext } from '../game/blueprints';
import { blueprintById } from '../game/blueprints';
import type { Hive } from '../game/hive';
import type { Exposure } from '../game/exposure';
import type { TechBelt } from '../bee/tech';

// PROGRESS — what survives a refresh.
//
// Kept deliberately separate from the dev tuning store (`bht.settings.v4`):
// one is a designer's tuning file with a designer's lifetime, the other is a
// player's save. Merging them would mean a player's run dying every time a
// slider's meaning changed.
//
// What is NOT here is as considered as what is. No prop positions, no
// household positions, no appliance states, no bee position. A save that
// restores where every pebble was is a format that breaks every time the yard
// changes, in exchange for a fidelity nobody asked for. The world reshuffles;
// your PROGRESS is what persists.

const KEY = 'bees-progress-v1';
const VERSION = 1;

export interface ProgressSave {
  v: number;
  quests: QuestSave;
  /** Blueprint ids the hive has figured out, and the ones it has built. */
  known: string[];
  built: string[];
  /** Spendable salvage, and the lifetime total that never goes down. */
  stored: number;
  lifetime: number;
  exposure: number;
  /** Which belt slot was equipped. */
  beltIndex: number;
  /** Teach-once lines that have already fired. */
  taught: string[];
}

export interface ProgressWorld {
  quests: QuestLog;
  workshop: Workshop;
  hive: Hive;
  exposure: Exposure;
  belt: TechBelt;
  taught: Set<string>;
}

export function captureProgress(w: ProgressWorld): ProgressSave {
  return {
    v: VERSION,
    quests: w.quests.snapshot(),
    known: [...w.workshop.known],
    built: [...w.workshop.built],
    stored: w.hive.stored,
    lifetime: w.hive.lifetime,
    exposure: w.exposure.value,
    beltIndex: w.belt.activeIndex,
    taught: [...w.taught],
  };
}

/** Read the blob without applying it — the title screen needs to know if one exists. */
export function readProgress(): ProgressSave | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // private mode, blocked storage — play without a save
  }
  if (!raw) return null;
  try {
    const save = JSON.parse(raw) as ProgressSave;
    // Version mismatch DISCARDS. It never migrates: shipping a migration path
    // for a save format nobody has played is inventing work, and being free to
    // change the format is worth more than one prototype's runs.
    if (!save || save.v !== VERSION) return null;
    if (!save.quests || !Array.isArray(save.known) || !Array.isArray(save.built)) return null;
    if (typeof save.stored !== 'number' || typeof save.exposure !== 'number') return null;
    return save;
  } catch {
    return null; // corrupt blob: silently gone, and the player gets a new game
  }
}

export function hasProgress(): boolean {
  return readProgress() !== null;
}

/**
 * Put a run back. MUST run after the world is built and BEFORE quests.begin(),
 * or a returning player gets pitched quest 1 again on top of the quest they
 * were actually on.
 *
 * Returns false if the blob does not describe this build's quest chain, in
 * which case nothing has been applied and the caller starts fresh.
 */
export function applyProgress(
  save: ProgressSave, w: ProgressWorld, ctx: BuildContext,
): boolean {
  if (!w.quests.restore(save.quests)) return false;

  for (const id of save.known) w.workshop.learn(id);

  // Built blueprints are restored by REPLAYING build(), not by storing their
  // effects. Upgrades are multiplicative over the shipped defaults (M5), so
  // replaying from a fresh page is exact — and it is the only way the belt
  // items and the recruited bees come back too.
  for (const id of save.built) {
    const bp = blueprintById(id);
    if (!bp || w.workshop.built.has(id)) continue;
    w.workshop.built.add(id);
    bp.build(ctx);
  }

  w.hive.stored = Math.max(0, save.stored | 0);
  w.hive.lifetime = Math.max(w.hive.stored, save.lifetime | 0);
  w.exposure.value = Math.max(0, Math.min(100, save.exposure));
  w.belt.select(Math.max(0, save.beltIndex | 0));
  for (const line of save.taught ?? []) w.taught.add(line);
  return true;
}

export function writeProgress(w: ProgressWorld) {
  try {
    localStorage.setItem(KEY, JSON.stringify(captureProgress(w)));
  } catch {
    // Quota or private mode. A run that cannot be saved is still a run worth
    // playing, and there is nothing useful to say about it mid-flight.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
}

/**
 * Saving on every salvage pickup would be a write per second. Saving only on
 * unload loses the run to a crash. This coalesces: something changed, write it
 * a moment later, and collapse a burst into one write.
 */
export class ProgressWriter {
  private timer: number | undefined;

  constructor(private world: ProgressWorld, private delayMs = 900) {}

  touch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => writeProgress(this.world), this.delayMs) as unknown as number;
  }

  /** Write right now — pausing, quitting, closing the tab. */
  flush() {
    clearTimeout(this.timer);
    writeProgress(this.world);
  }
}
