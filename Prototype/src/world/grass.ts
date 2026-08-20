import * as THREE from 'three';
import { mulberry32, rangeFrom } from '../core/rng';

// Instanced grass — the visual core of the scale-inversion fantasy.
// One InstancedMesh, seeded scatter, wind sway injected into the standard
// material so lighting/fog stay correct. No physics: flying through grass
// IS the game.
const BLADE_COUNT = 70000;
const FIELD_RADIUS = 55;
const CLEARING_RADIUS = 4; // keep spawn point visible

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
    const c = new THREE.Color();

    for (let i = 0; i < BLADE_COUNT; i++) {
      // uniform disc distribution, skipping the spawn clearing
      let x = 0;
      let z = 0;
      do {
        const r = Math.sqrt(rand()) * FIELD_RADIUS;
        const a = rand() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } while (Math.hypot(x, z) < CLEARING_RADIUS);

      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      const h = range(1.8, 4.2);
      m.compose(
        new THREE.Vector3(x, 0, z),
        q,
        new THREE.Vector3(range(0.7, 1.3), h, 1),
      );
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, c.lerpColors(colorA, colorB, rand()));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    this.uTime.value += dt;
  }
}
