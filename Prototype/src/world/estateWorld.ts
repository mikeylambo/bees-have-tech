import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';
import { ESTATE, ZONES, M, type Zone, type ZoneKind } from './estateBlockout';

// THE ESTATE, BUILT.
//
// estateBlockout.ts is the plan — pure data, no Three.js, so it survives a
// port to a real engine. This file is the current renderer of that plan:
// every zone becomes geometry, a collider, or both, and the gameplay systems
// get the anchors they need (spawn, walkable region, keep-out lists).
//
// The rule that keeps the two files honest: NOTHING here invents a position.
// If a thing needs to exist somewhere, it gets a zone in the blockout first.
//
// 90 x 120 m. The old backyard was 87 m2; this is 10,800. What makes that
// tractable is that the two expensive systems are area-independent — the
// grass field and the shadow frustum both follow the bee — so the cost scales
// with how much STUFF is here, not with acreage.

export type { Zone, ZoneKind };
export { M, ESTATE };

/** Shorthand: the blockout is in metres, the runtime is in units. */
const m = (metres: number) => metres * M;

export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number; }

export function rectContains(r: Rect, x: number, z: number, pad = 0): boolean {
  return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;
}

const BY_ID = new Map(ZONES.map((z) => [z.id, z]));

/** Look a zone up by id. Throws rather than silently placing things at 0,0. */
export function zone(id: string): Zone {
  const z = BY_ID.get(id);
  if (!z) throw new Error(`no such zone: ${id}`);
  return z;
}

/** A zone's plan footprint in world units. */
export function zoneRect(z: Zone, pad = 0): Rect {
  return {
    minX: m(z.x - z.w / 2) - pad, maxX: m(z.x + z.w / 2) + pad,
    minZ: m(z.z - z.d / 2) - pad, maxZ: m(z.z + z.d / 2) + pad,
  };
}

/** Centre of a zone in world units, at ground level unless it says otherwise. */
export function zoneCentre(id: string, out = new THREE.Vector3()): THREE.Vector3 {
  const z = zone(id);
  return out.set(m(z.x), m(z.y ?? 0), m(z.z));
}

/**
 * Where the bee starts: on the drive, just north of the gate, low, looking up
 * the spine. The first thing you should see is the 80 m straight — the one
 * place on the property built for holding overdrive in a line.
 */
export const SPAWN = new THREE.Vector3(m(0), m(0.35), m(-54));

/** Where the hive lives — a hollow in the west gate pillar, per the blockout. */
export const HIVE_AT = new THREE.Vector3(m(-6.5), m(1.4), m(-58.0));

/** Everything inside the boundary wall. */
export const BOUNDS: Rect = {
  minX: m(ESTATE.minX), maxX: m(ESTATE.maxX),
  minZ: m(ESTATE.minZ), maxZ: m(ESTATE.maxZ),
};

/** Where a person can stand — inset off the wall line so they never clip it. */
export const WALKABLE: Rect = {
  minX: m(ESTATE.minX + 2.5), maxX: m(ESTATE.maxX - 2.5),
  minZ: m(ESTATE.minZ + 2.5), maxZ: m(ESTATE.maxZ - 2.5),
};

/** Which zone kinds are solid mass a walking person has to go around. */
const SOLID_TO_WALKERS: ZoneKind[] = ['building', 'glass', 'wall', 'water'];

/**
 * Rectangular footprints a walking human must route around. Derived from the
 * blockout rather than typed out, so moving a building in the plan moves the
 * thing people walk around too — the M5 bug where the deck was missing from
 * this list is only possible if the list is hand-maintained.
 */
export const WALK_BLOCKERS: Rect[] = ZONES
  .filter((z) => SOLID_TO_WALKERS.includes(z.kind) && z.h > 0.15)
  .map((z) => zoneRect(z));

