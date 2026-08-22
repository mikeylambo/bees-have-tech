import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';

// THE PROPERTY — authored in METRES, because the old one wasn't.
//
// The yard used to be 144 × 128 units. The human is 100 units for 1.7 m, so
// that yard was 2.4 × 2.2 m: a patio. At maxSpeed 60 you crossed the entire
// world in 2.4 seconds, and 0.5 on overdrive. That is the whole "it doesn't
// feel open" problem, and no amount of art fixes a world two seconds wide.
//
// So everything below is written in metres against one constant, and the
// human stays exactly where he was. He is the ruler; the yard was wrong.

/** Units per metre. Fixed by the human: 100 units = 1.7 m. */
export const M = 100 / 1.7; // ≈ 58.8

const m = (metres: number) => metres * M;

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function rectContains(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({
  minX: m(minX), maxX: m(maxX), minZ: m(minZ), maxZ: m(maxZ),
});

// ---- the plan, in metres ----
// 10.0 × 8.7 m of garden. Real, and it takes ~10 seconds to cross at cruise
// instead of two and a half.
export const YARD: Rect = rect(-5.0, 5.0, -4.2, 4.5);
export const LAWN: Rect = rect(-4.85, 4.85, -4.05, 2.1);
export const DECK: Rect = rect(-2.6, 1.4, 2.2, 4.4);
export const SHED: Rect = rect(2.4, 4.8, -4.0, -2.2);
export const BED_BACK: Rect = rect(-4.85, 1.7, -4.05, -3.1);
export const BED_WEST: Rect = rect(-4.85, -3.95, -3.1, 1.6);
export const PATH: Rect = rect(-0.1, 0.5, -3.2, 2.2);
export const HEDGE: Rect = rect(4.05, 4.8, -1.9, 2.0);

/** Deck surface height. There is a bee-sized room underneath it. */
export const DECK_HEIGHT = m(0.55);
/** Fence height — 1.8 m, which at bee scale is a hundred-unit cliff. */
export const FENCE_H = m(1.8);
/** Two storeys. The wall is the scale argument. */
export const HOUSE_H = m(6.0);
/** Where the gutter run sits — a corridor only a flying thing can use. */
export const GUTTER_Y = HOUSE_H + m(0.12);

/** Where the bee starts: out on the lawn, low, so the scale lands first. */
export const SPAWN = new THREE.Vector3(m(-0.6), m(0.12), m(1.5));

/** Rectangular footprints a walking human must route around. */
export const WALK_BLOCKERS: Rect[] = [SHED, HEDGE, DECK];

/**
 * Round things he'd otherwise stroll through: [x, z, radius].
 *
 * Missing this list is why he waded through the deck, the pool and the tree
 * as though the yard were a texture. A property that isn't solid to the NPC
 * isn't a property — it's a backdrop he happens to stand in front of.
 */
export const WALK_BLOCK_CIRCLES: Array<[number, number, number]> = [
  [m(-2.55), m(0.35), m(0.95)], // kiddie pool
  [m(-2.1), m(-1.2), m(0.35)], // bird bath
  [m(-4.2), m(-2.5), m(0.35)], // tree trunk
  [m(1.75), m(-3.15), m(0.55)], // woodpile
  [m(-4.4), m(3.3), m(0.4)], // bin
  [m(1.0), m(-1.9), m(0.45)], // wheelbarrow
  [m(-3.1), m(2.35), m(0.3)], // coiled hose
  [m(-3.4), m(1.9), m(0.2)], // washing-line posts
  [m(-3.4), m(-2.9), m(0.2)],
];

export interface Property {
  group: THREE.Group;
  /** Aim assist demotes this so the lawn stops eating every grapple shot. */
  groundColliderHandle: number;
  sun: THREE.DirectionalLight;
  /**
   * Shadows track the bee. A frustum big enough for a 10 m yard plus a 6 m
   * house needs a ~440-unit radius, which at 4096 is four texels per unit —
   * the bee's own shadow turns to mush. A tight frustum that follows gives
   * fifteen, and nothing distant needed to cast anyway.
   */
  updateShadow: (focus: THREE.Vector3) => void;
}

const SKY = 0x9ed0ee;

export function buildProperty(physics: Physics, scene: THREE.Scene, seed: number): Property {
  const { RAPIER, world } = physics;
  const group = new THREE.Group();
  const rand = mulberry32(seed ^ 0x51ed270b);
  const range = rangeFrom(rand);

  // ---- sky, fog, light ----
  scene.background = new THREE.Color(SKY);
  // Fog starts beyond the fence line: the yard reads sharp, the neighbourhood
  // behind it is what softens.
  scene.fog = new THREE.Fog(SKY, m(11), m(34));

  scene.add(new THREE.HemisphereLight(0xd4e8ff, 0x4a6b34, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  // High, and from behind the back fence. Two constraints fight here: light
  // from the house side leaves a 6 m wall backlit and grey, and a low sun from
  // any side throws one object's shadow across the whole map.
  const SUN_OFFSET = new THREE.Vector3(m(4), m(10.5), m(-1.0));
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const SHADOW_R = m(2.1);
  sun.shadow.camera.left = -SHADOW_R;
  sun.shadow.camera.right = SHADOW_R;
  sun.shadow.camera.top = SHADOW_R;
  sun.shadow.camera.bottom = -SHADOW_R;
  sun.shadow.camera.near = m(2);
  sun.shadow.camera.far = m(20);
  sun.shadow.bias = -0.0007;
  scene.add(sun);
  scene.add(sun.target);

  const _focus = new THREE.Vector3();
  const updateShadow = (focus: THREE.Vector3) => {
    // Keep the frustum centre on a coarse grid, or the shadow map crawls
    // one texel at a time and every edge in the yard shimmers as you fly.
    const step = m(0.25);
    _focus.set(
      Math.round(focus.x / step) * step,
      Math.max(0, Math.round(focus.y / step) * step),
      Math.round(focus.z / step) * step,
    );
    sun.position.copy(_focus).add(SUN_OFFSET);
    sun.target.position.copy(_focus);
    sun.target.updateMatrixWorld();
  };
  updateShadow(SPAWN);

  // ---- materials ----
  const mat = {
    soil: new THREE.MeshLambertMaterial({ color: 0x3a2a1b }),
    // Matched to the average blade colour. When the near-field grass ends,
    // the plane under it has to be the same green or the window's edge reads
    // as a circle of mown lawn following you around.
    lawn: new THREE.MeshLambertMaterial({ color: 0x5c8c3c }),
    // Barely a shade apart. Mower stripes should be something you notice from
    // altitude, not banding you fly over — and with grass only in the near
    // field, high contrast here just advertises where the blades stop.
    lawnStripe: new THREE.MeshLambertMaterial({ color: 0x578639 }),
    plank: new THREE.MeshLambertMaterial({ color: 0x7a5b3e }),
    plankDark: new THREE.MeshLambertMaterial({ color: 0x5f4630 }),
    deck: new THREE.MeshLambertMaterial({ color: 0x8a6b47 }),
    siding: new THREE.MeshLambertMaterial({ color: 0xd8d2c2 }),
    sidingTrim: new THREE.MeshLambertMaterial({ color: 0xf2eee4 }),
    door: new THREE.MeshLambertMaterial({ color: 0x2f4a63 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x18282f, roughness: 0.1, metalness: 0.6,
    }),
    shed: new THREE.MeshLambertMaterial({ color: 0x5c6b5a }),
    shedRoof: new THREE.MeshLambertMaterial({ color: 0x3a3f3c }),
    stone: new THREE.MeshLambertMaterial({ color: 0x9b968b }),
    concrete: new THREE.MeshLambertMaterial({ color: 0xb0aa9c }),
    bark: new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
    leaf: new THREE.MeshLambertMaterial({ color: 0x2f5a24 }),
    leafLight: new THREE.MeshLambertMaterial({ color: 0x3f7130 }),
    leafFar: new THREE.MeshLambertMaterial({ color: 0x355c2e }),
    terracotta: new THREE.MeshLambertMaterial({ color: 0xb2603c }),
    rubber: new THREE.MeshLambertMaterial({ color: 0x2f7a4f }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3fa8d8, roughness: 0.15, metalness: 0.2,
      transparent: true, opacity: 0.75,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x8d9299, roughness: 0.45, metalness: 0.8,
    }),
    plastic: new THREE.MeshLambertMaterial({ color: 0x3f8fd0 }),
  };

  // ---- helpers ----
  const add = (mesh: THREE.Object3D, cast = true, receive = true) => {
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
    group.add(mesh);
    return mesh;
  };

  const solidBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    add(mesh);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setTranslation(x, y, z)
        .setFriction(0.9),
    );
    return mesh;
  };

  /**
   * A batch of identical boxes as ONE draw call. A 10 m fence is 180 planks;
   * as individual meshes that is 180 draw calls for a wall you only ever see
   * one side of.
   */
  const batch = (geo: THREE.BufferGeometry, material: THREE.Material, n: number) => {
    const mesh = new THREE.InstancedMesh(geo, material, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    let i = 0;
    return {
      put(x: number, y: number, z: number, yaw = 0, scale = one) {
        if (i >= n) return;
        q.setFromAxisAngle(up, yaw);
        mtx.compose(new THREE.Vector3(x, y, z), q, scale);
        mesh.setMatrixAt(i++, mtx);
      },
      done() {
        mesh.count = i;
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        return mesh;
      },
    };
  };

  const patch = (r: Rect, y: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r.maxX - r.minX, r.maxZ - r.minZ), material,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // ---- ground ----
  // A floor well past the fence: flying out over the neighbourhood is part of
  // the sandbox, and there has to be something under you when you do it.
  const outside = new THREE.Mesh(
    new THREE.CircleGeometry(m(34), 64),
    new THREE.MeshLambertMaterial({ color: 0x46603a }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.05;
  // Deliberately does not receive: it runs far past the shadow camera, and a
  // clamped shadow map paints its edge texel over everything beyond.
  outside.receiveShadow = false;
  group.add(outside);

  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(m(34), m(0.1), m(34))
      .setTranslation(0, -m(0.1), 0)
      .setFriction(1),
  );

  patch(LAWN, 0.02, mat.lawn);
  // Mower stripes, baked into the ground plane. The near-field grass only
  // reaches ~1.4 m; past that these ARE the lawn, so the yard still reads as
  // mown from the air.
  const stripeW = m(0.6);
  for (let z = LAWN.minZ; z < LAWN.maxZ; z += stripeW * 2) {
    const h = Math.min(stripeW, LAWN.maxZ - z);
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(LAWN.maxX - LAWN.minX, h), mat.lawnStripe,
    );
    s.rotation.x = -Math.PI / 2;
    s.position.set((LAWN.minX + LAWN.maxX) / 2, 0.05, z + h / 2);
    s.receiveShadow = true;
    group.add(s);
  }
  patch(BED_BACK, 0.09, mat.soil);
  patch(BED_WEST, 0.09, mat.soil);

  // ---- stone path: deck steps to the shed door ----
  const pathX = (z: number) => m(0.2) + Math.sin(z / m(1.1)) * m(0.28);
  // Spacing has to exceed the diameter or these read as a poured path rather
  // than as stepping stones with lawn between them.
  const stones = batch(new THREE.CylinderGeometry(m(0.19), m(0.18), m(0.05), 7), mat.stone, 20);
  for (let i = 0; i < 15; i++) {
    const z = m(2.0) - i * m(0.38);
    stones.put(pathX(z), m(0.025), z, rand() * Math.PI);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(m(0.025), m(0.2)).setTranslation(pathX(z), m(0.025), z),
    );
  }
  stones.done();

  // ---- perimeter fence ----
  const PLANK_W = m(0.14);
  const plankGeo = new THREE.BoxGeometry(PLANK_W, FENCE_H, m(0.024));
  const planks = batch(plankGeo, mat.plank, 260);
  const planksDark = batch(plankGeo, mat.plankDark, 130);

  const fenceRun = (ax: number, az: number, bx: number, bz: number) => {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz) + Math.PI / 2;
    const n = Math.max(2, Math.round(len / (PLANK_W * 1.06)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const b = i % 3 === 0 ? planksDark : planks;
      b.put(ax + dx * t, FENCE_H / 2, az + dz * t, yaw);
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(m(0.04), m(0.04), len), mat.plankDark,
    );
    rail.position.set(ax + dx / 2, FENCE_H - m(0.03), az + dz / 2);
    rail.rotation.y = Math.atan2(dx, dz);
    add(rail);
  };

  const FX = m(5.0);
  const FZ0 = m(-4.2);
  const FZ1 = m(4.3);
  fenceRun(-FX, FZ0, FX, FZ0); // back
  fenceRun(-FX, FZ0, -FX, FZ1); // west
  fenceRun(FX, FZ0, FX, FZ1); // east
  planks.done();
  planksDark.done();

  // One collider per run — 500 boxes of broadphase for a wall you touch from
  // one side is pure waste.
  const fenceT = m(0.05);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(FX + fenceT, FENCE_H / 2, fenceT)
      .setTranslation(0, FENCE_H / 2, FZ0 - fenceT),
  );
  for (const s of [-1, 1]) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(fenceT, FENCE_H / 2, (FZ1 - FZ0) / 2)
        .setTranslation(s * (FX + fenceT), FENCE_H / 2, (FZ0 + FZ1) / 2),
    );
  }

  // ---- the house ----
  const HOUSE_Z = m(4.6);
  solidBox(m(12), HOUSE_H, m(0.5), 0, HOUSE_H / 2, HOUSE_Z, mat.siding);
  // Lap siding: horizontal bands are a ruler you can read from any altitude.
  const bands = batch(new THREE.BoxGeometry(m(12), m(0.03), m(0.02)), mat.sidingTrim, 30);
  for (let i = 0; i < 28; i++) {
    bands.put(0, m(0.1) + i * m(0.21), HOUSE_Z - m(0.26));
  }
  bands.done();

  // Roof overhang, and the gutter under it — a channel you can fly INSIDE,
  // which is the first piece of true interior-shaped space in the build.
  const eave = new THREE.Mesh(
    new THREE.BoxGeometry(m(12.4), m(0.09), m(0.85)), mat.shedRoof,
  );
  eave.position.set(0, HOUSE_H + m(0.28), HOUSE_Z - m(0.55));
  add(eave);
  const gutterZ = HOUSE_Z - m(0.85);
  const GUT_W = m(0.11);
  // floor + two walls = an open-topped U you can drop into and fly along
  solidBox(m(11), m(0.02), GUT_W, 0, GUTTER_Y, gutterZ, mat.metal);
  solidBox(m(11), GUT_W, m(0.02), 0, GUTTER_Y + GUT_W / 2, gutterZ - GUT_W / 2, mat.metal);
  solidBox(m(11), GUT_W, m(0.02), 0, GUTTER_Y + GUT_W / 2, gutterZ + GUT_W / 2, mat.metal);
  // Downspout at the east end: a vertical shaft back down to the lawn.
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.06), m(0.06), GUTTER_Y, 10, 1, true), mat.metal,
  );
  spout.material = new THREE.MeshStandardMaterial({
    color: 0x8d9299, roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide,
  });
  spout.position.set(m(4.4), GUTTER_Y / 2, gutterZ);
  add(spout);
  // Hollow: ring of thin boxes, so the bee can fly down the inside of it.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(0.022), GUTTER_Y / 2, m(0.012))
        .setTranslation(m(4.4) + Math.cos(a) * m(0.065), GUTTER_Y / 2, gutterZ + Math.sin(a) * m(0.065))
        .setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }),
    );
  }

  // Back door, at deck level.
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(m(1.05), m(2.2), m(0.06)), mat.sidingTrim,
  );
  doorFrame.position.set(m(0.1), DECK_HEIGHT + m(1.1), HOUSE_Z - m(0.27));
  add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(m(0.9), m(2.0), m(0.05)), mat.door);
  door.position.set(m(0.1), DECK_HEIGHT + m(1.0), HOUSE_Z - m(0.31));
  add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.045), 10, 8), mat.metal);
  knob.position.set(m(-0.28), DECK_HEIGHT + m(1.0), HOUSE_Z - m(0.35));
  add(knob);

  // Kitchen window + sill: a landing ledge 2.4 m up that only a flying thing
  // can reach.
  const winFrame = new THREE.Mesh(
    new THREE.BoxGeometry(m(1.5), m(1.2), m(0.06)), mat.sidingTrim,
  );
  winFrame.position.set(m(-2.6), m(2.55), HOUSE_Z - m(0.27));
  add(winFrame);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(m(1.34), m(1.04)), mat.glass);
  glass.position.set(m(-2.6), m(2.55), HOUSE_Z - m(0.31));
  glass.rotation.y = Math.PI;
  add(glass);
  solidBox(m(1.66), m(0.06), m(0.2), m(-2.6), m(1.9), HOUSE_Z - m(0.36), mat.sidingTrim);

  // ---- the deck ----
  const deckW = DECK.maxX - DECK.minX;
  const deckD = DECK.maxZ - DECK.minZ;
  const deckCX = (DECK.minX + DECK.maxX) / 2;
  const deckCZ = (DECK.minZ + DECK.maxZ) / 2;
  solidBox(deckW, m(0.05), deckD, deckCX, DECK_HEIGHT, deckCZ, mat.deck);
  const seams = batch(new THREE.BoxGeometry(m(0.012), m(0.008), deckD), mat.plankDark, 32);
  for (let i = 1; i < 30; i++) {
    seams.put(DECK.minX + (deckW * i) / 30, DECK_HEIGHT + m(0.028), deckCZ);
  }
  seams.done();
  // Posts. The gaps between them are the point: the underside is a low, dark,
  // human-proof room 0.5 m tall — thirty bee-heights of ceiling.
  for (const px of [DECK.minX + m(0.12), deckCX, DECK.maxX - m(0.12)]) {
    for (const pz of [DECK.minZ + m(0.12), DECK.maxZ - m(0.3)]) {
      solidBox(m(0.09), DECK_HEIGHT, m(0.09), px, DECK_HEIGHT / 2, pz, mat.plankDark);
    }
  }
  // Railing along the lawn edge, with a gap for the steps.
  const balusters = batch(
    new THREE.BoxGeometry(m(0.035), m(0.5), m(0.035)), mat.plank, 40,
  );
  for (let i = 0; i <= 30; i++) {
    const x = DECK.minX + (deckW * i) / 30;
    if (x > m(-0.35) && x < m(0.75)) continue; // step opening
    balusters.put(x, DECK_HEIGHT + m(0.27), DECK.minZ + m(0.04));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(0.018), m(0.25), m(0.018))
        .setTranslation(x, DECK_HEIGHT + m(0.27), DECK.minZ + m(0.04)),
    );
  }
  balusters.done();
  solidBox(deckW, m(0.05), m(0.07), deckCX, DECK_HEIGHT + m(0.54), DECK.minZ + m(0.04), mat.plankDark);
  // Steps down to the lawn.
  for (let i = 0; i < 3; i++) {
    solidBox(
      m(1.1), m(0.05), m(0.2),
      m(0.2), DECK_HEIGHT - m(0.14) * (i + 1), DECK.minZ - m(0.12) - i * m(0.2),
      mat.deck,
    );
  }

  // ---- the shed, up on blocks ----
  const shedW = SHED.maxX - SHED.minX;
  const shedD = SHED.maxZ - SHED.minZ;
  const shedCX = (SHED.minX + SHED.maxX) / 2;
  const shedCZ = (SHED.minZ + SHED.maxZ) / 2;
  const SHED_LIFT = m(0.22); // the crawl gap — thirteen bee-heights of it
  const SHED_H = m(2.1);
  for (const bx of [SHED.minX + m(0.15), SHED.maxX - m(0.15)]) {
    for (const bz of [SHED.minZ + m(0.15), SHED.maxZ - m(0.15)]) {
      solidBox(m(0.16), SHED_LIFT, m(0.16), bx, SHED_LIFT / 2, bz, mat.concrete);
    }
  }
  solidBox(shedW, SHED_H, shedD, shedCX, SHED_LIFT + SHED_H / 2, shedCZ, mat.shed);
  for (const s of [-1, 1]) {
    const slope = new THREE.Mesh(
      new THREE.BoxGeometry(shedW + m(0.14), m(0.04), shedD * 0.62), mat.shedRoof,
    );
    slope.position.set(shedCX, SHED_LIFT + SHED_H + m(0.2), shedCZ + s * shedD * 0.26);
    slope.rotation.x = s * 0.62;
    add(slope);
  }
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(shedW + m(0.16), m(0.05), m(0.06)), mat.plankDark,
  );
  ridge.position.set(shedCX, SHED_LIFT + SHED_H + m(0.38), shedCZ);
  add(ridge);
  const shedDoor = new THREE.Mesh(
    new THREE.BoxGeometry(m(0.04), m(1.85), m(0.8)), mat.plankDark,
  );
  shedDoor.position.set(SHED.minX - m(0.021), SHED_LIFT + m(0.94), shedCZ + m(0.25));
  add(shedDoor);
  const shedWin = new THREE.Mesh(new THREE.PlaneGeometry(m(0.4), m(0.4)), mat.glass);
  shedWin.position.set(SHED.minX - m(0.03), SHED_LIFT + m(1.4), shedCZ - m(0.5));
  shedWin.rotation.y = -Math.PI / 2;
  add(shedWin);

  // ---- the hedge: a wall you can fly THROUGH, unlike the fence ----
  // Gappy on purpose. A hedge that's solid is just a green fence; a hedge with
  // holes is a place to lose a human in.
  const hedgeCX = (HEDGE.minX + HEDGE.maxX) / 2;
  const HEDGE_H = m(1.35);
  const blobs = batch(new THREE.IcosahedronGeometry(m(0.3), 1), mat.leaf, 200);
  const blobsLight = batch(new THREE.IcosahedronGeometry(m(0.26), 1), mat.leafLight, 140);
  for (let z = HEDGE.minZ; z < HEDGE.maxZ; z += m(0.22)) {
    for (let layer = 0; layer < 5; layer++) {
      const y = m(0.25) + layer * m(0.26);
      const jitterX = range(-m(0.1), m(0.1));
      (layer % 2 ? blobsLight : blobs).put(
        hedgeCX + jitterX, y + range(-m(0.05), m(0.05)), z + range(-m(0.06), m(0.06)),
        rand() * Math.PI,
      );
    }
  }
  blobs.done();
  blobsLight.done();
  // Colliders only for the dense lower half — the top is fly-through foliage.
  for (let z = HEDGE.minZ; z < HEDGE.maxZ; z += m(0.42)) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(0.3), m(0.42), m(0.21))
        .setTranslation(hedgeCX, m(0.42), z + m(0.21)),
    );
  }
  void HEDGE_H;

  // ---- the woodpile: stacked logs with tunnels through them ----
  const logGeo = new THREE.CylinderGeometry(m(0.075), m(0.075), m(0.62), 9);
  logGeo.rotateZ(Math.PI / 2);
  const logs = batch(logGeo, mat.bark, 40);
  const pileX = m(1.75);
  const pileZ = m(-3.15);
  for (let row = 0; row < 5; row++) {
    const n = 6 - Math.floor(row / 2);
    for (let i = 0; i < n; i++) {
      if (rand() < 0.16) continue; // gaps you can crawl into
      const z = pileZ + (i - n / 2) * m(0.16);
      const y = m(0.08) + row * m(0.145);
      logs.put(pileX + range(-m(0.02), m(0.02)), y, z);
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(m(0.31), m(0.075))
          .setTranslation(pileX, y, z)
          .setRotation({ x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) }),
      );
    }
  }
  logs.done();

  // ---- the tree: the yard's real altitude ----
  const TRUNK_X = m(-4.2);
  const TRUNK_Z = m(-2.5);
  const TREE_H = m(6.2);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.09), m(0.16), TREE_H, 12), mat.bark,
  );
  trunk.position.set(TRUNK_X, TREE_H / 2, TRUNK_Z);
  add(trunk);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(TREE_H / 2, m(0.13)).setTranslation(TRUNK_X, TREE_H / 2, TRUNK_Z),
  );
  // Branches: perches, grapple anchors, and the reason the canopy is a place
  // rather than a ceiling.
  const branchDirs = [0.4, 1.9, 3.2, 4.7, 5.6];
  branchDirs.forEach((a, i) => {
    const len = m(1.5) + (i % 2) * m(0.5);
    const y = m(2.6) + i * m(0.62);
    const br = new THREE.Mesh(
      new THREE.CylinderGeometry(m(0.03), m(0.06), len, 8), mat.bark,
    );
    br.position.set(
      TRUNK_X + Math.cos(a) * len * 0.5, y + m(0.12), TRUNK_Z + Math.sin(a) * len * 0.5,
    );
    br.rotation.z = Math.PI / 2 - 0.25;
    br.rotation.y = -a;
    add(br);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(len / 2, m(0.05), m(0.05))
        .setTranslation(TRUNK_X + Math.cos(a) * len * 0.5, y + m(0.12), TRUNK_Z + Math.sin(a) * len * 0.5)
        .setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }),
    );
  });
  const canopy = batch(new THREE.IcosahedronGeometry(m(0.42), 1), mat.leaf, 70);
  const canopyLight = batch(new THREE.IcosahedronGeometry(m(0.36), 1), mat.leafLight, 90);
  for (let i = 0; i < 150; i++) {
    const a = rand() * Math.PI * 2;
    // Hollow-ish: bias the mass outward so there is somewhere to BE inside it.
    const r = m(0.6) + Math.sqrt(rand()) * m(1.6);
    (i % 3 ? canopyLight : canopy).put(
      TRUNK_X + Math.cos(a) * r,
      m(3.3) + rand() * m(2.8),
      TRUNK_Z + Math.sin(a) * r,
      rand() * Math.PI,
    );
  }
  canopy.done();
  canopyLight.done();

  // ---- the washing line: one taut rope across the sky ----
  const lineY = m(1.75);
  const postA = new THREE.Vector3(m(-3.4), 0, m(1.9));
  const postB = new THREE.Vector3(m(-3.4), 0, m(-2.9));
  for (const p of [postA, postB]) {
    solidBox(m(0.07), lineY, m(0.07), p.x, lineY / 2, p.z, mat.metal);
    solidBox(m(0.5), m(0.05), m(0.05), p.x, lineY, p.z, mat.metal);
  }
  const lineLen = postA.distanceTo(postB);
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.012), m(0.012), lineLen, 6), mat.concrete,
  );
  rope.position.set(m(-3.4), lineY - m(0.02), (postA.z + postB.z) / 2);
  rope.rotation.x = Math.PI / 2;
  add(rope);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(m(0.014), m(0.014), lineLen / 2)
      .setTranslation(m(-3.4), lineY - m(0.02), (postA.z + postB.z) / 2),
  );
  // A peg and a sock, because an empty line reads as scaffolding.
  const sock = new THREE.Mesh(new THREE.BoxGeometry(m(0.1), m(0.26), m(0.03)), mat.plastic);
  sock.position.set(m(-3.4), lineY - m(0.16), m(0.4));
  add(sock);

  // ---- set dressing ----
  const hose = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(m(0.22) - i * m(0.035), m(0.02), 8, 22), mat.rubber,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = m(0.022) + i * m(0.04);
    hose.add(ring);
  }
  hose.position.set(m(-3.1), 0, m(2.35));
  add(hose);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(m(0.09), m(0.24)).setTranslation(m(-3.1), m(0.09), m(2.35)),
  );

  const potAt = (x: number, z: number, s: number) => {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(m(0.13) * s, m(0.1) * s, m(0.26) * s, 14), mat.terracotta,
    );
    pot.position.set(x, m(0.13) * s, z);
    add(pot);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(m(0.12) * s, m(0.12) * s, m(0.02), 14), mat.soil,
    );
    soil.position.set(x, m(0.25) * s, z);
    add(soil);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(m(0.13) * s, m(0.13) * s).setTranslation(x, m(0.13) * s, z),
    );
  };
  potAt(m(-0.9), m(1.85), 1.1);
  potAt(m(-1.35), m(1.6), 0.85);
  potAt(m(1.1), m(1.9), 1);

  // Bird bath.
  const bathStem = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.05), m(0.08), m(0.72), 12), mat.concrete,
  );
  bathStem.position.set(m(-2.1), m(0.36), m(-1.2));
  add(bathStem);
  // Open bowl, not a disc on a stalk: a rim you can perch on, water set down
  // inside it. The flat version read as a mushroom from every angle.
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.3), m(0.14), m(0.18), 20, 1, true), mat.concrete,
  );
  bowl.material = new THREE.MeshLambertMaterial({
    color: 0xb0aa9c, side: THREE.DoubleSide,
  });
  bowl.position.set(m(-2.1), m(0.78), m(-1.2));
  add(bowl);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(m(0.3), m(0.022), 8, 22), mat.concrete,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(m(-2.1), m(0.87), m(-1.2));
  add(rim);
  const bathWater = new THREE.Mesh(new THREE.CircleGeometry(m(0.27), 20), mat.water);
  bathWater.rotation.x = -Math.PI / 2;
  bathWater.position.set(m(-2.1), m(0.83), m(-1.2));
  group.add(bathWater);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(m(0.4), m(0.08)).setTranslation(m(-2.1), m(0.4), m(-1.2)),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(m(0.055), m(0.26)).setTranslation(m(-2.1), m(0.75), m(-1.2)),
  );

  // Wheelbarrow, tipped against the shed.
  const barrow = new THREE.Group();
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(m(0.62), m(0.34), m(0.42)), mat.metal,
  );
  tray.rotation.z = 0.5;
  barrow.add(tray);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(m(0.14), m(0.05), 8, 18), mat.rubber);
  wheel.position.set(m(-0.34), m(-0.1), 0);
  barrow.add(wheel);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(m(0.7), m(0.04), m(0.04)), mat.plank);
    handle.position.set(m(0.36), m(0.12), s * m(0.15));
    handle.rotation.z = 0.45;
    barrow.add(handle);
  }
  barrow.position.set(m(1.0), m(0.26), m(-1.9));
  barrow.rotation.y = 0.8;
  add(barrow);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(m(0.33), m(0.27), m(0.27)).setTranslation(m(1.0), m(0.27), m(-1.9)),
  );

  // Kiddie pool.
  const poolC = new THREE.Vector3(m(-2.55), 0, m(0.35));
  const POOL_R = m(0.75);
  const poolWall = new THREE.Mesh(
    new THREE.CylinderGeometry(POOL_R, POOL_R, m(0.2), 26, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x3f8fd0, side: THREE.DoubleSide }),
  );
  poolWall.position.set(poolC.x, m(0.1), poolC.z);
  add(poolWall);
  const poolWater = new THREE.Mesh(new THREE.CircleGeometry(POOL_R - m(0.01), 26), mat.water);
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(poolC.x, m(0.12), poolC.z);
  poolWater.receiveShadow = true;
  group.add(poolWater);
  // Floor stops at the visible waterline, so anything dropped in rests ON the
  // water rather than hovering above it.
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(m(0.06), POOL_R - m(0.015)).setTranslation(poolC.x, m(0.06), poolC.z),
  );
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(0.16), m(0.1), m(0.02))
        .setTranslation(poolC.x + Math.cos(a) * POOL_R, m(0.1), poolC.z + Math.sin(a) * POOL_R)
        .setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }),
    );
  }

  // Bin by the side gate.
  const bin = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.28), m(0.23), m(1.05), 16), mat.rubber,
  );
  bin.position.set(m(-4.4), m(0.52), m(3.3));
  add(bin);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.3), m(0.3), m(0.05), 16), mat.plankDark,
  );
  lid.position.set(m(-4.4), m(1.07), m(3.3));
  add(lid);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(m(0.55), m(0.3)).setTranslation(m(-4.4), m(0.55), m(3.3)),
  );

  // ---- beyond the fence: a neighbourhood, so the yard sits IN something ----
  const backdrop = new THREE.Group();
  const neighbourFence = (x: number, z: number, len: number, yaw: number) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.7), m(0.06)), mat.plankDark);
    f.position.set(x, m(0.85), z);
    f.rotation.y = yaw;
    backdrop.add(f);
  };
  neighbourFence(0, m(-13), m(26), 0);
  neighbourFence(m(-14), m(-3), m(21), Math.PI / 2);
  neighbourFence(m(14), m(-3), m(21), Math.PI / 2);

  const houseAt = (x: number, z: number, w: number, h: number, yaw: number, color: number) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.8), new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = h / 2;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, h * 0.42, 4), mat.shedRoof);
    roof.position.y = h + h * 0.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    backdrop.add(g);
  };
  houseAt(m(-17), m(-18), m(9), m(6.5), 0.3, 0xc9bda6);
  houseAt(m(3), m(-21), m(10), m(7), -0.15, 0xb9a894);
  houseAt(m(21), m(-16), m(9.5), m(6.8), 0.5, 0xcfc4b0);
  houseAt(m(-23), m(6), m(9.5), m(7), 1.2, 0xbfae9a);
  houseAt(m(23), m(8), m(9), m(6.4), -1.1, 0xc7bba7);

  const farTree = (x: number, z: number, h: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(m(0.1), m(0.16), h, 8), mat.bark);
    t.position.set(x, h / 2, z);
    backdrop.add(t);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.3, 0), mat.leafFar);
      c.position.set(
        x + range(-h * 0.2, h * 0.2), h + range(-m(0.2), h * 0.25), z + range(-h * 0.2, h * 0.2),
      );
      backdrop.add(c);
    }
  };
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const r = range(m(15), m(28));
    farTree(Math.cos(a) * r, Math.sin(a) * r, range(m(6), m(11)));
  }

  const treeline = new THREE.Mesh(
    new THREE.CylinderGeometry(m(32), m(32), m(7), 44, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x40603a, side: THREE.BackSide }),
  );
  treeline.position.y = m(3.5);
  backdrop.add(treeline);

  backdrop.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false; // it runs past the shadow camera; see `outside`
    }
  });
  group.add(backdrop);

  scene.add(group);
  return { group, groundColliderHandle: groundCollider.handle, sun, updateShadow };
}
