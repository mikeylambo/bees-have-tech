import * as THREE from 'three';
import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';

// THE PROPERTY — the yard stops being a floating disc and becomes a place.
//
// The first build had one fence and an open lawn fading into fog, which read
// as "small patch of land in a void" and let the human boot props into
// nowhere. Per the slice plan the launch footprint is ONE PROPERTY, fully
// realized, so the fix is architectural rather than cosmetic: enclose it.
//
// Four edges, each doing a different job:
//   back fence  — the hive lives in it; the original scale cue
//   side fences — containment, and grapple walls
//   the house   — a 210-unit wall that dwarfs the 100-unit human, with a deck
//                 you can fly UNDER (the first interior-ish space)
//   the shed    — a solid landmark that blocks line of sight, per the doc's
//                 "late-game dungeon"
//
// Everything here is static. Dynamic toys stay in yard.ts.

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function rectContains(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

/** Everything inside the fence line. Props that leave this are recovered. */
export const YARD: Rect = { minX: -72, maxX: 72, minZ: -62, maxZ: 66 };

/** Mown lawn — where grass grows and most of the play happens. */
export const LAWN: Rect = { minX: -70, maxX: 70, minZ: -60, maxZ: 32 };

/** Raised deck against the house. There is a bee-sized world underneath it. */
export const DECK: Rect = { minX: -30, maxX: 42, minZ: 34, maxZ: 64 };
export const DECK_HEIGHT = 7;

/** The shed: a building, not a prop. Blocks sight, blocks walking, climbable. */
export const SHED: Rect = { minX: 38, maxX: 70, minZ: -56, maxZ: -22 };

/** Soil. Flowers get planted here instead of scattered over the lawn. */
export const BED_BACK: Rect = { minX: -70, maxX: 30, minZ: -60, maxZ: -46 };
export const BED_WEST: Rect = { minX: -70, maxX: -54, minZ: -46, maxZ: 24 };

/** Stone path from the deck steps to the shed door. */
export const PATH: Rect = { minX: 2, maxX: 16, minZ: -24, maxZ: 34 };

/** Footprints a walking human must route around. */
export const WALK_BLOCKERS: Rect[] = [SHED];

export interface Property {
  group: THREE.Group;
  /** Aim assist demotes this so the lawn stops eating every grapple shot. */
  groundColliderHandle: number;
  sun: THREE.DirectionalLight;
}

const SKY = 0x9ed0ee;

export function buildProperty(physics: Physics, scene: THREE.Scene, seed: number): Property {
  const { RAPIER, world } = physics;
  const group = new THREE.Group();
  const rand = mulberry32(seed ^ 0x51ed270b);
  const range = rangeFrom(rand);

  // ---- sky, fog, light ----
  scene.background = new THREE.Color(SKY);
  // Fog now starts BEYOND the fence line. The yard reads sharp; the
  // neighbourhood behind it is what softens into haze.
  scene.fog = new THREE.Fog(SKY, 190, 580);

  scene.add(new THREE.HemisphereLight(0xd4e8ff, 0x4a6b34, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  // Sun over the back fence, not over the house. A 210-unit wall lit from the
  // front throws its shadow across the ENTIRE lawn — the first render of this
  // property was a yard in permanent dusk. Light it from the low side so the
  // house shades its own back garden by a few units, not by half the map.
  // Sun over the back fence, high. Two constraints fight here: light from the
  // house side leaves the whole 210-unit wall backlit and grey, and a low sun
  // from any side throws one object's shadow across the entire map. High, and
  // from behind the fence, satisfies both — the house and deck are the faces
  // you actually look at, so they're the ones that get lit.
  sun.position.set(240, 620, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  // Must enclose the property's bounding SPHERE, not its footprint. Sized to
  // the footprint, the 210-unit house fell outside the frustum and the map's
  // clamped edge smeared its shadow over half the lawn — the yard rendered in
  // permanent dusk and it read as a lighting bug, which it was.
  const R = 165;
  sun.shadow.camera.left = -R;
  sun.shadow.camera.right = R;
  sun.shadow.camera.top = R;
  sun.shadow.camera.bottom = -R;
  sun.shadow.camera.near = 250;
  sun.shadow.camera.far = 1150;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // ---- materials ----
  const mat = {
    dirt: new THREE.MeshLambertMaterial({ color: 0x4a3624 }),
    soil: new THREE.MeshLambertMaterial({ color: 0x3a2a1b }),
    lawn: new THREE.MeshLambertMaterial({ color: 0x3d5226 }),
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
    leafFar: new THREE.MeshLambertMaterial({ color: 0x355c2e }),
    terracotta: new THREE.MeshLambertMaterial({ color: 0xb2603c }),
    rubber: new THREE.MeshLambertMaterial({ color: 0x2f7a4f }),
    plasticBlue: new THREE.MeshLambertMaterial({ color: 0x3f8fd0 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3fa8d8, roughness: 0.15, metalness: 0.2,
      transparent: true, opacity: 0.75,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x8d9299, roughness: 0.45, metalness: 0.8,
    }),
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

  /** Box mesh + matching static collider, positioned by centre. */
  const solidBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    material: THREE.Material,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    add(m);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setTranslation(x, y, z)
        .setFriction(0.9),
    );
    return m;
  };

  /** Flat ground patch — visual only, it sits on the ground collider. */
  const patch = (r: Rect, y: number, material: THREE.Material) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r.maxX - r.minX, r.maxZ - r.minZ), material,
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // ---- ground ----
  // One big disc so the world has a floor well past the fence: flying out over
  // the neighbourhood is part of the sandbox, and there must be something
  // under you when you do it.
  const outside = new THREE.Mesh(
    new THREE.CircleGeometry(520, 64),
    new THREE.MeshLambertMaterial({ color: 0x46603a }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.05;
  // Deliberately does NOT receive: it runs far past the shadow camera, and a
  // clamped shadow map paints its edge texel over everything beyond — which
  // showed up as hard black quads out past the fence.
  outside.receiveShadow = false;
  group.add(outside);

  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(520, 0.5, 520).setTranslation(0, -0.5, 0).setFriction(1),
  );

  // The mown lawn, a shade brighter than the world outside the fence.
  patch(LAWN, 0.02, mat.lawn);
  patch(BED_BACK, 0.06, mat.soil);
  patch(BED_WEST, 0.06, mat.soil);

  // ---- stone path: deck steps to the shed ----
  for (let i = 0; i < 9; i++) {
    const z = 30 - i * 6.6;
    const s = range(3.4, 4.6);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.95, 0.5, 7), mat.stone);
    stone.position.set(9 + Math.sin(i * 1.7) * 3.5, 0.25, z);
    stone.rotation.y = rand() * Math.PI;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.25, s).setTranslation(stone.position.x, 0.25, z),
    );
  }

  // ---- perimeter fence ----
  // Vertical planks with a top rail. At bee scale a 60-unit fence is a cliff
  // face, which is exactly the read we want.
  const FENCE_H = 60;
  const plankGeo = new THREE.BoxGeometry(7, FENCE_H, 1.4);

  const fenceRun = (
    from: THREE.Vector2, to: THREE.Vector2,
  ) => {
    const dx = to.x - from.x;
    const dz = to.y - from.y;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const n = Math.max(2, Math.round(len / 7.6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const plank = new THREE.Mesh(plankGeo, i % 3 === 0 ? mat.plankDark : mat.plank);
      plank.position.set(from.x + dx * t, FENCE_H / 2, from.y + dz * t);
      plank.rotation.y = yaw + Math.PI / 2;
      add(plank);
    }
    // Rail along the top — reads as carpentry rather than a wall of sticks.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, len), mat.plankDark);
    rail.position.set(from.x + dx / 2, FENCE_H - 1.5, from.y + dz / 2);
    rail.rotation.y = yaw;
    add(rail);
  };

  fenceRun(new THREE.Vector2(-72, -62), new THREE.Vector2(72, -62)); // back
  fenceRun(new THREE.Vector2(-72, -62), new THREE.Vector2(-72, 62)); // west
  fenceRun(new THREE.Vector2(72, -62), new THREE.Vector2(72, 62)); // east

  // One collider per run rather than per plank — 60 boxes of broadphase for a
  // wall the bee only ever touches from one side is a waste.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(73, FENCE_H / 2, 0.9).setTranslation(0, FENCE_H / 2, -62.6),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9, FENCE_H / 2, 63).setTranslation(-72.6, FENCE_H / 2, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9, FENCE_H / 2, 63).setTranslation(72.6, FENCE_H / 2, 0),
  );

  // ---- the house ----
  // 210 units against a 100-unit human: the wall is the scale argument.
  const HOUSE_Z = 70;
  const HOUSE_H = 210;
  solidBox(150, HOUSE_H, 8, 0, HOUSE_H / 2, HOUSE_Z, mat.siding);
  // Lap siding: horizontal bands catch the sun and give the wall a scale ruler.
  for (let i = 0; i < 14; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(150, 1.6, 1.2), mat.sidingTrim);
    band.position.set(0, 6 + i * 15, HOUSE_Z - 4.4);
    band.castShadow = false;
    band.receiveShadow = true;
    group.add(band);
  }
  // Roof overhang — the deck sits in its shade, which sells "under cover".
  const eave = new THREE.Mesh(new THREE.BoxGeometry(158, 5, 26), mat.shedRoof);
  eave.position.set(0, HOUSE_H + 2, HOUSE_Z - 14);
  add(eave);

  // Back door, at deck level.
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(30, 52, 2), mat.sidingTrim);
  doorFrame.position.set(6, DECK_HEIGHT + 26, HOUSE_Z - 4.2);
  add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(25, 47, 1.6), mat.door);
  door.position.set(6, DECK_HEIGHT + 24, HOUSE_Z - 5.2);
  add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), mat.metal);
  knob.position.set(-4, DECK_HEIGHT + 24, HOUSE_Z - 6);
  add(knob);

  // Kitchen window + sill. The sill is a landing ledge 84 units up — a
  // destination that only a flying thing can reach.
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(52, 40, 2), mat.sidingTrim);
  winFrame.position.set(-40, 84, HOUSE_Z - 4.2);
  add(winFrame);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(46, 34), mat.glass);
  glass.position.set(-40, 84, HOUSE_Z - 5.4);
  glass.rotation.y = Math.PI;
  add(glass);
  solidBox(58, 2.4, 7, -40, 63, HOUSE_Z - 7, mat.sidingTrim);

  // ---- the deck ----
  const deckW = DECK.maxX - DECK.minX;
  const deckD = DECK.maxZ - DECK.minZ;
  const deckCX = (DECK.minX + DECK.maxX) / 2;
  const deckCZ = (DECK.minZ + DECK.maxZ) / 2;
  solidBox(deckW, 2, deckD, deckCX, DECK_HEIGHT, deckCZ, mat.deck);
  // Board lines, so the surface has a grain to fly along.
  for (let i = 1; i < 12; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, deckD), mat.plankDark);
    seam.position.set(DECK.minX + (deckW * i) / 12, DECK_HEIGHT + 1.1, deckCZ);
    seam.castShadow = false;
    seam.receiveShadow = true;
    group.add(seam);
  }
  // Posts. The gaps between them are the point: the underside of the deck is
  // a low, dark, human-proof room.
  for (const px of [DECK.minX + 3, deckCX, DECK.maxX - 3]) {
    for (const pz of [DECK.minZ + 3, DECK.maxZ - 8]) {
      solidBox(3.5, DECK_HEIGHT, 3.5, px, DECK_HEIGHT / 2, pz, mat.plankDark);
    }
  }
  // Railing along the lawn edge, with a gap for the steps.
  for (let i = 0; i <= 18; i++) {
    const x = DECK.minX + (deckW * i) / 18;
    if (x > -2 && x < 20) continue; // step opening
    solidBox(1.6, 14, 1.6, x, DECK_HEIGHT + 8, DECK.minZ + 1, mat.plank);
  }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(deckW, 2, 3), mat.plankDark);
  topRail.position.set(deckCX, DECK_HEIGHT + 15.5, DECK.minZ + 1);
  add(topRail);
  // Steps down to the lawn.
  for (let i = 0; i < 3; i++) {
    solidBox(18, 2, 6, 9, DECK_HEIGHT - 2 - i * 2.2, DECK.minZ - 3 - i * 6, mat.deck);
  }

  // ---- the shed ----
  const shedW = SHED.maxX - SHED.minX;
  const shedD = SHED.maxZ - SHED.minZ;
  const shedCX = (SHED.minX + SHED.maxX) / 2;
  const shedCZ = (SHED.minZ + SHED.maxZ) / 2;
  const SHED_H = 46;
  solidBox(shedW, SHED_H, shedD, shedCX, SHED_H / 2, shedCZ, mat.shed);
  // Pitched roof: two slabs, so the silhouette says "building" from anywhere.
  for (const s of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(shedW + 6, 1.8, shedD * 0.62), mat.shedRoof);
    slope.position.set(shedCX, SHED_H + 6, shedCZ + s * shedD * 0.26);
    slope.rotation.x = s * 0.62;
    add(slope);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(shedW + 7, 2, 2.5), mat.plankDark);
  ridge.position.set(shedCX, SHED_H + 11.5, shedCZ);
  add(ridge);
  // Door facing the path, and a window: a shed you can read the front of.
  const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 30, 16), mat.plankDark);
  shedDoor.position.set(SHED.minX - 0.9, 15, shedCZ + 5);
  add(shedDoor);
  const shedWin = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat.glass);
  shedWin.position.set(SHED.minX - 1.1, 30, shedCZ - 10);
  shedWin.rotation.y = -Math.PI / 2;
  add(shedWin);

  // ---- set dressing: every one of these is a grapple anchor or a hiding spot ----

  // Coiled hose — reads instantly, and it's a ramp and a wall at bee scale.
  const hose = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9 - i * 1.5, 1.1, 8, 24), mat.rubber,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2 + i * 2.1;
    hose.add(ring);
  }
  hose.position.set(-46, 0, 38);
  add(hose);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(5, 9.5).setTranslation(-46, 5, 38),
  );

  // Terracotta pots by the steps.
  const potAt = (x: number, z: number, s: number) => {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4 * s, 3.2 * s, 8 * s, 14), mat.terracotta,
    );
    pot.position.set(x, 4 * s, z);
    add(pot);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(4.1 * s, 4.1 * s, 0.6, 14), mat.soil,
    );
    soil.position.set(x, 7.8 * s, z);
    add(soil);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(4 * s, 4.4 * s).setTranslation(x, 4 * s, z),
    );
  };
  potAt(-14, 26, 1.1);
  potAt(-24, 22, 0.85);
  potAt(26, 27, 1);

  // Bird bath — a pedestal with standing water, high enough to be a perch.
  const bathStem = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4, 26, 12), mat.concrete);
  bathStem.position.set(-40, 13, -14);
  add(bathStem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(11, 6, 5, 18), mat.concrete);
  bowl.position.set(-40, 28, -14);
  add(bowl);
  const bathWater = new THREE.Mesh(new THREE.CircleGeometry(9.4, 18), mat.water);
  bathWater.rotation.x = -Math.PI / 2;
  bathWater.position.set(-40, 30.3, -14);
  group.add(bathWater);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(15, 4).setTranslation(-40, 15, -14),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(2.5, 11).setTranslation(-40, 28, -14),
  );

  // Wheelbarrow, tipped against the shed.
  const barrow = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 14), mat.metal);
  tray.rotation.z = 0.5;
  barrow.add(tray);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(5, 1.8, 8, 18), mat.rubber);
  wheel.position.set(-11, -3, 0);
  barrow.add(wheel);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 1.6), mat.plank);
    handle.position.set(12, 4, s * 5);
    handle.rotation.z = 0.45;
    barrow.add(handle);
  }
  barrow.position.set(28, 9, -46);
  barrow.rotation.y = 0.8;
  add(barrow);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(11, 9, 9).setTranslation(28, 9, -46),
  );

  // Kiddie pool — a shallow disc of water on the lawn.
  const poolWall = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 22, 6, 24, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x3f8fd0, side: THREE.DoubleSide }),
  );
  poolWall.position.set(-34, 3, 4);
  add(poolWall);
  const poolWater = new THREE.Mesh(new THREE.CircleGeometry(21.4, 24), mat.water);
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(-34, 3.6, 4);
  poolWater.receiveShadow = true;
  group.add(poolWater);
  // Floor stops exactly at the visible waterline, so anything dropped in
  // rests ON the water instead of hovering over it.
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(1.8, 21.6).setTranslation(-34, 1.8, 4),
  );
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rim = RAPIER.ColliderDesc.cuboid(5.2, 3, 1)
      .setTranslation(-34 + Math.cos(a) * 22, 3, 4 + Math.sin(a) * 22)
      .setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) });
    world.createCollider(rim);
  }

  // Bin by the side gate.
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(11, 9, 34, 14), mat.rubber);
  bin.position.set(-60, 17, 46);
  add(bin);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 11.6, 2.4, 14), mat.plankDark);
  lid.position.set(-60, 35, 46);
  add(lid);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(18, 11.5).setTranslation(-60, 18, 46),
  );

  // ---- the tree: the yard's only real altitude ----
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 120, 12), mat.bark);
  trunk.position.set(-58, 60, -30);
  add(trunk);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(60, 7.5).setTranslation(-58, 60, -30),
  );
  for (let i = 0; i < 5; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(range(26, 38), 1), mat.leaf);
    blob.position.set(
      -58 + range(-26, 26), range(110, 150), -30 + range(-24, 24),
    );
    add(blob);
  }

  // ---- beyond the fence: a neighbourhood, so the yard sits IN something ----
  // No colliders out here. It exists to kill the void, and to reward flying
  // over the fence with a view instead of grey.
  const backdrop = new THREE.Group();

  const neighbourFence = (x: number, z: number, len: number, yaw: number) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(len, 52, 3), mat.plankDark);
    f.position.set(x, 26, z);
    f.rotation.y = yaw;
    backdrop.add(f);
  };
  neighbourFence(0, -190, 400, 0);
  neighbourFence(-210, -40, 320, Math.PI / 2);
  neighbourFence(210, -40, 320, Math.PI / 2);
  neighbourFence(0, 250, 460, 0);

  const houseAt = (x: number, z: number, w: number, h: number, yaw: number, color: number) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.8),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = h / 2;
    g.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.82, h * 0.42, 4), mat.shedRoof,
    );
    roof.position.y = h + h * 0.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    backdrop.add(g);
  };
  houseAt(-250, -260, 150, 200, 0.3, 0xc9bda6);
  houseAt(40, -300, 175, 230, -0.15, 0xb9a894);
  houseAt(300, -230, 160, 210, 0.5, 0xcfc4b0);
  houseAt(-330, 90, 165, 215, 1.2, 0xbfae9a);
  houseAt(330, 120, 155, 195, -1.1, 0xc7bba7);

  const farTree = (x: number, z: number, h: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, h, 8), mat.bark);
    t.position.set(x, h / 2, z);
    backdrop.add(t);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.3, 0), mat.leafFar);
      c.position.set(x + range(-h * 0.2, h * 0.2), h + range(-10, h * 0.25), z + range(-h * 0.2, h * 0.2));
      backdrop.add(c);
    }
  };
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = range(230, 430);
    farTree(Math.cos(a) * r, Math.sin(a) * r, range(180, 330));
  }

  // Treeline on the horizon: one ring, fogged to a soft band. Cheap horizon.
  const treeline = new THREE.Mesh(
    new THREE.CylinderGeometry(500, 500, 190, 40, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x40603a, side: THREE.BackSide }),
  );
  treeline.position.y = 95;
  backdrop.add(treeline);

  backdrop.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false; // same shadow-map clamping problem
    }
  });
  group.add(backdrop);

  scene.add(group);
  return { group, groundColliderHandle: groundCollider.handle, sun };
}