/** Round obstacles: [x, z, radius] in world units — trunks, posts, planters. */
export const WALK_BLOCK_CIRCLES: Array<[number, number, number]> = ZONES
  .filter((z) => (z.kind === 'planting' && z.h >= 5) || z.id.startsWith('light-')
    || z.id === 'compost' || z.id === 'fountain-island')
  .map((z) => [m(z.x), m(z.z), m(Math.max(z.w, z.d) / 2)] as [number, number, number]);

/** Surfaces the grass field must not grow through. */
const GRASS_KEEP_OUT: Rect[] = ZONES
  .filter((z) => ['paving', 'gravel', 'building', 'glass', 'water', 'wall'].includes(z.kind)
    || (z.kind === 'planting' && z.h > 0 && z.h < 5))
  .map((z) => zoneRect(z, m(0.15)));

const GRASS_BARE: Array<[number, number, number]> = ZONES
  .filter((z) => z.kind === 'planting' && z.h >= 5)
  .map((z) => [m(z.x), m(z.z), m(Math.max(z.w, z.d) * 0.42)] as [number, number, number]);

// ---- the cut ----
//
// Somebody mows this lawn, and at bee scale that is not a chore, it is a
// geological event. The mower needs to leave the world CHANGED, so the cut is
// stored rather than drawn: a coarse grid of "this has been mown" cells that
// the grass field consults when it scatters a tile.
//
// 0.5 m cells over 90 x 120 m is 180 x 240 = 43,200 bytes. One Uint8Array,
// an O(1) lookup in a test the field already runs per blade, and a lawn that
// stays mown because the blades were never scattered there in the first place
// — no decals, no second render pass, nothing to keep in sync.
const CUT_CELL = m(0.5);
const CUT_W = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CUT_CELL);
const CUT_D = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CUT_CELL);
const cut = new Uint8Array(CUT_W * CUT_D);

function cutIndex(x: number, z: number): number {
  const ix = Math.floor((x - BOUNDS.minX) / CUT_CELL);
  const iz = Math.floor((z - BOUNDS.minZ) / CUT_CELL);
  if (ix < 0 || iz < 0 || ix >= CUT_W || iz >= CUT_D) return -1;
  return iz * CUT_W + ix;
}

/** Mow a disc. Returns true if anything was actually still standing there. */
export function cutGrass(x: number, z: number, radius: number): boolean {
  let changed = false;
  const r = Math.max(CUT_CELL * 0.5, radius);
  for (let dz = -r; dz <= r; dz += CUT_CELL) {
    for (let dx = -r; dx <= r; dx += CUT_CELL) {
      if (dx * dx + dz * dz > r * r) continue;
      const i = cutIndex(x + dx, z + dz);
      if (i < 0 || cut[i]) continue;
      cut[i] = 1;
      changed = true;
    }
  }
  return changed;
}

export function isCut(x: number, z: number): boolean {
  const i = cutIndex(x, z);
  return i >= 0 && cut[i] === 1;
}

/** How much of the lawn has been taken down. Drives the "somebody noticed" beat. */
export function cutFraction(): number {
  let n = 0;
  for (let i = 0; i < cut.length; i++) n += cut[i];
  return n / cut.length;
}

export function clearCut() {
  cut.fill(0);
}

/** Blades grow on open ground only. Injected into the grass field. */
export function grassBlocked(x: number, z: number): boolean {
  if (!rectContains(BOUNDS, x, z, -m(1))) return true;
  if (isCut(x, z)) return true;
  for (const r of GRASS_KEEP_OUT) if (rectContains(r, x, z)) return true;
  for (const [cx, cz, cr] of GRASS_BARE) {
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < cr * cr) return true;
  }
  return false;
}

export interface Estate {
  group: THREE.Group;
  /** Aim assist demotes this so open ground stops eating every grapple shot. */
  groundColliderHandle: number;
  sun: THREE.DirectionalLight;
  updateShadow: (focus: THREE.Vector3) => void;
}

const SKY = 0x9ed0ee;

