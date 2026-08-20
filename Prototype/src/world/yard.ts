import * as THREE from 'three';
import type RAPIER_API from '@dimforge/rapier3d-compat';
import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';
import { params } from '../core/tuning';

// The yard corner: ground, fence (scale cue), springy flowers, and dynamic
// props. Props use toy-physics densities — a bee CAN tip a soda can here,
// because comedy beats realism.
export interface DynamicProp {
  mesh: THREE.Object3D;
  body: RAPIER_API.RigidBody;
}

// Flower heads are dynamic bodies held to an anchor by a spring, so grappling
// one bends the stalk and springs back. The stem mesh is re-aimed each frame
// from base to head, which reads as a bending stalk.
export interface Flower {
  head: RAPIER_API.RigidBody;
  anchor: RAPIER_API.RigidBody;
  joint: RAPIER_API.ImpulseJoint;
  headGroup: THREE.Group;
  stem: THREE.Mesh;
  base: THREE.Vector3;
  restHeight: number;
}

export interface Yard {
  group: THREE.Group;
  dynamicProps: DynamicProp[];
  flowers: Flower[];
  /** Aim assist demotes this so the lawn stops eating every grapple shot. */
  groundColliderHandle: number;
}

export function buildYard(physics: Physics, scene: THREE.Scene, seed: number): Yard {
  const { RAPIER, world } = physics;
  const group = new THREE.Group();
  const dynamicProps: DynamicProp[] = [];
  const flowers: Flower[] = [];
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const range = rangeFrom(rand);

  // ---- sky / fog / light ----
  const skyColor = new THREE.Color(0x87c5eb);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 70, 240);

  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3d5a2a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  sun.position.set(45, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(140, 48),
    new THREE.MeshLambertMaterial({ color: 0x3d5226 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(140, 0.5, 140).setTranslation(0, -0.5, 0).setFriction(1),
  );

  // ---- fence: the giant-world scale cue, and a grapple wall ----
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x6e5138 });
  const plankGeo = new THREE.BoxGeometry(7, 60, 1.4);
  for (let i = -5; i <= 5; i++) {
    const plank = new THREE.Mesh(plankGeo, plankMat);
    plank.position.set(i * 7.6, 30, -62);
    plank.castShadow = true;
    group.add(plank);
  }
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(42, 30, 0.7).setTranslation(0, 30, -62),
  );

  // ---- springy flowers ----
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2e6b1f });
  const centerMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  const petalColors = [0xe86a8a, 0xffffff, 0xb98ae8, 0xff9d5c];

  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2;
    const r = range(11, 42);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = range(5.5, 10);
    const base = new THREE.Vector3(x, 0, z);

    // stem: unit cylinder with its base at origin, re-aimed each frame
    const stemGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 8);
    stemGeo.translate(0, 0.5, 0);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.copy(base);
    stem.scale.y = h;
    stem.castShadow = true;
    group.add(stem);

    // head visuals, moved by physics
    const headGroup = new THREE.Group();
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), centerMat);
    center.scale.y = 0.45;
    center.castShadow = true;
    headGroup.add(center);
    const petalMat = new THREE.MeshLambertMaterial({
      color: petalColors[(rand() * petalColors.length) | 0],
      side: THREE.DoubleSide,
    });
    const petalGeo = new THREE.CircleGeometry(0.9, 10);
    for (let p = 0; p < 8; p++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      const pa = (p / 8) * Math.PI * 2;
      petal.position.set(Math.cos(pa) * 1.3, 0, Math.sin(pa) * 1.3);
      petal.rotation.x = -Math.PI / 2;
      petal.rotation.z = -pa;
      petal.scale.set(1, 1.6, 1);
      headGroup.add(petal);
    }
    headGroup.position.set(x, h, z);
    group.add(headGroup);

    // head body: light enough that a bee can visibly disturb it
    const head = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, h, z)
        .setGravityScale(0) // the spring, not gravity, defines rest pose
        .lockRotations()
        .setLinearDamping(0.4),
    );
    // Light head + soft spring: a bee yanking the stem must visibly bend it,
    // or the swing reads as a twitch instead of a stalk.
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.35, 1.6).setDensity(0.045).setFriction(1),
      head,
    );

    const anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, h, z),
    );
    const joint = world.createImpulseJoint(
      RAPIER.JointData.spring(
        0,
        params.flower.stiffness,
        params.flower.damping,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ),
      head,
      anchor,
      true,
    );

    flowers.push({ head, anchor, joint, headGroup, stem, base, restHeight: h });
  }

  // ---- dynamic props ----
  const addDynamic = (
    mesh: THREE.Mesh,
    colliderDesc: RAPIER_API.ColliderDesc,
    x: number,
    y: number,
    z: number,
  ) => {
    mesh.castShadow = true;
    group.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(0.6),
    );
    world.createCollider(colliderDesc, body);
    dynamicProps.push({ mesh, body });
  };

  // soda can — too heavy to carry, grapple-only. The "you move, not it" test.
  addDynamic(
    new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 5, 20),
      new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.35, metalness: 0.8 }),
    ),
    RAPIER.ColliderDesc.cylinder(2.5, 1.4).setDensity(0.02).setFriction(0.7),
    10, 2.5, 6,
  );

  // toy block — heavy-ish, draggable
  addDynamic(
    new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.6 }),
    ),
    RAPIER.ColliderDesc.cuboid(1.2, 1.2, 1.2).setDensity(0.015).setFriction(0.8),
    -8, 1.2, 10,
  );

  // pebbles — light, the bread-and-butter carry targets
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const pr = range(0.4, 0.9);
    addDynamic(
      new THREE.Mesh(new THREE.IcosahedronGeometry(pr, 1), pebbleMat),
      RAPIER.ColliderDesc.ball(pr).setDensity(0.05).setFriction(0.9),
      range(-20, 20), pr + 0.5, range(-5, 25),
    );
  }

  // AA batteries — salvage, and a nod to the reverse-engineering loop
  const batteryBody = new THREE.MeshStandardMaterial({
    color: 0x1d1d1f, roughness: 0.5, metalness: 0.4,
  });
  const batteryCap = new THREE.MeshStandardMaterial({
    color: 0xc9a227, roughness: 0.3, metalness: 0.9,
  });
  for (let i = 0; i < 3; i++) {
    const batt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 14), batteryBody);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), batteryCap);
    cap.position.y = 0.93;
    batt.add(cap);
    addDynamic(
      batt,
      RAPIER.ColliderDesc.cylinder(0.85, 0.55).setDensity(0.06).setFriction(0.8),
      range(-16, 16), 1.2, range(2, 22),
    );
  }

  scene.add(group);
  return {
    group,
    dynamicProps,
    flowers,
    groundColliderHandle: groundCollider.handle,
  };
}

