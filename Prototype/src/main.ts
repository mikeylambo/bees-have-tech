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

  const input = new Input(renderer.domElement);
  const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

  createTuning(
    (seed) => grass.scatter(seed),
    () => applyFlowerSpring(physics, yard.flowers),
  );

  const reticle = document.getElementById('reticle');

  window.addEventListener('resize', () => {
    followCam.camera.aspect = window.innerWidth / window.innerHeight;
    followCam.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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
  };

  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    followCam.addLook(input.takeLook(), dt);
    const state = input.state();
    const act = input.actions();

    // Aim comes from the camera, so the crosshair tells the truth.
    followCam.camera.getWorldDirection(aimDir);
    followCam.camera.getWorldPosition(camPos);

    // --- grapple ---
    if (act.grapplePressed) {
      if (carry.isCarrying) {
        carry.throwIt(aimDir); // grapple button doubles as throw while carrying
      } else if (grapple.state === 'idle') {
        grapple.fire(camPos, aimDir, flight.collider);
      }
    }
    if (act.grappleReleased && grapple.state !== 'idle' && !carry.isCarrying) {
      grapple.release();
    }

    // --- carry ---
    if (act.carryPressed && !carry.isCarrying) {
      carry.tryGrab(physics, camPos, aimDir, flight.collider);
    }
    if (act.carryReleased && carry.isCarrying) {
      carry.drop();
    }
    if (act.throwPressed && carry.isCarrying) {
      carry.throwIt(aimDir);
    }

    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      flight.applyInput(state, followCam.forwardYaw());
      grapple.reel(FIXED_DT, act.grappleHeld);
      flight.position(beePos);
      carry.update(beePos, aimDir);
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

    // Reticle state: what would this shot hit?
    if (reticle) {
      let cls = '';
      if (carry.isCarrying) cls = 'carrying';
      else if (grapple.state === 'attached') cls = 'attached';
      else {
        const ray = new physics.RAPIER.Ray(
          { x: camPos.x, y: camPos.y, z: camPos.z },
          { x: aimDir.x, y: aimDir.y, z: aimDir.z },
        );
        const hit = physics.world.castRay(
          ray, params.grapple.range, true,
          undefined, undefined, flight.collider, flight.body,
        );
        if (hit) {
          const b = hit.collider.parent();
          const liftable =
            b !== null &&
            b.isDynamic() &&
            b.mass() <= params.carry.maxMass &&
            hit.timeOfImpact <= params.carry.range;
          cls = liftable ? 'liftable' : 'anchor';
        }
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