export function buildEstate(physics: Physics, scene: THREE.Scene, seed: number): Estate {
  const { RAPIER, world } = physics;
  const group = new THREE.Group();
  const rand = mulberry32(seed ^ 0x2f6d10b3);
  const range = rangeFrom(rand);

  // ---- sky, fog, light ----
  scene.background = new THREE.Color(SKY);
  // The diagonal is 150 m. Fog has to sit beyond the far end of the drive or
  // the estate's whole point — that you can SEE how far away things are —
  // gets erased at the exact distances that make it feel big.
  scene.fog = new THREE.Fog(SKY, m(48), m(165));

  scene.add(new THREE.HemisphereLight(0xd4e8ff, 0x4a6b34, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  // High, from the south-west, so the house facade and the gate are both lit
  // and no single building throws a shadow the length of the property.
  const SUN_OFFSET = new THREE.Vector3(m(9), m(22), m(-6));
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // The frustum rides with the bee, so its size is set by how far you can SEE
  // sharp shadows, not by the size of the property. This is the single reason
  // a 10,800 m2 estate costs the same to shadow as an 87 m2 yard.
  const SHADOW_R = m(6.0);
  sun.shadow.camera.left = -SHADOW_R;
  sun.shadow.camera.right = SHADOW_R;
  sun.shadow.camera.top = SHADOW_R;
  sun.shadow.camera.bottom = -SHADOW_R;
  sun.shadow.camera.near = m(4);
  sun.shadow.camera.far = m(46);
  sun.shadow.bias = -0.0009;
  scene.add(sun);
  scene.add(sun.target);

  const _focus = new THREE.Vector3();
  const updateShadow = (focus: THREE.Vector3) => {
    // Snap to a coarse grid or the shadow map crawls a texel at a time and
    // every edge on the property shimmers as you fly.
    const step = m(0.5);
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
  // One material per role, shared across every zone that plays that role.
  // Sharing is what keeps a 200-object property inside a sane draw call count.
  const mat = {
    lawn: new THREE.MeshLambertMaterial({ color: 0x5c8c3c }),
    meadow: new THREE.MeshLambertMaterial({ color: 0x578639 }),
    paving: new THREE.MeshLambertMaterial({ color: 0xb5aea0 }),
    pavingEdge: new THREE.MeshLambertMaterial({ color: 0x9c9486 }),
    gravel: new THREE.MeshLambertMaterial({ color: 0xa89c86 }),
    wall: new THREE.MeshLambertMaterial({ color: 0xd8cfbc }),
    wallCap: new THREE.MeshLambertMaterial({ color: 0xa79d8a }),
    roof: new THREE.MeshLambertMaterial({ color: 0x6d4a3c }),
    trim: new THREE.MeshLambertMaterial({ color: 0xf0ece2 }),
    window: new THREE.MeshLambertMaterial({ color: 0x2c4658 }),
    glass: new THREE.MeshLambertMaterial({
      color: 0xbfe3ea, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    }),
    water: new THREE.MeshLambertMaterial({
      color: 0x2f86c9, transparent: true, opacity: 0.78,
    }),
    hedge: new THREE.MeshLambertMaterial({ color: 0x3f6d34 }),
    bark: new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    canopy: new THREE.MeshLambertMaterial({ color: 0x3d6f31 }),
    canopyLight: new THREE.MeshLambertMaterial({ color: 0x4b7f39 }),
    metal: new THREE.MeshLambertMaterial({ color: 0x8a8578 }),
    lamp: new THREE.MeshLambertMaterial({ color: 0xffe9a8 }),
    soil: new THREE.MeshLambertMaterial({ color: 0x3a2a1b }),
  };

  // ---- static geometry batching ----
  //
  // The blockout is ~1,400 boxes once windows, hedges, tree canopies, path
  // lights and gate bars are counted, and not one of them ever moves. As
  // individual meshes that is 1,400 draw calls per pass, tripled by the
  // outline pass — measured at 4,078 calls a frame before this. Merged by
  // material it is about a dozen.
  //
  // Everything is converted to non-indexed first: BoxGeometry is indexed and
  // IcosahedronGeometry is not, and mergeGeometries refuses a mixed bucket.
  const casters = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const flats = new Map<THREE.Material, THREE.BufferGeometry[]>();

  const push = (
    geo: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number, yaw = 0, cast = true,
  ) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (yaw) g.rotateY(yaw);
    g.translate(x, y, z);
    const bucket = cast ? casters : flats;
    const list = bucket.get(material);
    if (list) list.push(g);
    else bucket.set(material, [g]);
  };

  const box = (
    w: number, h: number, d: number, material: THREE.Material,
    x: number, y: number, z: number, yaw = 0, cast = true,
  ) => push(new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z, yaw, cast);

  /**
   * A hipped roof: a four-sided frustum, so a house tops out in a ridge
   * instead of the flat brown slab a box gives you. The collider is the
   * frustum's own convex hull rather than a box, or the eaves would be
   * invisible solid air a bee bounces off.
   */
  const hipRoof = (
    w: number, h: number, d: number, x: number, y: number, z: number,
  ) => {
    const g = new THREE.CylinderGeometry(0.5 / Math.SQRT2, 1 / Math.SQRT2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(w, h, d);
    push(g, mat.roof, x, y + h / 2, z);
    const hw = w / 2; const hd = d / 2; const tw = w / 4; const td = d / 4;
    const pts = new Float32Array([
      -hw, -h / 2, -hd, hw, -h / 2, -hd, hw, -h / 2, hd, -hw, -h / 2, hd,
      -tw, h / 2, -td, tw, h / 2, -td, tw, h / 2, td, -tw, h / 2, td,
    ]);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y + h / 2, z),
    );
    const hull = RAPIER.ColliderDesc.convexHull(pts);
    if (hull) world.createCollider(hull, body);
  };

  /** A horizontal surface — lawn panels, soil beds, water. */
  const plane = (
    w: number, d: number, material: THREE.Material,
    x: number, y: number, z: number,
  ) => push(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), material, x, y, z, 0, false,
  );

  /** A static box collider matching a mesh placed by `box`. */
  const solid = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y + h / 2, z),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  };

  // ---- the ground ----
  // One plane under everything. Surfaces (terrace, drive, pool deck) are thin
  // slabs laid ON it rather than holes cut INTO it, which keeps the ground a
  // single draw call and a single collider.
  const groundW = m(ESTATE.width) + m(24);
  const groundD = m(ESTATE.depth) + m(24);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundW, groundD), mat.meadow);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(groundW / 2, m(0.5), groundD / 2)
      .setTranslation(0, -m(0.5), 0),
    groundBody,
  );

  // ---- zones ----
  for (const z of ZONES) {
    // The greybox's scale figures are replaced by the real household, and the
    // hive is a game object with a mouth and a workbench, not a grey box.
    if (z.kind === 'ref' || z.id === 'hive') continue;

    const x = m(z.x);
    const zz = m(z.z);
    const w = m(z.w);
    const d = m(z.d);
    const h = m(z.h);
    const y = m(z.y ?? 0);

    switch (z.kind) {
      case 'ground': {
        // A shade off the base plane, so the lawn panels read as mown areas
        // inside the meadow instead of the whole property being one green.
        plane(w, d, mat.lawn, x, m(0.006), zz);
        break;
      }

      case 'paving':
      case 'gravel': {
        const surface = z.kind === 'paving' ? mat.paving : mat.gravel;
        box(w, Math.max(h, m(0.02)), d, surface, x, y, zz, 0, false);
        // A 25 cm terrace lip is a fifteen-storey drop to a bee, so it has to
        // be solid — you should be able to land on it and fly under nothing.
        if (h > m(0.06)) solid(w, h, d, x, y, zz);
        break;
      }

      case 'water': {
        // Floor to the waterline plus a rim, never a solid disc: a solid pool
        // leaves props resting on invisible air above the surface.
        plane(w, d, mat.water, x, y + h, zz);
        box(
          w + m(0.5), Math.max(h, m(0.05)), d + m(0.5), mat.pavingEdge,
          x, y - m(0.02), zz, 0, false,
        );
        solid(w + m(0.5), Math.max(h, m(0.05)), d + m(0.5), x, y - m(0.02), zz);
        break;
      }

      case 'planting': {
        if (z.h >= 5) {
          // A tree. Trunk is solid; the canopy is NOT, because flying up into
          // the leaves is the best cover on the property and a collider there
          // would turn it into a wall you bounce off.
          const trunkR = m(Math.max(z.w, z.d) * 0.09);
          const trunkH = h * 0.45;
          push(
            new THREE.CylinderGeometry(trunkR * 0.8, trunkR, trunkH, 7),
            mat.bark, x, trunkH / 2, zz,
          );
          const trunkBody = world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed().setTranslation(x, trunkH / 2, zz),
          );
          world.createCollider(
            RAPIER.ColliderDesc.cylinder(trunkH / 2, trunkR), trunkBody,
          );
          const blobs = 3;
          for (let i = 0; i < blobs; i++) {
            const r = (w * 0.5) * range(0.6, 0.95);
            push(
              new THREE.IcosahedronGeometry(r, 1),
              i % 2 ? mat.canopy : mat.canopyLight,
              x + range(-w * 0.2, w * 0.2),
              trunkH + h * 0.18 + i * h * 0.14,
              zz + range(-d * 0.2, d * 0.2),
            );
          }
        } else if (z.h > 0) {
          // Clipped hedge: solid, and at bee scale a canyon wall.
          box(w, h, d, mat.hedge, x, y, zz);
          solid(w, h, d, x, y, zz);
        } else {
          // A bed you can land on, no mass. The formal garden's floor is
          // raked gravel between the box hedges — as bare soil it read as a
          // 28 x 20 m mud rectangle from the air.
          plane(w, d, z.id === 'parterre' ? mat.gravel : mat.soil, x, m(0.01), zz);
        }
        break;
      }

      case 'wall': {
        if (z.hollow) {
          // The gate: ironwork you can fly through the gaps of, and the best
          // climbing frame on the property.
          const bars = 11;
          for (let i = 0; i < bars; i++) {
            const bx = x - w / 2 + (w * (i + 0.5)) / bars;
            box(m(0.09), h, d, mat.metal, bx, y, zz);
            solid(m(0.09), h, d, bx, y, zz);
          }
          box(w, m(0.16), d * 1.6, mat.metal, x, y + h, zz);
          solid(w, m(0.16), d * 1.6, x, y + h, zz);
        } else {
          box(w, h, d, mat.wall, x, y, zz);
          box(w + m(0.12), m(0.16), d + m(0.12), mat.wallCap, x, y + h, zz);
          solid(w, h + m(0.16), d, x, y, zz);
        }
        break;
      }

      case 'glass': {
        shell(z, mat.glass, true);
        break;
      }

      case 'building': {
        if (z.hollow) {
          shell(z, mat.wall, false);
        } else if (z.id.endsWith('-roof')) {
          hipRoof(w, h, d, x, y, zz);
        } else {
          box(w, h, d, mat.wall, x, y, zz);
          solid(w, h, d, x, y, zz);
          if (h > m(3)) facade(x, y, zz, w, d, h);
        }
        break;
      }

      case 'prop': {
        if (z.id.startsWith('light-')) {
          const postR = m(0.045);
          push(
            new THREE.CylinderGeometry(postR, postR, h, 6), mat.metal, x, h / 2, zz,
          );
          push(
            new THREE.ConeGeometry(m(0.16), m(0.18), 7), mat.lamp,
            x, h + m(0.06), zz, 0, false,
          );
          const lightBody = world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed().setTranslation(x, h / 2, zz),
          );
          world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, postR), lightBody);
        } else if (z.hollow) {
          // Gutter runs and the climbing frame: channels and cages you fly
          // INSIDE. Floor plus two sides, open along the top and both ends.
          const t = Math.max(m(0.06), Math.min(w, d) * 0.12);
          const along = w >= d;
          box(w, t, d, mat.metal, x, y, zz);
          solid(w, t, d, x, y, zz);
          if (along) {
            for (const s of [-1, 1]) {
              box(w, h, t, mat.metal, x, y, zz + (s * d) / 2);
              solid(w, h, t, x, y, zz + (s * d) / 2);
            }
          } else {
            for (const s of [-1, 1]) {
              box(t, h, d, mat.metal, x + (s * w) / 2, y, zz);
              solid(t, h, d, x + (s * w) / 2, y, zz);
            }
          }
        } else {
          box(w, h, d, mat.metal, x, y, zz);
          solid(w, h, d, x, y, zz);
        }
        break;
      }
    }
  }

  /**
   * A hollow volume: four walls, a roof, one wall left open. The opening is
   * the whole point — a building the bee cannot get into is scenery, and the
   * design doc's "volume, not area" argument dies with it.
   */
  function shell(z: Zone, material: THREE.Material, roofVent: boolean) {
    const x = m(z.x); const zz = m(z.z);
    const w = m(z.w); const d = m(z.d); const h = m(z.h); const y = m(z.y ?? 0);
    const t = Math.max(m(0.14), Math.min(w, d) * 0.045);

    // south wall, split around a doorway you can fly through
    const gap = Math.min(w * 0.34, m(2.4));
    for (const s of [-1, 1]) {
      const seg = (w - gap) / 2;
      box(seg, h, t, material, x + s * (gap / 2 + seg / 2), y, zz - d / 2);
      solid(seg, h, t, x + s * (gap / 2 + seg / 2), y, zz - d / 2);
    }
    // lintel over the doorway
    box(gap, h * 0.28, t, material, x, y + h * 0.72, zz - d / 2);
    solid(gap, h * 0.28, t, x, y + h * 0.72, zz - d / 2);
    // north wall
    box(w, h, t, material, x, y, zz + d / 2);
    solid(w, h, t, x, y, zz + d / 2);
    // east and west
    for (const s of [-1, 1]) {
      box(t, h, d, material, x + (s * w) / 2, y, zz);
      solid(t, h, d, x + (s * w) / 2, y, zz);
    }
    // roof — vented (a gap you can drop through) on glasshouses
    if (roofVent) {
      const half = (w - m(1.0)) / 2;
      for (const s of [-1, 1]) {
        box(half, t, d, material, x + s * (m(0.5) + half / 2), y + h, zz);
        solid(half, t, d, x + s * (m(0.5) + half / 2), y + h, zz);
      }
    } else {
      hipRoof(w + t, Math.max(m(1.2), h * 0.45), d + t, x, y + h, zz);
    }
  }

  /** Windows and a door band, so a 9 m wall reads as a house and not a cliff. */
  function facade(x: number, y: number, zz: number, w: number, d: number, h: number) {
    const rows = Math.max(1, Math.floor(h / m(3.2)));
    const cols = Math.max(2, Math.round(w / m(4.0)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + (w * (c + 0.5)) / cols;
        const wy = y + m(1.2) + r * m(3.2);
        for (const s of [-1, 1]) {
          push(
            new THREE.BoxGeometry(m(1.1), m(1.5), m(0.12)), mat.window,
            wx, wy + m(0.75), zz + (s * d) / 2, 0, false,
          );
          push(
            new THREE.BoxGeometry(m(1.3), m(1.7), m(0.09)), mat.trim,
            wx, wy + m(0.75), zz + (s * d) / 2, 0, false,
          );
        }
      }
    }
  }

  // ---- collapse the blockout into one mesh per material ----
  const flush = (bucket: Map<THREE.Material, THREE.BufferGeometry[]>, cast: boolean) => {
    for (const [material, list] of bucket) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      // One mesh now spans the whole estate, so per-object culling can only
      // ever be wrong about it. Non-grass geometry is ~5% of the frame's
      // triangles; the draw calls it saves are worth far more than the cull.
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  };
  flush(casters, true);
  flush(flats, false);

  scene.add(group);
  return { group, groundColliderHandle: groundCollider.handle, sun, updateShadow };
}
