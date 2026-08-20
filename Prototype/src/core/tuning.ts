import { Pane } from 'tweakpane';

// Every number that affects feel lives here and is live-editable in the panel.
export const params = {
  flight: {
    accel: 46, // horizontal accel, u/s^2
    ascend: 34,
    descend: 28,
    damping: 2.6, // linear damping — the "air thickness"
    maxSpeed: 16,
    boostMul: 2.2, // Wing Overdrive multiplier (accel + max speed)
    overspeedDrag: 5, // how hard borrowed speed (swings, knockback) bleeds off
  },
  camera: {
    distance: 6.5,
    height: 1.4,
    sensitivity: 0.0024,
    smoothing: 14, // higher = snappier follow
    invertX: false,
    invertY: false,
    // Playtested defaults, 2026-08-20.
    shoulder: 0.26, // lateral offset so the bee doesn't sit under the crosshair
    shoulderUp: 1.15, // raises the aim point so the bee rides lower in frame
  },
  aim: {
    assistAngle: 0.13, // radians (~7.5°) — cone that rescues a shot from the lawn
  },
  pad: {
    deadzone: 0.14,
    lookSpeed: 2.6, // radians/sec at full stick deflection
    swapTriggers: true, // LT ascend / RT descend
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
    swatRange: 26,
    swatImpulse: 46, // velocity change dealt to a struck bee
    swatCooldown: 1.6,
    swatWindup: 0.32,
    investigateTime: 6,
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

/** Everything except live readouts — this is what round-trips to the designer. */
function exportSettings(): string {
  const { fps: _fps, ...rest } = params;
  return JSON.stringify(rest, null, 2);
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

  document.getElementById('jsonClose')?.addEventListener('click', () => {
    document.getElementById('jsonDump')?.classList.remove('show');
  });

  return pane;
}
