import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Input } from './core/input';
import { FollowCamera } from './core/camera';
import { params } from './core/tuning';
import { Bee } from './bee/bee';
import { FlightController } from './bee/flight';
import { Atmosphere } from './world/atmosphere';
import {
  ESTATE, M, ZONES, diagonalMetres, traversal, type Zone, type ZoneKind,
} from './world/estateBlockout';

// THE ESTATE GREYBOX — one question, asked as cheaply as possible.
//
// Is estate scale the right scale? Forty metres of grounds is fourteen times
// the backyard, and the honest way to find out whether that reads as "epic
// open world" or as "long empty walk" is to fly it, not to argue about it.
//
// So this page is deliberately NOT the game. No quests, no human AI, no
// appliances, no grass. Flat volumes, human figures for scale, a metre grid,
// and a readout of how long everything takes to cross. Everything you see is
// generated from estateBlockout.ts, which is plain data — the part that
// survives a port to a real engine.

const m = (metres: number) => metres * M;

const PALETTE: Record<ZoneKind, number> = {
  ground: 0x6f7a63,
  paving: 0xa8a49b,
  gravel: 0x8f887c,
  building: 0x9a9a99,
  glass: 0x8fb8c9,
  water: 0x4a8fc0,
  planting: 0x5f7a4c,
  wall: 0x7d7a74,
  prop: 0xc98b4b,
  ref: 0xd2544a, // people are red so your eye finds the scale instantly
};

