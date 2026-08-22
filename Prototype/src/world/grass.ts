import * as THREE from 'three';
import { mulberry32, rangeFrom } from '../core/rng';
import { LAWN, DECK, SHED, BED_BACK, BED_WEST, rectContains, type Rect } from './property';

// Instanced grass — the visual core of the scale-inversion fantasy.
// One InstancedMesh, seeded scatter, wind sway injected into the standard
// material so lighting/fog stay correct. No physics: flying through grass
// IS the game.
//
// The scatter follows the PROPERTY now rather than a disc: grass grows on the
// lawn and stops at the beds, the deck, the shed and the path. That boundary
// is most of what makes the yard read as landscaped instead of as a field.
const BLADE_COUNT = 92000;
const CLEARING_RADIUS = 5; // keep spawn point visible

/** Circular keep-outs — things that sit ON the lawn. */
const BARE_SPOTS: Array<[number, number, number]> = [
  [0, 2, CLEARING_RADIUS], // spawn
  [-34, 4, 24], // kiddie pool
  [-40, -14, 17], // bird bath
  [-46, 38, 13], // coiled hose
  [-60, 46, 15], // bin
  [-58, -30, 13], // tree trunk
  [28, -46, 18], // wheelbarrow
  [9, 30, 14], // foot of the deck steps
];

const KEEP_OUT: Rect[] = [DECK, SHED, BED_BACK, BED_WEST];

function blocked(x: number, z: number): boolean {
  for (const r of KEEP_OUT) if (rectContains(r, x, z, 2)) return true;
  for (const [cx, cz, cr] of BARE_SPOTS) {
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < cr * cr) return true;
  }
  // The stone path wanders; keep the blades off it.
  if (z > -26 && z < 32 && Math.abs(x - (9 + Math.sin((30 - z) / 6.6 * 1.7) * 3.5)) < 5.4) {
    return true;
  }
  return false;
}

function bladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.16, 1, 1, 3);
  geo.translate(0, 0.5, 0); // base at y=0
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - y * 0.85)); // taper to a tip
  }
  geo.computeVertexNormals();
  return geo;
}

export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private uTime = { value: 0 };

  constructor(seed: number) {
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float phase = iPos.x * 0.35 + iPos.z * 0.29;
            float bend = position.y * position.y;
            float gust = sin(uTime * 1.7 + phase) + 0.4 * sin(uTime * 3.3 + phase * 1.7);
            transformed.x += gust * 0.16 * bend;
            transformed.z += gust * 0.09 * bend;
          #endif`,
        );
    };

    this.mesh = new THREE.InstancedMesh(bladeGeometry(), material, BLADE_COUNT);
    this.mesh.frustumCulled = false; // one draw call; culling per-field is pointless
    this.scatter(seed);
  }

  scatter(seed: number) {
    const rand = mulberry32(seed);
    const range = rangeFrom(rand);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const colorA = new THREE.Color(0x39702a);
    const colorB = new THREE.Color(0x86b45a);
    // Mower stripes: alternating bands of lay direction read as a mown lawn
    // from the air, which is the cheapest "someone maintains this" signal
    // there is.
    const stripe = new THREE.Color(0x2f6323);
    const c = new THREE.Color();
    const hidden = new THREE.Vector3(0, -900, 0);
    const w = LAWN.maxX - LAWN.minX;
    const d = LAWN.maxZ - LAWN.minZ;

    for (let i = 0; i < BLADE_COUNT; i++) {
      let x = 0;
      let z = 0;
      let ok = false;
      for (let tries = 0; tries < 12 && !ok; tries++) {
        x = LAWN.minX + rand() * w;
        z = LAWN.minZ + rand() * d;
        ok = !blocked(x, z);
      }
      if (!ok) {
        // Park the stragglers under the world rather than piling them on a
        // pot: a handful of unused instances costs nothing.
        m.compose(hidden, q, new THREE.Vector3(0, 0, 0));
        this.mesh.setMatrixAt(i, m);
        this.mesh.setColorAt(i, c.set(0x000000));
        continue;
      }

      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      const h = range(1.8, 4.2);
      m.compose(
        new THREE.Vector3(x, 0, z),
        q,
        new THREE.Vector3(range(0.7, 1.3), h, 1),
      );
      this.mesh.setMatrixAt(i, m);
      const banded = (Math.floor((z - LAWN.minZ) / 15) & 1) === 1;
      c.lerpColors(colorA, colorB, rand());
      if (banded) c.lerp(stripe, 0.35);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    this.uTime.value += dt;
  }
}
