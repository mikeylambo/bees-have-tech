import { Pane } from 'tweakpane';

// Every number that affects feel lives here and is live-editable in the panel.
export const params = {
  // Playtested defaults, 2026-08-20 — these are Mikey's "feels like a bee" values.
  // These are the PLAYTESTED values — Mikey's "feels like a bee" set. They
  // are the default and the baseline. A faster alternative lives in
  // FLIGHT_PRESETS below and is one button away, because changing the bee
  // and the world in the same breath makes both unjudgeable.
  flight: {
    accel: 120, // horizontal accel, u/s^2
    ascend: 100,
    descend: 100,
    // How thick the air is. Applied ALWAYS, proportional to speed: it decides
    // how fast you coast to a stop when you let go of the stick.
    damping: 2.6,
    maxSpeed: 60,
    boostMul: 5, // Wing Overdrive multiplier (accel + max speed)
    // Only bites ABOVE maxSpeed. Decides how long borrowed speed — grapple
    // swings, swat knockback — stays with you before settling back down.
    overspeedDrag: 0.5,
  },
  camera: {
    distance: 16.67,
    height: 5.8,
    sensitivity: 0.0024,
    smoothing: 30, // higher = snappier follow
    invertX: false,
    invertY: false,
    // Playtested defaults, 2026-08-20.
    shoulder: 0.26, // lateral offset so the bee doesn't sit under the crosshair
    shoulderUp: 1.15, // raises the aim point so the bee rides lower in frame
    collisionBuffer: 1.6, // stay this far off whatever the camera bumps into
    minDistance: 1.2, // never closer than this, even in a corner
    uncollideSpeed: 6, // how fast the camera eases back out once clear
  },
  aim: {
    assistAngle: 0.13, // radians (~7.5°) — cone that rescues a shot from the lawn
  },
  pad: {
    deadzone: 0.34,
    lookSpeed: 4.49, // radians/sec at full stick deflection
    swapTriggers: false, // tried the swap, went back to RT ascend
  },
  grapple: {
    // The fence is 106 units tall and the tree 364; a 60-unit line couldn't
    // reach the top of anything in the new yard.
    range: 120,
    reelSpeed: 20, // rope shortening, units/sec
    minLength: 1.2,
    travelTime: 0.09, // filament flight time, seconds
  },
  carry: {
    range: 20,
    maxMass: 0.35, // heavier than this and you can only grapple it
    holdDistance: 2.4,
    holdDrop: 0.5,
    pullSpeed: 40,
    refMass: 0.05, // a light pebble: the "feels weightless" reference
    minFollow: 0.4, // floor on the weight-lag factor, so heavy ≠ unusable
    breakDistance: 40, // safety net only — you should never lose a load by flying
    haulMass: 0.3, // mass at which flight is fully taxed
    haulPenalty: 0.55, // fraction of speed/accel a full load costs you
    throwImpulse: 26,
  },
  stinger: {
    range: 4.5, // very short — you have to commit to get in there
    cooldown: 0.45,
    lungeTime: 0.22,
    lungeImpulse: 14, // the bee throws itself at the target
    propImpulse: 30,
    flinchTime: 0.85, // how long the human flails after being stung
  },
  radial: {
    timeScale: 0.25, // slow-mo while choosing, so the physics stays readable
  },
  hack: {
    range: 120, // hacking from cover has to be possible across a real yard
    time: 0.7, // hold this long to flip an appliance
  },
  atmosphere: {
    fanRange: 200,
    fanSpread: 0.5, // radians, half-angle of the cone
    fanForce: 165, // units/sec^2 on the axis at point-blank
    fanDamping: 0.5, // moving air is THIN air — this is why a fan throws you
  },
  hive: {
    depositRadius: 16,
  },
  swarm: {
    speed: 44,
    followRadius: 8,
    orbitRadius: 14,
    grabRadius: 5,
    beaconTime: 1.4, // converge for this long, then read the situation
    contextRadius: 70, // how far a bee looks for a job around the beacon
    distractPerception: 0.45, // human's sight range while being mobbed
  },
  appliance: {
    sprinklerWetRadius: 150, // ~2.5 m of spread, which is what a sprinkler does
    wetGrow: 45, // units/sec the puddle spreads
    wetDry: 14, // units/sec it dries once off
    zapperRadius: 40,
    wetZapMultiplier: 2.4, // an electrified puddle is a much bigger problem
    zapImpulse: 80,
    evidenceRise: 26, // exposure/sec when a human watches tech act by itself
  },
  flower: {
    stiffness: 12,
    damping: 1,
  },
  human: {
    height: 100, // ~1.7m at bee scale — the kaiju read, and the world's ruler
    // 0.93 m/s. He crosses his own garden in about eleven seconds, which is
    // what makes the far corners feel like somewhere you got away to.
    walkSpeed: 55,
    turnSpeed: 2.2,
    // Perception
    // 3.6 m. In the old 2.4 m yard a 130-unit range meant he saw everything
    // from anywhere; now it's a threat radius you can be outside of.
    sightRange: 210,
    fovDegrees: 110,
    fovVerticalDegrees: 150, // ±75° — straight overhead / at their feet is blind
    grassConcealHeight: 3.6, // fly below the grass line and you're hidden
    closeSeeRange: 30, // ...unless you're right in their face
    // Reaction
    swatRange: 26, // how close he'll get before taking a swing
    swatHitRadius: 15, // the hand's actual hit sphere — smaller = fairer
    swatImpulse: 46, // velocity change dealt to a struck bee
    swatCooldown: 1.6,
    swatWindup: 0.32,
    investigateTime: 8,
  },
  exposure: {
    riseSeen: 7, // per second while plainly visible
    riseTech: 16, // per second while visibly using tech
    riseThrow: 9, // one-off spike when a prop flies past them
    decay: 4.5, // per second while unseen
    decayDelay: 2.5, // seconds unseen before decay starts
  },
  world: {
    seed: 1337,
    // Blades are drawn in a window that follows the bee; this scales how many
    // live in it. Guessed against software rendering — dial it on real
    // hardware and paste the settings back.
    grassDensity: 0.58,
  },
  fps: 0,
  drawCalls: 0,
  triangles: 0,
};

