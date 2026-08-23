import * as THREE from 'three';
import { params } from '../core/tuning';

// OPTICAL FLOW — the reason speed reads at all.
//
// From the playtest: "flying lower to the ground gave a better sense of
// speed." That is not a quirk, it is the whole mechanism. You cannot perceive
// your own velocity directly; you perceive things streaming past you. Low over
// the lawn, grass blades supply that. At altitude nothing is close enough, so
// the same 8 m/s reads as hanging still.
//
// So we carry the reference frame with us: a field of pollen motes in a box
// that follows the bee, wrapping toroidally so it is effectively infinite.
// They sit still in WORLD space, which is the important part — they stream
// past because you move, not because they do.
//
// Each mote draws as a line from where it is to where it was a moment ago, so
// it is a dot when you hover and a streak when you move. That single trick
// does most of the work.

const MAX_MOTES = 1400;

export class Motes {
  readonly object: THREE.LineSegments;

  private pos: Float32Array; // world position per mote
  private verts: Float32Array; // 2 vertices per mote
  private alpha: Float32Array; // 2 per mote, faded at the box edge
  private geo: THREE.BufferGeometry;
  private centre = new THREE.Vector3();
  private seeded = false;

  constructor() {
    this.pos = new Float32Array(MAX_MOTES * 3);
    this.verts = new Float32Array(MAX_MOTES * 6);
    this.alpha = new Float32Array(MAX_MOTES * 2);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.verts, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    // Additive, unlit, depth-tested but not depth-writing: motes read as light
    // in the air rather than as objects, and never occlude each other.
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xffe9b0) },
        uOpacity: { value: 0.5 },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * uOpacity);
        }`,
    });

    this.object = new THREE.LineSegments(this.geo, material);
    this.object.frustumCulled = false; // it is always around the camera
    this.object.renderOrder = 2;
  }

  private scatter(centre: THREE.Vector3, radius: number) {
    for (let i = 0; i < MAX_MOTES; i++) {
      this.pos[i * 3] = centre.x + (Math.random() - 0.5) * 2 * radius;
      this.pos[i * 3 + 1] = centre.y + (Math.random() - 0.5) * 2 * radius;
      this.pos[i * 3 + 2] = centre.z + (Math.random() - 0.5) * 2 * radius;
    }
    this.centre.copy(centre);
    this.seeded = true;
  }

  /**
   * `velocity` is the bee's, in units/sec. The streak is drawn BACKWARDS along
   * it — motes trail behind the direction of travel, which is what the eye
   * expects from something you are flying through.
   */
  update(dt: number, beePos: THREE.Vector3, velocity: THREE.Vector3) {
    const m = params.motes;
    const radius = m.radius;
    if (!this.seeded) this.scatter(beePos, radius);

    // Re-seed rather than wrap if the bee teleported (respawn, debug jump):
    // wrapping a whole field one axis at a time looks like a glitch.
    if (this.centre.distanceToSquared(beePos) > radius * radius * 16) {
      this.scatter(beePos, radius);
    }
    this.centre.copy(beePos);

    const live = Math.min(MAX_MOTES, Math.max(0, Math.round(m.count)));
    const speed = velocity.length();
    // Streak length grows with speed but saturates, so overdrive doesn't turn
    // the screen into spaghetti.
    const stretch = Math.min(m.maxStreak, speed * m.streakPerSpeed);
    const dir = speed > 1e-3 ? velocity.clone().multiplyScalar(-stretch / speed) : ZERO;

    const inv = 1 / radius;
    for (let i = 0; i < live; i++) {
      const p = i * 3;
      // Toroidal wrap: a mote that leaves the box re-enters on the far side.
      for (let a = 0; a < 3; a++) {
        const c = a === 0 ? beePos.x : a === 1 ? beePos.y : beePos.z;
        let d = this.pos[p + a] - c;
        if (d > radius) d -= 2 * radius;
        else if (d < -radius) d += 2 * radius;
        this.pos[p + a] = c + d;
      }

      const x = this.pos[p];
      const y = this.pos[p + 1];
      const z = this.pos[p + 2];
      const v = i * 6;
      this.verts[v] = x;
      this.verts[v + 1] = y;
      this.verts[v + 2] = z;
      this.verts[v + 3] = x + dir.x;
      this.verts[v + 4] = y + dir.y;
      this.verts[v + 5] = z + dir.z;

      // Fade toward the edge of the box so its boundary is never a visible
      // wall of pollen appearing out of nothing.
      const dx = (x - beePos.x) * inv;
      const dy = (y - beePos.y) * inv;
      const dz = (z - beePos.z) * inv;
      const edge = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      const a = Math.max(0, 1 - edge * edge);
      this.alpha[i * 2] = a;
      this.alpha[i * 2 + 1] = a * 0.35; // tail is dimmer than the head
    }

    (this.object.material as THREE.ShaderMaterial).uniforms.uOpacity.value = m.opacity;
    this.geo.setDrawRange(0, live * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    void dt;
  }
}

const ZERO = new THREE.Vector3();
