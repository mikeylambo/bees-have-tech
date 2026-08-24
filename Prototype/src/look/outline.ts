import * as THREE from 'three';
import { params } from '../core/tuning';

// OUTLINES, done properly.
//
// First attempt ran a Sobel over the scene depth and fired on every individual
// grass blade — ninety thousand blades are ninety thousand depth
// discontinuities, which is exactly what an edge detector is built to find,
// and the lawn turned into a dark smear. Raising the threshold only traded one
// wrong answer for another: no grass noise, but no fine silhouettes either.
//
// The real fix is to detect edges in a scene that HAS NO GRASS IN IT, then
// re-introduce grass only as an occluder. Two depth buffers:
//
//   A. the full render — colour, and depth of everything including grass
//   B. a depth-only pass with the noisy objects hidden
//
// Sobel over B finds the silhouettes we actually want. Then, per pixel, if A's
// depth is meaningfully nearer than B's, something excluded (grass) is in
// front of that edge, and the edge is suppressed — so a fence outline is
// correctly hidden behind the blades standing in front of it rather than
// drawing over them.
//
// Cost is one extra depth-only pass over the non-grass scene, which is a few
// hundred draw calls of a flat material. The grass, the expensive thing, is
// precisely what that pass skips.

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tSceneDepth;  // everything, including grass
uniform sampler2D tSolidDepth;  // grass and other noisy things excluded
uniform vec2 uTexel;
uniform float uStrength;
uniform float uThickness;
uniform float uNear;
uniform float uFar;
uniform float uDarken;
varying vec2 vUv;

// Rendering through a render target skips the renderer's output colour-space
// conversion — that only happens on the way to the default framebuffer. Blit
// the target back naively and the whole frame comes out linear, which reads as
// everything having gone dark and oversaturated. Convert by hand on the way
// out. (Same accurate transfer three uses, not a 2.2 gamma approximation.)
vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92,
             1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055,
             step(vec3(0.0031308), c));
}

// Perspective depth is wildly non-linear; a Sobel over raw depth finds edges
// only within a metre of the camera. Linearise first.
float lin(sampler2D t, vec2 uv) {
  float z = texture2D(t, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec4 base = texture2D(tColor, vUv);
  vec2 o = uTexel * uThickness;

  float c = lin(tSolidDepth, vUv);
  float l = lin(tSolidDepth, vUv - vec2(o.x, 0.0));
  float r = lin(tSolidDepth, vUv + vec2(o.x, 0.0));
  float d = lin(tSolidDepth, vUv - vec2(0.0, o.y));
  float u = lin(tSolidDepth, vUv + vec2(0.0, o.y));

  // Scale by depth, or distant geometry outlines everything and the horizon
  // becomes a black smear.
  float g = (abs(l - c) + abs(r - c) + abs(d - c) + abs(u - c)) / max(c, 0.001);
  float edge = smoothstep(0.010, 0.045, g) * uStrength;

  // Occlusion: is something excluded from the solid pass standing in front of
  // this edge? If so it should hide the line, the way grass in front of a
  // fence hides the fence's outline.
  float scene = lin(tSceneDepth, vUv);
  float nearest = min(min(lin(tSceneDepth, vUv - vec2(o.x, 0.0)),
                          lin(tSceneDepth, vUv + vec2(o.x, 0.0))),
                      min(lin(tSceneDepth, vUv - vec2(0.0, o.y)),
                          lin(tSceneDepth, vUv + vec2(0.0, o.y))));
  nearest = min(nearest, scene);
  float behind = smoothstep(0.0, 0.06, (min(c, min(min(l, r), min(d, u))) - nearest) / max(c, 0.001));
  edge *= (1.0 - behind);

  vec3 lit = mix(base.rgb, base.rgb * uDarken, edge);
  gl_FragColor = vec4(linearToSRGB(lit), base.a);
}`;

export class OutlinePass {
  private scenePass: THREE.WebGLRenderTarget;
  private solidPass: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  /** Flat, cheap, and unlit — the solid pass only needs a depth buffer. */
  private depthOnly = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private hidden: THREE.Object3D[] = [];

  constructor(private renderer: THREE.WebGLRenderer) {
    const { x, y } = this.pixelSize();
    this.scenePass = this.makeTarget(x, y);
    this.solidPass = this.makeTarget(x, y);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.scenePass.texture },
        tSceneDepth: { value: this.scenePass.depthTexture },
        tSolidDepth: { value: this.solidPass.depthTexture },
        uTexel: { value: new THREE.Vector2(1 / x, 1 / y) },
        uStrength: { value: 1 },
        uThickness: { value: 1.3 },
        uNear: { value: 0.35 },
        uFar: { value: 2600 },
        uDarken: { value: 0.3 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pixelSize() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const dpr = this.renderer.getPixelRatio();
    return { x: Math.max(1, Math.floor(size.x * dpr)), y: Math.max(1, Math.floor(size.y * dpr)) };
  }

  private makeTarget(w: number, h: number) {
    const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    t.depthTexture = new THREE.DepthTexture(w, h);
    return t;
  }

  setSize(w: number, h: number) {
    const dpr = this.renderer.getPixelRatio();
    const px = Math.max(1, Math.floor(w * dpr));
    const py = Math.max(1, Math.floor(h * dpr));
    this.scenePass.setSize(px, py);
    this.solidPass.setSize(px, py);
    this.material.uniforms.uTexel.value.set(1 / px, 1 / py);
  }

  /**
   * Objects the edge detector should be blind to. Grass, mostly: it is the one
   * thing in the scene whose silhouette is noise rather than shape.
   */
  private setHidden(objects: THREE.Object3D[], hidden: boolean) {
    for (const o of objects) o.visible = hidden ? false : true;
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    excludeFromEdges: THREE.Object3D[] = [],
  ) {
    const r = this.renderer;
    if (!params.look.outlines) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }

    const u = this.material.uniforms;
    u.uStrength.value = params.look.outlineStrength;
    u.uThickness.value = params.look.outlineThickness;
    u.uDarken.value = params.look.outlineDarken;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;

    // 1. the real render, with everything in it
    r.setRenderTarget(this.scenePass);
    r.clear();
    r.render(scene, camera);

    // 2. depth only, with the noisy things hidden and shading skipped
    this.hidden = excludeFromEdges.filter((o) => o.visible);
    this.setHidden(this.hidden, true);
    const prevOverride = scene.overrideMaterial;
    const prevBackground = scene.background;
    const prevShadowAuto = r.shadowMap.autoUpdate;
    scene.overrideMaterial = this.depthOnly;
    scene.background = null; // nothing to shade; skip the clear colour work
    // A depth-only pass through a MeshBasicMaterial cannot show a shadow, but
    // three.js rebuilds the shadow map on EVERY render() regardless — which
    // quietly doubled the shadow cost of the whole frame the moment this pass
    // was added. Measured at 194 wasted draw calls per frame in the yard.
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.solidPass);
    r.clear();
    r.render(scene, camera);
    r.shadowMap.autoUpdate = prevShadowAuto;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBackground;
    this.setHidden(this.hidden, false);

    // 3. composite
    r.setRenderTarget(null);
    r.render(this.fsScene, this.fsCamera);
  }
}