// v3: back to the playtested bee as the default. A saved v2 file holds the
// retuned set and would silently reapply it on load — the same trap in the
// other direction.
// ---------------------------------------------------------------------------
// BEE PRESETS — two complete, coherent configurations you can flip between.
//
// The mistake this exists to prevent: changing the bee and the world in the
// same build. Do that and neither is judgeable, because you cannot tell which
// one you are reacting to. Each preset is the FULL coupled set — flight,
// camera lead, and every reach measured in world units — so flipping gives
// you one honest configuration or the other, never a hybrid nobody designed.

export type TuningPatch = Record<string, Record<string, number>>;

export interface BeePreset {
  id: string;
  label: string;
  note: string;
  patch: TuningPatch;
}

export const BEE_PRESETS: BeePreset[] = [
  {
    id: 'playtested',
    label: '🐝 Playtested bee',
    note: 'Cruise 1.0 m/s. The set Mikey tuned in the small yard, unchanged.',
    patch: {
      flight: { accel: 120, ascend: 100, descend: 100, damping: 2.6, maxSpeed: 60, boostMul: 5 },
      camera: { distance: 16.67 },
      grapple: { range: 120, reelSpeed: 20, travelTime: 0.09 },
      carry: { range: 20, pullSpeed: 40, breakDistance: 40, throwImpulse: 26 },
      stinger: { lungeImpulse: 14, propImpulse: 30 },
      hack: { range: 120 },
      atmosphere: { fanRange: 200, fanForce: 165 },
      hive: { depositRadius: 16 },
      swarm: { speed: 44, grabRadius: 5 },
      appliance: { zapImpulse: 80 },
      human: { walkSpeed: 55, swatImpulse: 46 },
    },
  },
  {
    id: 'retuned',
    label: '⚡ Retuned bee',
    note: 'Cruise 3.4 m/s, overdrive 10.2. Real-honeybee speeds, for a big property.',
    patch: {
      flight: { accel: 520, ascend: 430, descend: 430, damping: 2.6, maxSpeed: 260, boostMul: 3 },
      camera: { distance: 21 },
      grapple: { range: 400, reelSpeed: 66, travelTime: 0.12 },
      carry: { range: 55, pullSpeed: 130, breakDistance: 120, throwImpulse: 85 },
      stinger: { lungeImpulse: 46, propImpulse: 95 },
      hack: { range: 300 },
      atmosphere: { fanRange: 260, fanForce: 540 },
      hive: { depositRadius: 30 },
      swarm: { speed: 150, grabRadius: 9 },
      appliance: { zapImpulse: 260, },
      human: { walkSpeed: 82, swatImpulse: 150 },
    },
  },
];

/** Which preset was last applied. Shown in the panel so it's never a guess. */
export let activePreset = 'playtested';

export function applyBeePreset(id: string): boolean {
  const preset = BEE_PRESETS.find((p) => p.id === id);
  if (!preset) return false;
  const target = params as unknown as Record<string, Record<string, number>>;
  for (const [group, values] of Object.entries(preset.patch)) {
    const dest = target[group];
    if (!dest) continue;
    for (const [key, value] of Object.entries(values)) {
      if (key in dest) dest[key] = value;
    }
  }
  activePreset = id;
  return true;
}

const STORAGE_KEY = 'bht.settings.v3';

