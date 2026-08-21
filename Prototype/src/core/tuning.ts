import { Pane } from 'tweakpane';

// Every number that affects feel lives here and is live-editable in the panel.
export const params = {
  // Playtested defaults, 2026-08-20 — these are Mikey's "feels like a bee" values.
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
    range: 60,
    reelSpeed: 14, // rope shortening, units/sec
    minLength: 1.2,
    travelTime: 0.09, // filament flight time, seconds
  },
  carry: {
    range: 14,
    maxMass: 0.35, // heavier than this and you can only grapple it
    holdDistance: 2.4,
    holdDrop: 0.5,
    pullSpeed: 40,
    refMass: 0.05, // a light pebble: the "feels weightless" reference
    minFollow: 0.4, // floor on the weight-lag factor, so heavy ≠ unusable
    breakDistance: 26, // safety net only — you should never lose a load by flying
    haulMass: 0.3, // mass at which flight is fully taxed
    haulPenalty: 0.55, // fraction of speed/accel a full load costs you
    throwImpulse: 26,
  },
  flower: {
    stiffness: 12,
    damping: 1,
  },
  human: {
    height: 100, // ~1.7m at bee scale — the kaiju read
    walkSpeed: 13,
    turnSpeed: 2.2,
    // Perception
    sightRange: 130,
    fovDegrees: 110,
    fovVerticalDegrees: 150, // ±75° — straight overhead / at their feet is blind
    grassConcealHeight: 3.6, // fly below the grass line and you're hidden
    closeSeeRange: 18, // ...unless you're right in their face
    // Reaction
    swatRange: 26, // how close he'll get before taking a swing
    swatHitRadius: 15, // the hand's actual hit sphere — smaller = fairer
    swatImpulse: 46, // velocity change dealt to a struck bee
    swatCooldown: 1.6,
    swatWindup: 0.32,
    investigateTime: 6,
    yardRadius: 50, // he's kinematic, so the fence won't stop him — this does
    fenceLimitZ: -54,
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
  },
  fps: 0,
};

const STORAGE_KEY = 'bht.settings.v1';

/** The values shipped in the build, captured before any saved file is applied. */
const SHIPPED = JSON.parse(JSON.stringify(params)) as typeof params;

/** Everything except live readouts — this is what round-trips to the designer. */
function exportSettings(): string {
  const { fps: _fps, ...rest } = params;
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

export function createTuning(
  onReshuffle: (seed: number) => void,
  onFlowerSpringChange: () => void = () => {},
): Pane {
  const pane = new Pane({ title: 'The Bees Have Tech! — tuning' });

  const f = pane.addFolder({ title: 'Flight feel' });
  f.addBinding(params.flight, 'accel', { min: 5, max: 120 });
  f.addBinding(params.flight, 'ascend', { min: 5, max: 100 });
  f.addBinding(params.flight, 'descend', { min: 5, max: 100 });
  f.addBinding(params.flight, 'damping', { min: 0.2, max: 8 });
  f.addBinding(params.flight, 'maxSpeed', { min: 4, max: 60 });
  f.addBinding(params.flight, 'boostMul', { min: 1, max: 5 });
  f.addBinding(params.flight, 'overspeedDrag', { min: 0.5, max: 20, label: 'overspeed drag' });

  const c = pane.addFolder({ title: 'Camera' });
  c.addBinding(params.camera, 'distance', { min: 2, max: 20 });
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

  const gr = pane.addFolder({ title: 'Stinger grapple' });
  gr.addBinding(params.grapple, 'range', { min: 10, max: 120 });
  gr.addBinding(params.grapple, 'reelSpeed', { min: 2, max: 50 });
  gr.addBinding(params.grapple, 'minLength', { min: 0.4, max: 6 });
  gr.addBinding(params.grapple, 'travelTime', { min: 0.01, max: 0.4 });

  const ca = pane.addFolder({ title: 'Tractor beam' });
  ca.addBinding(params.carry, 'range', { min: 3, max: 40 });
  ca.addBinding(params.carry, 'maxMass', { min: 0.02, max: 3, label: 'max lift mass' });
  ca.addBinding(params.carry, 'holdDistance', { min: 1, max: 8 });
  ca.addBinding(params.carry, 'pullSpeed', { min: 4, max: 90 });
  ca.addBinding(params.carry, 'refMass', { min: 0.01, max: 0.5, label: 'weightless mass' });
  ca.addBinding(params.carry, 'minFollow', { min: 0.1, max: 1, label: 'heavy follow floor' });
  ca.addBinding(params.carry, 'haulPenalty', { min: 0, max: 0.9, label: 'haul speed cost' });
  ca.addBinding(params.carry, 'throwImpulse', { min: 2, max: 90 });

  const fl = pane.addFolder({ title: 'Flower springiness' });
  fl.addBinding(params.flower, 'stiffness', { min: 1, max: 120 }).on(
    'change', onFlowerSpringChange,
  );
  fl.addBinding(params.flower, 'damping', { min: 0, max: 12 }).on(
    'change', onFlowerSpringChange,
  );

  const w = pane.addFolder({ title: 'Yard (procgen)' });
  w.addBinding(params.world, 'seed', { step: 1 });
  w.addButton({ title: '🎲 reshuffle yard' }).on('click', () => {
    params.world.seed = (Math.random() * 1e9) | 0;
    pane.refresh();
    onReshuffle(params.world.seed);
  });

  pane.addBinding(params, 'fps', { readonly: true, format: (v) => v.toFixed(0) });

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
