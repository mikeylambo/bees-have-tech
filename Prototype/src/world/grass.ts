import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { params } from '../core/tuning';
import {
  M, LAWN, DECK, SHED, BED_BACK, BED_WEST, HEDGE, rectContains, type Rect,
} from './property';

// Instanced grass — the visual core of the scale-inversion fantasy.
//
// The old field scattered the whole lawn once. That worked when the lawn was
// 11k units²; the real backyard is 207k, and holding it at the density that
// actually looks like grass would need ~1.7 MILLION blades.
//
// So the field FOLLOWS THE BEE. A window of tiles rides along with you, dense
// enough to fly through; past its edge the ground plane's mower stripes take
// over, and from any altitude where you'd notice the difference, individual
// blades are sub-pixel anyway.
//
// Two details make it hold together:
//   · Tiles are addressed toroidally, so crossing a boundary re-scatters one
//     row or column — not the whole field.
//   · A tile's contents are seeded from its WORLD coordinates, so the same
//     patch of lawn grows the same grass every time you fly back over it.
//     Without that the yard shimmers as you move.

const TILES_ACROSS = 5; // odd, so there's a centre tile
// Tile size trades window WIDTH against how often crossing a boundary
// re-uploads the instance buffer. Bigger tiles = a wider skirt of grass and
// fewer, larger uploads, which is the better side of that trade at this
// blade count. (If it ever bites: switch to a tile-major layout and use
// partial buffer update ranges.)
const TILE0 = M * 0.68; // ~40 units — two thirds of a metre of lawn
const TILE_COUNT = TILES_ACROSS * TILES_ACROSS;
/** Ceiling on instances. `params.world.grassDensity` scales the live count. */
const BLADE_MAX = 260000;
const PER_TILE = Math.floor(BLADE_MAX / TILE_COUNT);

// Three altitude LODs. A window sized for flying THROUGH the grass is about a
// metre across, and from 1.6 m up that reads as a fuzzy patch on a bald lawn —
// which is exactly how you notice the trick. So the window grows with height:
// the same blades spread over more ground, which is fine, because by then each
// one is a couple of pixels. Hysteresis keeps a hover at the boundary from
// re-scattering the field every frame.
const LOD_UP = [M * 1.0, M * 4.4]; // climb past this and the window widens
const LOD_DOWN = [M * 0.8, M * 3.6];

/** Circular keep-outs — things that sit ON the lawn. */
const BARE_SPOTS: Array<[number, number, number]> = [
  [M * -2.55, M * 0.35, M * 0.85], // kiddie pool
  [M * -2.1, M * -1.2, M * 0.4], // bird bath
  [M * -3.1, M * 2.35, M * 0.3], // coiled hose
  [M * -4.4, M * 3.3, M * 0.36], // bin
  [M * -4.2, M * -2.5, M * 0.3], // tree
  [M * 1.0, M * -1.9, M * 0.4], // wheelbarrow
  [M * 1.75, M * -3.15, M * 0.55], // woodpile
  [M * 0.2, M * 1.7, M * 0.5], // foot of the deck steps
  [M * -3.4, M * 1.9, M * 0.18], // washing-line posts
  [M * -3.4, M * -2.9, M * 0.18],
];

const KEEP_OUT: Rect[] = [DECK, SHED, BED_BACK, BED_WEST, HEDGE];

function blocked(x: number, z: number): boolean {
  if (!rectContains(LAWN, x, z, -M * 0.03)) return true;
  for (const r of KEEP_OUT) if (rectContains(r, x, z, M * 0.04)) return true;
  for (const [cx, cz, cr] of BARE_SPOTS) {
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < cr * cr) return true;
  }
  // The stone path wanders; keep the blades off it.
  const pathX = M * 0.2 + Math.sin(z / (M * 1.1)) * (M * 0.28);
  if (z > -M * 3.3 && z < M * 2.2 && Math.abs(x - pathX) < M * 0.24) return true;
  return false;
}

function bladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.19, 1, 1, 3);
  geo.translate(0, 0.5, 0); // base at y=0
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - y * 0.85)); // taper to a tip
  }
  geo.computeVertexNormals();
  return geo;
}