/** The values shipped in the build, captured before any saved file is applied. */
const SHIPPED = JSON.parse(JSON.stringify(params)) as typeof params;

/** Everything except live readouts — this is what round-trips to the designer. */
function exportSettings(): string {
  const { fps: _fps, drawCalls: _dc, triangles: _tri, ...rest } = params;
  return JSON.stringify(rest, null, 2);
}

/**
 * Restore saved tuning. MUST run before the world is built — the yard, the
 * human and the flower springs all read these values at construction time.
 */
export function loadSavedSettings(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    applySettings(raw);
    return true;
  } catch {
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, exportSettings());
  } catch {
    // Private browsing or a full quota — tuning just won't persist.
  }
}

function showDump(text: string) {
  const box = document.getElementById('jsonDump');
  const ta = document.getElementById('jsonText') as HTMLTextAreaElement | null;
  if (!box || !ta) return;
  ta.value = text;
  box.classList.add('show');
  ta.focus();
  ta.select();
}

/** Deep-merge only keys that already exist, so a stale paste can't inject junk. */
function applySettings(text: string): number {
  const incoming = JSON.parse(text) as Record<string, unknown>;
  let applied = 0;
  const target = params as unknown as Record<string, Record<string, unknown>>;
  for (const [group, values] of Object.entries(incoming)) {
    const dest = target[group];
    if (!dest || typeof dest !== 'object' || typeof values !== 'object' || !values) continue;
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      if (!(key in dest)) continue;
      if (typeof dest[key] !== typeof value) continue;
      dest[key] = value;
      applied++;
    }
  }
  return applied;
}

export interface TuningOptions {
  /** False for the estate blockout, which has no yard, gadgets or flowers. */
  world?: boolean;
  title?: string;
  /** Called after a preset flip, so a HUD showing derived numbers can refresh. */
  onPreset?: (id: string) => void;
}

