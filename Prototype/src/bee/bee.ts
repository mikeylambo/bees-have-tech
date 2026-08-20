import * as THREE from 'three';

// The bee IS the brand: it must always read as "a bee wearing something
// ridiculous." Proto wearables: aviator goggles + a tech backpack with a
// blinking LED. Model faces +Z.
export class Bee {
  readonly root = new THREE.Group(); // world position (physics-driven)
  private tilt = new THREE.Group(); // visual lean toward velocity
  private wingL!: THREE.Mesh;
  private wingR!: THREE.Mesh;
  private led!: THREE.MeshStandardMaterial;
  private yawCurrent = 0;
  private pitchCurrent = 0;
  private rollCurrent = 0;
  private time = 0;

  constructor() {
    this.root.add(this.tilt);
    this.build();
  }

  private build() {
    const g = this.tilt;
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c744, roughness: 0.7 });
    const fuzz = new THREE.MeshStandardMaterial({ color: 0xc99b3f, roughness: 0.95 });
    const black = new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.6 });
    const sphere = new THREE.SphereGeometry(1, 20, 14);

    // abdomen (rear, -Z)
    const abdomen = new THREE.Mesh(sphere, yellow);
    abdomen.scale.set(0.28, 0.24, 0.36);
    abdomen.position.z = -0.32;
    g.add(abdomen);
    for (const z of [-0.3, -0.42]) {
      const stripe = new THREE.Mesh(sphere, black);
      const t = 1 - Math.abs(z + 0.32) / 0.36;
      stripe.scale.set(0.285 * (0.75 + 0.25 * t), 0.245 * (0.75 + 0.25 * t), 0.045);
      stripe.position.z = z;
      g.add(stripe);
    }
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 10), black);
    stinger.rotation.x = Math.PI / 2;
    stinger.position.z = -0.72;
    g.add(stinger);

    // thorax (middle)
    const thorax = new THREE.Mesh(sphere, fuzz);
    thorax.scale.setScalar(0.21);
    thorax.position.z = 0.02;
    g.add(thorax);

    // head (front, +Z)
    const head = new THREE.Mesh(sphere, black);
    head.scale.setScalar(0.17);
    head.position.z = 0.3;
    g.add(head);
    const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.09 * s, 0.06, 0.42);
      g.add(eye);
    }
    // antennae
    const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6);
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(antGeo, black);
      ant.position.set(0.06 * s, 0.2, 0.34);
      ant.rotation.set(0.5, 0, -0.5 * s);
      g.add(ant);
    }

    // WEARABLE TECH — aviator goggles
    const goggleMat = new THREE.MeshStandardMaterial({
      color: 0x39424e, roughness: 0.3, metalness: 0.7,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x7fd8ff, roughness: 0.1, metalness: 0.3,
      emissive: 0x2288aa, emissiveIntensity: 0.35,
    });
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), goggleMat);
      rim.position.set(0.085 * s, 0.08, 0.44);
      g.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), lensMat);
      lens.position.set(0.085 * s, 0.08, 0.445);
      g.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.014, 6, 24), goggleMat);
    strap.position.set(0, 0.08, 0.31);
    strap.rotation.x = 0.12;
    g.add(strap);

    // WEARABLE TECH — backpack with blinking LED
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.4, metalness: 0.6 }),
    );
    pack.position.set(0, 0.22, 0.02);
    g.add(pack);
    this.led = new THREE.MeshStandardMaterial({
      color: 0x33ff77, emissive: 0x22ff66, emissiveIntensity: 1,
    });
    const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), this.led);
    ledMesh.position.set(0.05, 0.3, 0.02);
    g.add(ledMesh);

    // wings — pivot at inner edge so rotation.z flaps them
    const wingGeo = new THREE.PlaneGeometry(0.52, 0.24);
    wingGeo.translate(0.26, 0, 0);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xe8f4ff, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, roughness: 0.15,
    });
    this.wingR = new THREE.Mesh(wingGeo, wingMat);
    this.wingR.position.set(0.08, 0.24, -0.05);
    this.wingR.rotation.y = -0.35;
    g.add(this.wingR);
    this.wingL = new THREE.Mesh(wingGeo, wingMat);
    this.wingL.position.set(-0.08, 0.24, -0.05);
    this.wingL.rotation.y = Math.PI + 0.35;
    g.add(this.wingL);

    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  update(dt: number, position: THREE.Vector3, velocity: THREE.Vector3, boosting: boolean) {
    this.time += dt;

    // idle hover bob (visual only — physics body stays put)
    this.root.position.copy(position);
    this.root.position.y += Math.sin(this.time * 3.1) * 0.03;

    // face travel direction when moving
    const hSpeed = Math.hypot(velocity.x, velocity.z);
    if (hSpeed > 0.5) {
      const targetYaw = Math.atan2(velocity.x, velocity.z);
      let d = targetYaw - this.yawCurrent;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const ease = 1 - Math.exp(-10 * dt);
      this.yawCurrent += d * ease;

      // lean into motion: nose-down with speed, roll with turn rate
      const targetPitch = THREE.MathUtils.clamp(hSpeed * 0.028, 0, 0.55);
      const targetRoll = THREE.MathUtils.clamp(-d * 6, -0.6, 0.6);
      this.pitchCurrent += (targetPitch - this.pitchCurrent) * ease;
      this.rollCurrent += (targetRoll - this.rollCurrent) * ease;
    } else {
      const ease = 1 - Math.exp(-6 * dt);
      this.pitchCurrent *= 1 - ease;
      this.rollCurrent *= 1 - ease;
    }
    this.root.rotation.y = this.yawCurrent;
    this.tilt.rotation.x = this.pitchCurrent;
    this.tilt.rotation.z = this.rollCurrent;

    // wings: flap faster with speed, frantic on boost
    const flapHz = 14 + hSpeed * 0.6 + (boosting ? 10 : 0);
    const flap = Math.sin(this.time * flapHz * Math.PI * 2) * 0.85 + 0.25;
    this.wingR.rotation.z = flap;
    this.wingL.rotation.z = -flap;

    // backpack LED blink
    this.led.emissiveIntensity = Math.sin(this.time * 5) > 0 ? 1.4 : 0.15;
  }
}