/** Deterministic per-tile seed, so a patch of lawn is always itself. */
function tileSeed(seed: number, tx: number, tz: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (tx + 0x7fff), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (tz + 0x7fff), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

const mod = (n: number, d: number) => ((n % d) + d) % d;

export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private uTime = { value: 0 };
  private uCenter = { value: new THREE.Vector3() };
  private uRadius = { value: (TILES_ACROSS * TILE0) / 2 };
  private lod = 0;
  private tile = TILE0;
  private seed: number;
  /** World tile coords currently held by each slot; NaN = never filled. */
  private heldX = new Int32Array(TILE_COUNT).fill(0x7fffffff);
  private heldZ = new Int32Array(TILE_COUNT).fill(0x7fffffff);
  private centreX = 0x7fffffff;
  private centreZ = 0x7fffffff;
  private dirty = false;

  private _m = new THREE.Matrix4();
  private _q = new THREE.Quaternion();
  private _p = new THREE.Vector3();
  private _s = new THREE.Vector3();
  private _c = new THREE.Color();
  private _up = new THREE.Vector3(0, 1, 0);
  private colorA = new THREE.Color(0x39702a);
  private colorB = new THREE.Color(0x86b45a);

  constructor(seed: number) {
    this.seed = seed;
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uCenter = this.uCenter;
      shader.uniforms.uRadius = this.uRadius;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nuniform vec3 uCenter;\nuniform float uRadius;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            // Shrink to nothing at the window edge. A hard boundary between
            // "grass" and "no grass" is the one thing that would give the
            // trick away, and this costs two instructions.
            // Confined to the outer sliver. A wide gradient over a big
            // window reads as a starburst radiating from the bee; now the
            // ground plane matches the blade colour, a short fade is enough.
            float edge = 1.0 - smoothstep(uRadius * 0.82, uRadius * 1.0,
                                          length(iPos.xz - uCenter.xz));
            transformed.y *= edge;
            float phase = iPos.x * 0.35 + iPos.z * 0.29;
            float bend = position.y * position.y;
            float gust = sin(uTime * 1.7 + phase) + 0.4 * sin(uTime * 3.3 + phase * 1.7);
            transformed.x += gust * 0.16 * bend * edge;
            transformed.z += gust * 0.09 * bend * edge;
          #endif`,
        );
    };

    this.mesh = new THREE.InstancedMesh(bladeGeometry(), material, BLADE_MAX);
    this.mesh.frustumCulled = false; // one draw call; culling per-field is pointless
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the colour buffer up front so setColorAt never reallocates.
    this.mesh.setColorAt(0, this.colorA);
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  }

  /** Reshuffle: drop every tile so the next update refills from a new seed. */
  scatter(seed: number) {
    this.seed = seed;
    this.heldX.fill(0x7fffffff);
    this.heldZ.fill(0x7fffffff);
    this.centreX = 0x7fffffff;
  }

  /**
   * Instances are interleaved by tile (`i % TILE_COUNT`) rather than blocked,
   * so lowering the live count thins every tile evenly instead of deleting
   * whole tiles at the edge of the window.
   */
  private fillTile(slot: number, tx: number, tz: number) {
    // The LOD is in the seed so the same patch doesn't reuse one level's
    // layout at another's spacing.
    const rand = mulberry32(tileSeed(this.seed + this.lod * 0x2545f491, tx, tz));
    const x0 = tx * this.tile;
    const z0 = tz * this.tile;
    for (let k = 0; k < PER_TILE; k++) {
      const i = k * TILE_COUNT + slot;
      if (i >= BLADE_MAX) break;
      const x = x0 + rand() * this.tile;
      const z = z0 + rand() * this.tile;
      const spin = rand() * Math.PI * 2;
      const h = 1.8 + rand() * 2.6;
      const w = 0.7 + rand() * 0.6;
      const tint = rand();
      if (blocked(x, z)) {
        // Park it under the world rather than on top of a flowerpot.
        this._m.compose(this._p.set(0, -900, 0), this._q.identity(), this._s.set(0, 0, 0));
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      this._q.setFromAxisAngle(this._up, spin);
      this._m.compose(this._p.set(x, 0, z), this._q, this._s.set(w, h, 1));
      this.mesh.setMatrixAt(i, this._m);
      this._c.lerpColors(this.colorA, this.colorB, tint);
      this.mesh.setColorAt(i, this._c);
    }
    this.heldX[slot] = tx;
    this.heldZ[slot] = tz;
    this.dirty = true;
  }

  update(dt: number, focus: THREE.Vector3) {
    this.uTime.value += dt;
    this.uCenter.value.copy(focus);

    // Live density, so this can be tuned against real hardware rather than
    // guessed at. Rounded to whole tiles' worth to keep the interleave even.
    const density = Math.min(1, Math.max(0.1, params.world.grassDensity));
    this.mesh.count = Math.floor((BLADE_MAX * density) / TILE_COUNT) * TILE_COUNT;

    // Pick the altitude LOD before choosing tiles; changing it invalidates
    // every tile, so it has to happen first.
    let lod = this.lod;
    while (lod < 2 && focus.y > LOD_UP[lod]) lod++;
    while (lod > 0 && focus.y < LOD_DOWN[lod - 1]) lod--;
    if (lod !== this.lod) {
      this.lod = lod;
      this.tile = TILE0 * (1 << lod);
      this.uRadius.value = (TILES_ACROSS * this.tile) / 2;
      this.heldX.fill(0x7fffffff);
      this.centreX = 0x7fffffff;
    }

    const cx = Math.floor(focus.x / this.tile);
    const cz = Math.floor(focus.z / this.tile);
    if (cx !== this.centreX || cz !== this.centreZ) {
      this.centreX = cx;
      this.centreZ = cz;
      const half = (TILES_ACROSS - 1) / 2;
      for (let dz = -half; dz <= half; dz++) {
        for (let dx = -half; dx <= half; dx++) {
          const tx = cx + dx;
          const tz = cz + dz;
          // Toroidal addressing: a tile that stays inside the window keeps its
          // slot, so moving one tile refills a row, not the whole field.
          const slot = mod(tz, TILES_ACROSS) * TILES_ACROSS + mod(tx, TILES_ACROSS);
          if (this.heldX[slot] === tx && this.heldZ[slot] === tz) continue;
          this.fillTile(slot, tx, tz);
        }
      }
    }

    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = false;
    }
  }
}
