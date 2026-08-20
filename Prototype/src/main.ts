import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Input } from './core/input';
import { FollowCamera } from './core/camera';
import { params, createTuning } from './core/tuning';
import { GrassField } from './world/grass';
import { buildYard, syncProps, syncFlowers, applyFlowerSpring } from './world/yard';
import { Bee } from './bee/bee';
import { FlightController } from './bee/flight';
import { Grapple } from './bee/grapple';
import { Carry } from './bee/carry';
import { Aiming } from './bee/aiming';

async function main() {
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

  const input = new Input(renderer.domElement);
  const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

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

  const beePos = new THREE.Vector3();
  const beeVel = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let firstFrame = true;
  (window as unknown as Record<string, unknown>).__debug = {
    beePos, beeVel, params, grapple, carry, yard, physics, flight, followCam, scene,
    aiming, aim,
  };

  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    followCam.addLook(input.takeLook(), dt);
    const state = input.state();
    const act = input.actions();

    // The crosshair finds a point; gadgets then fire from the BEE toward it,
    // so close-range shots don't miss by camera parallax.
    followCam.camera.getWorldDirection(aimDir);
    followCam.camera.getWorldPosition(camPos);
    flight.position(beePos);
    aiming.resolve(physics, camPos, aimDir, beePos, flight.collider, flight.body, aim);

    // --- grapple ---
    if (act.grapplePressed) {
      if (carry.isCarrying) {
        carry.throwIt(aim.dirFromBee); // doubles as throw while carrying
      } else if (grapple.state === 'idle') {
        grapple.fire(beePos, aim.dirFromBee, flight.collider);
      }
    }
    if (act.grappleReleased && grapple.state !== 'idle' && !carry.isCarrying) {
      grapple.release();
    }

    // --- carry ---
    if (act.carryPressed && !carry.isCarrying) {
      carry.tryGrab(physics, beePos, aim.dirFromBee, flight.collider);
    }
    if (act.carryReleased && carry.isCarrying) {
      carry.drop();
    }
    if (act.throwPressed && carry.isCarrying) {
      carry.throwIt(aim.dirFromBee);
    }

    accumulator += dt;
    const load = carry.loadFactor();
    while (accumulator >= FIXED_DT) {
      flight.applyInput(state, followCam.forwardYaw(), load);
      grapple.reel(FIXED_DT, act.grappleHeld);
      flight.position(beePos);
      carry.update(beePos, aim.dirFromBee);
      physics.world.step();
      accumulator -= FIXED_DT;
    }

    flight.position(beePos);
    flight.velocity(beeVel);
    bee.update(dt, beePos, beeVel, state.boost);
    grapple.update(dt, beePos);
    syncProps(yard.dynamicProps);
    syncFlowers(yard.flowers);
    grass.update(dt);
    followCam.update(dt, beePos, firstFrame);
    firstFrame = false;

    // Reticle state: what would this shot do?
    if (reticle) {
      let cls = '';
      if (carry.isCarrying) cls = 'carrying';
      else if (grapple.state === 'attached') cls = 'attached';
      else if (aim.liftable) cls = 'liftable';
      else if (aim.hasTarget) cls = 'anchor';
      if (aim.assisted && !carry.isCarrying && grapple.state === 'idle') {
        cls += ' assisted';
      }
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