export function syncProps(props: DynamicProp[]) {
  for (const { mesh, body } of props) {
    const t = body.translation();
    const r = body.rotation();
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

// Spring joints bake their stiffness at creation, so live-tuning the sliders
// means rebuilding them. Cheap at eight flowers.
export function applyFlowerSpring(physics: Physics, flowers: Flower[]) {
  const { RAPIER, world } = physics;
  for (const f of flowers) {
    world.removeImpulseJoint(f.joint, true);
    f.joint = world.createImpulseJoint(
      RAPIER.JointData.spring(
        0,
        params.flower.stiffness,
        params.flower.damping,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ),
      f.head,
      f.anchor,
      true,
    );
  }
}

const stemUp = new THREE.Vector3(0, 1, 0);
const stemDir = new THREE.Vector3();

export function syncFlowers(flowers: Flower[]) {
  for (const f of flowers) {
    const t = f.head.translation();
    f.headGroup.position.set(t.x, t.y, t.z);

    // Re-aim the stem from its base to the displaced head.
    stemDir.set(t.x - f.base.x, t.y - f.base.y, t.z - f.base.z);
    const len = Math.max(0.5, stemDir.length());
    f.stem.scale.y = len;
    f.stem.quaternion.setFromUnitVectors(stemUp, stemDir.normalize());
  }
}
