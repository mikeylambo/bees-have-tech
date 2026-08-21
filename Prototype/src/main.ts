import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Input } from './core/input';
import { FollowCamera } from './core/camera';
import { params, createTuning, loadSavedSettings } from './core/tuning';
import { GrassField } from './world/grass';
import { buildYard, syncProps, syncFlowers, applyFlowerSpring } from './world/yard';
import { Bee } from './bee/bee';
import { FlightController } from './bee/flight';
import { Grapple } from './bee/grapple';
import { Carry } from './bee/carry';
import { Aiming } from './bee/aiming';
import { Stinger } from './bee/stinger';
import { TechBelt } from './bee/tech';
import { grappleTech, tractorTech } from './bee/techItems';
import { RadialMenu } from './ui/radial';
import { Human } from './world/human';
import { Exposure } from './game/exposure';
import { mulberry32 } from './core/rng';

async function main() {
  // Before anything is built — the yard, human and flower springs all read
  // these values at construction time.
  loadSavedSettings();

  const physics = await initPhysics();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const yard = buildYard(physics, scene, params.world.seed);
  const grass = new GrassField(params.world.seed);
  scene.add(grass.mesh);

  const bee = new Bee();
  scene.add(bee.root);
  const spawn = new THREE.Vector3(0, 4, 2);
  const flight = new FlightController(physics, spawn);

  const grapple = new Grapple(physics, flight.body);
  scene.add(grapple.line);
  const carry = new Carry(physics, flight.body);
  scene.add(carry.beam);
  const aiming = new Aiming(yard);
  const aim = Aiming.emptyResult();

  // --- innate vs tech ---
  // The stinger is the bee's body, so it's never in the belt and never
  // swapped away. Everything else is tech the hive researched.
  const stinger = new Stinger(physics, flight.body, flight.collider);
  const belt = new TechBelt();
  belt.add(grappleTech(grapple));
  belt.add(tractorTech(carry));
  const radial = new RadialMenu(belt);

  const techIcon = document.getElementById('techIcon');
  const techName = document.getElementById('techName');
  function refreshTechHud() {
    const t = belt.active;
    if (techIcon) techIcon.textContent = t ? t.icon : '';
    if (techName) techName.textContent = t ? t.name : 'no tech';
  }
  refreshTechHud();

  // --- M2: one human, one exposure meter ---
  const human = new Human(physics, new THREE.Vector3(-26, 0, -34));
  scene.add(human.root);
  const exposure = new Exposure();
  const humanRand = mulberry32(params.world.seed ^ 0x5bf03635);

  const swatFlash = document.getElementById('swatFlash');
  const expFill = document.getElementById('expFill');
  const expLevel = document.getElementById('expLevel');
  const expQuote = document.getElementById('expQuote');
  const expBox = document.getElementById('exposure');

  function flashSwat() {
    if (!swatFlash) return;
    swatFlash.classList.add('hit');
    setTimeout(() => swatFlash.classList.remove('hit'), 90);
  }

  human.onSwatHit = (dir) => {
    // Drop whatever you were holding — getting hit should cost you something.
    if (carry.isCarrying) carry.drop();
    if (grapple.state !== 'idle') grapple.release();
    flight.knockback(dir, params.human.swatImpulse);
    exposure.spike(6);
    flashSwat();
  };
  stinger.onStingHuman = () => {
    // Being stung is not something you explain away as "just a bee."
    exposure.spike(22);
    human.reactToSting();
    flashSwat();
  };
  human.onSwatMiss = (dir, distance) => {
    // Near miss: the air moves. Being *almost* hit should be a thrill.
    const falloff = Math.max(0, 1 - distance / (params.human.swatRange * 2.2));
    if (falloff > 0) flight.knockback(dir, params.human.swatImpulse * 0.45 * falloff);
  };

  const input = new Input(renderer.domElement);
  const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

  // Keep the camera out of solid geometry — otherwise it slips inside the
  // human and he reads as a hologram you can fly through.
  followCam.occlusionTest = (from, dir, maxDist) => {
    const ray = new physics.RAPIER.Ray(
      { x: from.x, y: from.y, z: from.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = physics.world.castRay(
      ray, maxDist, true, undefined, undefined, flight.collider, flight.body,
    );
    return hit ? hit.timeOfImpact : null;
  };

  createTuning(
    (seed) => grass.scatter(seed),
    () => applyFlowerSpring(physics, yard.flowers),
  );

  const reticle = document.getElementById('reticle');

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') document.body.classList.toggle('hide-ui');
  });

  // Observe the element, not just window resize: the canvas must re-fit when
  // the page is embedded in a pane that changes size without a window event.
  function fitToViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;
    followCam.camera.aspect = w / h;
    followCam.camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  }
  window.addEventListener('resize', fitToViewport);
  window.addEventListener('orientationchange', fitToViewport);
  new ResizeObserver(fitToViewport).observe(document.documentElement);
  fitToViewport();

  // fixed-step physics, per-frame render
  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;

  let lastLevel = -1;
  function updateExposureHud(seen: boolean) {
    if (expFill) expFill.style.width = `${exposure.value}%`;
    if (expBox) expBox.classList.toggle('seen', seen);
    const lvl = exposure.level;
    if (lvl !== lastLevel) {
      lastLevel = lvl;
      const info = exposure.levelInfo;
      if (expLevel) expLevel.textContent = `EXPOSURE ${lvl} · ${info.name}`;
      if (expQuote) expQuote.textContent = info.quote;
      if (expBox) {
        expBox.classList.remove('lvl1', 'lvl2', 'lvl3', 'lvl4');
        if (lvl > 0) expBox.classList.add(`lvl${lvl}`);
      }
    }
  }

  const beePos = new THREE.Vector3();
  const beeVel = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let firstFrame = true;
  (window as unknown as Record<string, unknown>).__debug = {
    beePos, beeVel, params, grapple, carry, yard, physics, flight, followCam, scene,
    aiming, aim, human, exposure, belt, radial, stinger,
  };

  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    const look = input.takeLook();
    const act = input.actions();
    // While the radial is open the stick steers the menu, not the camera.
    if (!act.radialHeld) followCam.addLook(look, dt);
    const state = input.state();

    // The crosshair finds a point; gadgets then fire from the BEE toward it,
    // so close-range shots don't miss by camera parallax.
    followCam.camera.getWorldDirection(aimDir);
    followCam.camera.getWorldPosition(camPos);
    flight.position(beePos);
    aiming.resolve(physics, camPos, aimDir, beePos, flight.collider, flight.body, aim);

    // --- tech radial: switches tools, never uses them ---
    if (act.radialHeld && !radial.open) radial.show();
    if (act.radialHeld) {
      // Right stick on a pad, mouse motion on KBM. Y is inverted so "up" on
      // the stick points at the top of the ring.
      radial.update(look.stickX + look.mouseDX * 0.02, look.stickY + look.mouseDY * 0.02);
    }
    if (!act.radialHeld && radial.open) {
      const chosen = radial.hide();
      if (chosen >= 0) belt.select(chosen);
      refreshTechHud();
    }
    if (act.cycleDelta !== 0 && !radial.open) {
      belt.cycle(act.cycleDelta);
      refreshTechHud();
    }

    // --- active tech ---
    const techCtx = { physics, beePos, aim, beeCollider: flight.collider, dt };
    const tech = belt.active;
    if (!radial.open && tech) {
      if (act.usePressed) tech.useStart?.(techCtx);
      if (act.useHeld) tech.useHold?.(techCtx);
      if (act.useReleased) tech.useEnd?.(techCtx);
      if (act.altPressed) tech.altUse?.(techCtx);
    }

    // --- innate stinger ---
    stinger.update(dt);
    if (!radial.open && act.stingPressed) {
      stinger.jab(aim.dirFromBee, beePos, human.bodyHandle);
    }

    // Slow-mo while the radial is open: readable, and a bee frozen mid-swing
    // looks broken where a bee in slow motion looks deliberate.
    const simDt = radial.open ? dt * params.radial.timeScale : dt;
    accumulator += simDt;
    const load = carry.loadFactor();
    while (accumulator >= FIXED_DT) {
      flight.applyInput(state, followCam.forwardYaw(), load);
      flight.position(beePos);
      carry.update(beePos, aim.dirFromBee);
      physics.world.step();
      accumulator -= FIXED_DT;
    }

    flight.position(beePos);
    flight.velocity(beeVel);

    // --- human + exposure ---
    const { seen } = human.update(dt, physics, beePos, flight.collider, humanRand);
    // Using tech in plain view is far more incriminating than merely existing.
    const techVisible = grapple.state !== 'idle' || carry.isCarrying;
    exposure.update(dt, seen, techVisible);
    updateExposureHud(seen);

    bee.update(dt, beePos, beeVel, state.boost);
    grapple.update(dt, beePos);
    syncProps(yard.dynamicProps);
    syncFlowers(yard.flowers);
    grass.update(dt);
    followCam.update(dt, beePos, firstFrame);
    firstFrame = false;

    // Reticle state: what would this shot do?
    if (reticle) {
      // The reticle reports what the ACTIVE tool would do here, so switching
      // tech visibly changes what the world looks actionable.
      let cls = '';
      const engaged = tech?.status?.() === 'engaged';
      if (engaged) {
        cls = tech?.id === 'tractor' ? 'carrying' : 'attached';
      } else if (aim.hasTarget) {
        if (tech?.id === 'tractor') cls = aim.liftable ? 'liftable' : '';
        else cls = aim.liftable ? '' : 'anchor'; // grapple ignores light things
      }
      if (aim.assisted && !engaged && cls) cls += ' assisted';
      reticle.className = cls;
    }

    renderer.render(scene, followCam.camera);

    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
      params.fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }
  }
  requestAnimationFrame(frame);
}

main();