export function createTuning(
  onReshuffle: (seed: number) => void,
  onFlowerSpringChange: () => void = () => {},
  opts: TuningOptions = {},
): Pane {
  const { world = true, onPreset } = opts;
  const pane = new Pane({ title: opts.title ?? 'The Bees Have Tech! — tuning' });

  // First, because it's the coarse control: pick a whole bee, then fine-tune.
  const bp = pane.addFolder({ title: 'Bee preset' });
  const presetState = { active: activePreset };
  const presetLabel = bp.addBinding(presetState, 'active', {
    readonly: true, label: 'active',
  });
  for (const preset of BEE_PRESETS) {
    const btn = bp.addButton({ title: preset.label });
    btn.on('click', () => {
      applyBeePreset(preset.id);
      presetState.active = preset.id;
      pane.refresh();
      presetLabel.refresh();
      onFlowerSpringChange();
      onPreset?.(preset.id);
    });
  }

  const f = pane.addFolder({ title: 'Flight feel' });
  f.addBinding(params.flight, 'accel', { min: 40, max: 1200 });
  f.addBinding(params.flight, 'ascend', { min: 40, max: 900 });
  f.addBinding(params.flight, 'descend', { min: 40, max: 900 });
  f.addBinding(params.flight, 'damping', { min: 0.2, max: 8 });
  f.addBinding(params.flight, 'maxSpeed', { min: 40, max: 700 });
  f.addBinding(params.flight, 'boostMul', { min: 1, max: 6 });
  f.addBinding(params.flight, 'overspeedDrag', { min: 0.5, max: 20, label: 'overspeed drag' });

  const c = pane.addFolder({ title: 'Camera' });
  c.addBinding(params.camera, 'distance', { min: 4, max: 60 });
  c.addBinding(params.camera, 'height', { min: 0, max: 6 });
  c.addBinding(params.camera, 'sensitivity', { min: 0.0005, max: 0.01 });
  c.addBinding(params.camera, 'smoothing', { min: 2, max: 30 });
  c.addBinding(params.camera, 'invertX', { label: 'invert look X' });
  c.addBinding(params.camera, 'invertY', { label: 'invert look Y' });
  c.addBinding(params.camera, 'shoulder', { min: -3, max: 3 });
  c.addBinding(params.camera, 'shoulderUp', { min: -2, max: 3, label: 'shoulder up' });
  c.addBinding(params.camera, 'collisionBuffer', { min: 0, max: 6, label: 'wall buffer' });
  c.addBinding(params.camera, 'minDistance', { min: 0.4, max: 6, label: 'min distance' });
  c.addBinding(params.camera, 'uncollideSpeed', { min: 1, max: 20, label: 'ease-out speed' });

  const am = pane.addFolder({ title: 'Aim assist' });
  am.addBinding(params.aim, 'assistAngle', {
    min: 0, max: 0.4, label: 'assist cone (rad)',
  });

  const g = pane.addFolder({ title: 'Controller' });
  g.addBinding(params.pad, 'deadzone', { min: 0, max: 0.4 });
  g.addBinding(params.pad, 'lookSpeed', { min: 0.5, max: 8, label: 'stick look speed' });
  g.addBinding(params.pad, 'swapTriggers', { label: 'LT up / RT down' });

  if (world) {
  const gr = pane.addFolder({ title: 'Stinger grapple' });
  gr.addBinding(params.grapple, 'range', { min: 60, max: 900 });
  gr.addBinding(params.grapple, 'reelSpeed', { min: 10, max: 200 });
  gr.addBinding(params.grapple, 'minLength', { min: 0.4, max: 6 });
  gr.addBinding(params.grapple, 'travelTime', { min: 0.01, max: 0.4 });

  const ca = pane.addFolder({ title: 'Tractor beam' });
  ca.addBinding(params.carry, 'range', { min: 10, max: 160 });
  ca.addBinding(params.carry, 'maxMass', { min: 0.02, max: 3, label: 'max lift mass' });
  ca.addBinding(params.carry, 'holdDistance', { min: 1, max: 8 });
  ca.addBinding(params.carry, 'pullSpeed', { min: 20, max: 400 });
  ca.addBinding(params.carry, 'refMass', { min: 0.01, max: 0.5, label: 'weightless mass' });
  ca.addBinding(params.carry, 'minFollow', { min: 0.1, max: 1, label: 'heavy follow floor' });
  ca.addBinding(params.carry, 'haulPenalty', { min: 0, max: 0.9, label: 'haul speed cost' });
  ca.addBinding(params.carry, 'throwImpulse', { min: 10, max: 260 });

  const fl = pane.addFolder({ title: 'Flower springiness' });
  fl.addBinding(params.flower, 'stiffness', { min: 1, max: 120 }).on(
    'change', onFlowerSpringChange,
  );
  fl.addBinding(params.flower, 'damping', { min: 0, max: 12 }).on(
    'change', onFlowerSpringChange,
  );

  const w = pane.addFolder({ title: 'Yard (procgen)' });
  w.addBinding(params.world, 'seed', { step: 1 });
  w.addBinding(params.world, 'grassDensity', {
    min: 0.1, max: 1, label: 'grass density',
  });
  w.addButton({ title: '🎲 reshuffle yard' }).on('click', () => {
    params.world.seed = (Math.random() * 1e9) | 0;
    pane.refresh();
    onReshuffle(params.world.seed);
  });
  } // end world-only folders

  const perf = pane.addFolder({ title: 'Budget' });
  perf.addBinding(params, 'fps', { readonly: true, format: (v) => v.toFixed(0) });
  perf.addBinding(params, 'drawCalls', {
    readonly: true, label: 'draw calls', format: (v) => v.toFixed(0),
  });
  perf.addBinding(params, 'triangles', {
    readonly: true, label: 'triangles', format: (v) => `${(v / 1000).toFixed(0)}k`,
  });

  // ---- settings round-trip ----
  const io = pane.addFolder({ title: 'Settings I/O' });
  const copyBtn = io.addButton({ title: '📋 copy settings JSON' });
  copyBtn.on('click', async () => {
    const text = exportSettings();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.title = '✅ copied — paste it to Claude';
      setTimeout(() => (copyBtn.title = '📋 copy settings JSON'), 2200);
    } catch {
      // Clipboard needs permission/secure context; show it to select by hand.
      showDump(text);
    }
  });
  io.addButton({ title: '👁 show settings JSON' }).on('click', () => {
    showDump(exportSettings());
  });
  const pasteBtn = io.addButton({ title: '📥 paste settings JSON' });
  pasteBtn.on('click', () => {
    const text = window.prompt('Paste settings JSON:');
    if (!text) return;
    try {
      const n = applySettings(text);
      pane.refresh();
      onFlowerSpringChange();
      pasteBtn.title = `✅ applied ${n} values`;
    } catch {
      pasteBtn.title = '⚠️ not valid JSON';
    }
    setTimeout(() => (pasteBtn.title = '📥 paste settings JSON'), 2400);
  });

  const resetBtn = io.addButton({ title: '↩︎ reset to shipped defaults' });
  resetBtn.on('click', () => {
    applySettings(JSON.stringify(SHIPPED));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* nothing to clear */ }
    pane.refresh();
    onFlowerSpringChange();
    resetBtn.title = '✅ back to defaults';
    setTimeout(() => (resetBtn.title = '↩︎ reset to shipped defaults'), 2000);
  });

  // Persist every tweak so a reload doesn't cost you an evening of tuning.
  let saveTimer: number | undefined;
  pane.on('change', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 400) as unknown as number;
  });

  document.getElementById('jsonClose')?.addEventListener('click', () => {
    document.getElementById('jsonDump')?.classList.remove('show');
  });

  return pane;
}
