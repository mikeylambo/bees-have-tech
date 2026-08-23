import * as THREE from 'three';
import { params } from '../core/tuning';

// OUTLINES — the other half of "it looks like the greybox".
//
// The blockout gets its edges from explicit LineSegments per object, which is
// fine for 139 boxes and hopeless for 700-odd meshes plus a grass field. So
// this does it in screen space instead: render depth, run a Sobel over it, and
// darken where the gradient is steep. One extra pass, independent of scene
// complexity, and it catches silhouettes AND the creases between surfaces.
//
// Depth-only on purpose. A normal buffer would catch more creases, but it
// costs a second render target and a material override across the whole scene,
// and the silhouettes are what carry the look.

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uThickness;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;

// Perspective depth is wildly non-linear; a Sobel over raw depth would find
// edges only within a metre of the camera. Linearise first.
float linear(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec4 base = texture2D(tColor, vUv);
  vec2 o = uTexel * uThickness;

  float c = linear(vUv);
  float l = linear(vUv - vec2(o.x, 0.0));
  float r = linear(vUv + vec2(o.x, 0.0));
  float d = linear(vUv - vec2(0.0, o.y));
  float u = linear(vUv + vec2(0.0, o.y));

  // Scale the difference by depth, or distant geometry outlines everything
  // and the horizon turns into a black smear.
  float g = (abs(l - c) + abs(r - c) + abs(d - c) + abs(u - c)) / max(c, 0.001);
  // Thresholds tuned to catch object SILHOUETTES, not every depth wrinkle.
  // At the first setting this fired on every individual grass blade and
  // turned the lawn into a dark smear — 90,000 blades are 90,000 depth
  // discontinuities, which is exactly what a Sobel is looking for.
  float edge = smoothstep(0.06, 0.24, g) * uStrength;

  gl_FragColor = vec4(mix(base.rgb, base.rgb * 0.34, edge), base.a);
}`;

export class OutlinePass {
  private target: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;

  constructor(private renderer: THREE.WebGLRenderer) {
    const size = renderer.getSize(new THREE.Vector2());
    const dpr = renderer.getPixelRatio();
    this.target = new THREE.WebGLRenderTarget(size.x * dpr, size.y * dpr, {
      depthTexture: new THREE.DepthTexture(size.x * dpr, size.y * dpr),
      depthBuffer: true,
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uTexel: { value: new THREE.Vector2(1 / (size.x * dpr), 1 / (size.y * dpr)) },
        uStrength: { value: params.look.outlineStrength },
        uThickness: { value: params.look.outlineThickness },
        uNear: { value: 0.35 },
        uFar: { value: 2600 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(w: number, h: number) {
    const dpr = this.renderer.getPixelRatio();
    this.target.setSize(w * dpr, h * dpr);
    this.material.uniforms.uTexel.value.set(1 / (w * dpr), 1 / (h * dpr));
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (!params.look.outlines) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.material.uniforms.uStrength.value = params.look.outlineStrength;
    this.material.uniforms.uThickness.value = params.look.outlineThickness;
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
