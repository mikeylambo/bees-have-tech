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
  },
  camera: {
    distance: 6.5,
    height: 1.4,
    sensitivity: 0.0024,
    smoothing: 14, // higher = snappier follow
    invertX: false,
    invertY: false,
    shoulder: 1.15, // lateral offset so the bee doesn't sit under the crosshair
    shoulderUp: 0.55, // raises the aim point so the bee rides lower in frame
  },
  aim: {
    assistAngle: 0.13, // radians (~7.5°) — cone that rescues a shot from the lawn
  },
  pad: {
    deadzone: 0.14,
    lookSpeed: 2.6, // radians/sec at full stick deflection
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
  world: {
    seed: 1337,
  },
  fps: 0,
};

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
  return pane;
}
