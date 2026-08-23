import * as THREE from 'three';
import { params } from '../core/tuning';

// CEL SHADING — the greybox reads clean because its shading is flat and its
// silhouettes are hard. This brings the game's materials to the same place.
//
// Banding rather than smooth falloff is the whole of it: MeshToonMaterial with
// a tiny gradient map quantises light into steps, which is what makes a
// surface read as drawn rather than rendered. Everything keeps its existing
// colour, so this is a shading change, not a repaint.

/** Three bands: shadow, mid, light. Nearest filtering or it smooths back out. */
function gradientMap(steps: number): THREE.DataTexture {
  // Explicit bands rather than a curve. The first attempt used a power curve
  // whose darkest step landed near 0.44, which crushed every surface facing
  // away from the sun into mud — a yard in permanent dusk, again.
  const bands = [0.62, 0.82, 1.0];
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    data[i] = Math.round(255 * (bands[i] ?? (i + 1) / steps));
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const GRADIENT = gradientMap(3);

/** Original materials, so the toggle can go back. */
const originals = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
const toonCache = new Map<string, THREE.MeshToonMaterial>();

function toonFor(src: THREE.Material): THREE.Material {
  // Transparent things (water, glass) keep their own material: banding a
  // transparent surface just makes it look like a mistake.
  const anyMat = src as THREE.Material & { color?: THREE.Color; transparent?: boolean };
  if (!anyMat.color || anyMat.transparent) return src;

  const key = `${anyMat.color.getHexString()}|${src.side}`;
  let mat = toonCache.get(key);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({
      color: anyMat.color.clone(),
      gradientMap: GRADIENT,
      side: src.side,
    });
    toonCache.set(key, mat);
  }
  return mat;
}

/**
 * Swap every opaque material in the scene for its banded equivalent, or back.
 * Cached by colour, so 726 meshes collapse onto a couple of dozen materials —
 * which also cuts state changes rather than adding them.
 */
export function applyLook(scene: THREE.Object3D) {
  const toon = params.look.toon;
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const mesh = o as THREE.Mesh;
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    const original = originals.get(mesh)!;
    if (!toon) {
      mesh.material = original;
      return;
    }
    mesh.material = Array.isArray(original)
      ? original.map(toonFor)
      : toonFor(original);
  });
}