async function main() {
  const physics = await initPhysics();
  const { RAPIER, world } = physics;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const SKY = 0xb9cddb;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, m(120), m(420));

  scene.add(new THREE.HemisphereLight(0xdceaff, 0x555f4a, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  const SUN_OFFSET = new THREE.Vector3(m(9), m(22), m(-6));
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const SR = m(6);
  sun.shadow.camera.left = -SR;
  sun.shadow.camera.right = SR;
  sun.shadow.camera.top = SR;
  sun.shadow.camera.bottom = -SR;
  sun.shadow.camera.near = m(6);
  sun.shadow.camera.far = m(46);
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(m(230), 56),
    new THREE.MeshLambertMaterial({ color: 0x5d6a52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(m(230), m(0.1), m(230))
      .setTranslation(0, -m(0.1), 0).setFriction(1),
  );

  // A metre grid, because a greybox you can't measure by eye is just boxes.
  const grid = new THREE.GridHelper(
    m(ESTATE.depth), ESTATE.depth / 2, 0x3f4a38, 0x4d5844,
  );
  grid.position.y = 0.4;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  // ---- the blockout ----
  const mats = new Map<string, THREE.Material>();
  const materialFor = (kind: ZoneKind, hollow: boolean) => {
    const key = `${kind}:${hollow}`;
    let mat = mats.get(key);
    if (!mat) {
      const color = PALETTE[kind];
      mat = kind === 'glass' || kind === 'water'
        ? new THREE.MeshLambertMaterial({
          color, transparent: true, opacity: kind === 'glass' ? 0.3 : 0.72,
          side: THREE.DoubleSide,
        })
        : new THREE.MeshLambertMaterial({
          color, transparent: hollow, opacity: hollow ? 0.42 : 1,
          side: hollow ? THREE.DoubleSide : THREE.FrontSide,
        });
      mats.set(key, mat);
    }
    return mat;
  };

  const labelled: Array<{ zone: Zone; anchor: THREE.Vector3 }> = [];

  for (const z of ZONES) {
    const h = Math.max(z.h, 0.02);
    const y = (z.y ?? 0) + h / 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(m(z.w), m(h), m(z.d)),
      materialFor(z.kind, !!z.hollow),
    );
    mesh.position.set(m(z.x), m(y), m(z.z));
    if (z.yaw) mesh.rotation.y = z.yaw;
    mesh.castShadow = z.h > 0.1;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Wireframe edges: flat grey volumes are unreadable without them.
    if (z.h > 0.05) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({
          color: 0x1b2018, transparent: true, opacity: 0.45,
        }),
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      scene.add(edges);
    }

    // Hollow volumes are shells you fly into: walls only, no lid, no floor.
    if (z.hollow) {
      const t = m(0.08);
      const hw = m(z.w) / 2;
      const hd = m(z.d) / 2;
      const hh = m(h) / 2;
      const cy = m(y);
      for (const [dx, dz, sw, sd] of [
        [hw, 0, t, hd], [-hw, 0, t, hd], [0, hd, hw, t], [0, -hd, hw, t],
      ] as const) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(sw, hh, sd)
            .setTranslation(m(z.x) + dx, cy, m(z.z) + dz),
        );
      }
      // A lid, so a roofed shell still reads as roofed from above.
      if (z.kind === 'building') {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hw, t, hd)
            .setTranslation(m(z.x), cy + hh, m(z.z)),
        );
      }
    } else if (z.h > 0.01) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(m(z.w) / 2, m(h) / 2, m(z.d) / 2)
          .setTranslation(m(z.x), m(y), m(z.z)),
      );
    }

    if (z.label) {
      labelled.push({ zone: z, anchor: new THREE.Vector3(m(z.x), m((z.y ?? 0) + z.h + 0.4), m(z.z)) });
    }
  }

  // ---- the bee ----
  const bee = new Bee();
  scene.add(bee.root);
  const spawn = new THREE.Vector3(m(0), m(1.6), m(-46));
  const flight = new FlightController(physics, spawn);
  // Flight wants an air sample; the greybox has no atmosphere zones, so it
  // gets the baseline everywhere. Same feel as the open lawn.
  const air = Atmosphere.emptySample();

  const input = new Input(renderer.domElement);
  const followCam = new FollowCamera(window.innerWidth / window.innerHeight);
  followCam.camera.far = m(330);
  followCam.camera.updateProjectionMatrix();
  followCam.occlusionTest = (from, dir, maxDist) => {
    const ray = new RAPIER.Ray(
      { x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = world.castRay(ray, maxDist, true, undefined, undefined, flight.collider, flight.body);
    return hit ? hit.timeOfImpact : null;
  };

  // ---- HUD ----
  const labelLayer = document.getElementById('labels')!;
  const chips = labelled.map(({ zone }) => {
    const el = document.createElement('div');
    el.className = 'zlabel';
    el.textContent = zone.label;
    labelLayer.appendChild(el);
    return el;
  });

  const readout = document.getElementById('readout')!;
  const nearEl = document.getElementById('near')!;

  function fillScaleFacts() {
    const t = traversal(params.flight);
    const s = (v: number) => `${v.toFixed(1)}s`;
    document.getElementById('facts')!.innerHTML = `
      <div><b>${ESTATE.width} × ${ESTATE.depth} m</b> grounds
        · diagonal <b>${diagonalMetres().toFixed(1)} m</b></div>
      <div>across: <b>${s(t.acrossCruise)}</b> cruise ·
        <b>${s(t.acrossBoost)}</b> overdrive</div>
      <div class="cmp" style="border:0;margin:0;padding:0;font-style:normal">
        bee: <b>${t.cruiseMs.toFixed(1)} m/s</b> cruise ·
        <b>${t.boostMs.toFixed(1)} m/s</b> overdrive
        (a real honeybee forages at 4&ndash;5.5)</div>
      <div>corner to corner: <b>${s(t.diagCruise)}</b> cruise ·
        <b>${s(t.diagBoost)}</b> overdrive</div>
      <div class="cmp">the backyard, for comparison: 10 × 8.7 m,
        9.8s / 2.0s across</div>`;
  }
  fillScaleFacts();

  function fitToViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return;
    followCam.camera.aspect = w / h;
    followCam.camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  }
  window.addEventListener('resize', fitToViewport);
  new ResizeObserver(fitToViewport).observe(document.documentElement);
  fitToViewport();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') document.body.classList.toggle('hide-ui');
    if (e.code === 'KeyL') document.body.classList.toggle('hide-labels');
    if (e.code === 'KeyG') grid.visible = !grid.visible;
  });

  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fps = 0;

  const beePos = new THREE.Vector3();
  const beeVel = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const proj = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let firstFrame = true;

  (window as unknown as Record<string, unknown>).__estate = {
    flight, followCam, scene, renderer, physics, ZONES, ESTATE, beePos,
  };

  function frame(now: number) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000;
    const dt = Math.min(rawDt, 1 / 20);
    last = now;

    const look = input.takeLook();
    followCam.addLook(look, dt);
    const state = input.state();

    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      flight.applyInput(state, followCam.forwardYaw(), 1, air);
      world.step();
      accumulator -= FIXED_DT;
    }
    flight.position(beePos);
    flight.velocity(beeVel);

    // Shadows ride with the bee — same reason as the main build: an
    // estate-wide frustum is a few texels per unit.
    const step = m(0.4);
    focus.set(
      Math.round(beePos.x / step) * step,
      Math.max(0, Math.round(beePos.y / step) * step),
      Math.round(beePos.z / step) * step,
    );
    sun.position.copy(focus).add(SUN_OFFSET);
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();

    bee.update(dt, beePos, beeVel, state.boost);
    followCam.update(dt, beePos, firstFrame);
    firstFrame = false;

    // Zone labels, projected. Behind you or far away drops out, and a label
    // that would land on top of a nearer one is suppressed — overlapping
    // chips are worse than no chip, because you can't read either.
    followCam.camera.getWorldPosition(camPos);
    // From altitude everything is far away; scale the cutoff with height or
    // the plan view — the one place labels matter most — shows none at all.
    const labelRange = Math.max(m(46), beePos.y * 1.7);
    const placed: Array<[number, number]> = [];
    const order = labelled
      .map((l, i) => ({ i, d: camPos.distanceTo(l.anchor) }))
      .sort((a, b) => a.d - b.d);
    for (const { i, d } of order) {
      const el = chips[i];
      proj.copy(labelled[i].anchor).project(followCam.camera);
      if (proj.z > 1 || d > labelRange) {
        el.style.display = 'none';
        continue;
      }
      const px = (proj.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-proj.y * 0.5 + 0.5) * window.innerHeight;
      if (placed.some(([ox, oy]) => Math.abs(ox - px) < 96 && Math.abs(oy - py) < 16)) {
        el.style.display = 'none';
        continue;
      }
      placed.push([px, py]);
      el.style.display = 'block';
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.style.opacity = `${Math.max(0.3, 1 - d / labelRange)}`;
    }

    // Nearest labelled zone, and what it's for.
    let best: Zone | null = null;
    let bestD = Infinity;
    for (const { zone, anchor } of labelled) {
      const d = anchor.distanceTo(beePos);
      if (d < bestD) {
        bestD = d;
        best = zone;
      }
    }
    nearEl.innerHTML = best
      ? `<b>${best.label}</b> · ${(bestD / M).toFixed(1)} m away${
        best.note ? `<div class="note">${best.note}</div>` : ''}`
      : '';

    readout.innerHTML = `
      <span>x <b>${(beePos.x / M).toFixed(1)}</b>
        z <b>${(beePos.z / M).toFixed(1)}</b>
        alt <b>${(beePos.y / M).toFixed(2)}</b> m</span>
      <span>speed <b>${(beeVel.length() / M).toFixed(1)}</b> m/s</span>
      <span>${fps.toFixed(0)} fps ·
        ${renderer.info.render.calls} calls ·
        ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris</span>`;

    renderer.render(scene, followCam.camera);

    fpsAccum += rawDt;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
      fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }
  }
  requestAnimationFrame(frame);
}

main();
