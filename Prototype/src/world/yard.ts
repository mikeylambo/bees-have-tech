import * as THREE from 'three';
import type RAPIER_API from '@dimforge/rapier3d-compat';
import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';
import { params } from '../core/tuning';
import {
  buildProperty, rectContains,
  YARD, LAWN, DECK, SHED, BED_BACK, BED_WEST, DECK_HEIGHT,
  type Rect,
} from './property';

// The toys. The built environment lives in property.ts; everything here is
// something the bee can move, bend, steal or knock over.
//
// Props use toy-physics densities — a bee CAN tip a soda can here, because
// comedy beats realism.

/** What a piece of salvage IS, so quests can ask for one kind of thing. */
export type SalvageKind = 'battery' | 'board' | 'cap' | 'screw';

export const SALVAGE_LABEL: Record<SalvageKind, string> = {
  battery: 'AA battery',
  board: 'circuit board',
  cap: 'bottle cap',
  screw: 'wood screw',
};

export interface DynamicProp {
  mesh: THREE.Object3D;
  body: RAPIER_API.RigidBody;
  /** Salvage is what the hive reverse-engineers into new tech. */
  salvage?: boolean;
  /** Which kind, for quests that ask for something specific. */
  kind?: SalvageKind;
  /** Where it started. Anything booted out of the yard comes back here. */
  home: THREE.Vector3;
  /** Set once deposited, so it can't be farmed twice. */
  consumed?: boolean;
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
  const property = buildProperty(physics, scene, seed);
  const group = new THREE.Group();
  const dynamicProps: DynamicProp[] = [];
  const flowers: Flower[] = [];
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const range = rangeFrom(rand);

  /** A point inside `r`, retried until it clears the hive and the buildings. */
  const pointIn = (r: Rect, inset = 4): THREE.Vector2 => {
    const p = new THREE.Vector2();
    for (let i = 0; i < 24; i++) {
      p.set(
        r.minX + inset + rand() * (r.maxX - r.minX - inset * 2),
        r.minZ + inset + rand() * (r.maxZ - r.minZ - inset * 2),
      );
      if (rectContains(SHED, p.x, p.y, 3)) continue;
      if (rectContains(DECK, p.x, p.y, 3)) continue;
      if (Math.hypot(p.x - 6, p.y + 56) < 16) continue; // hive doorstep
      return p;
    }
    return p;
  };

  // ---- springy flowers ----
  // Planted in the beds, the way a person would plant them, with a few
  // volunteers out on the lawn.
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2e6b1f });
  const centerMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  const petalColors = [0xe86a8a, 0xffffff, 0xb98ae8, 0xff9d5c, 0xffe066];

  const plantFlower = (x: number, z: number, h: number) => {
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
  };

  for (const bed of [BED_BACK, BED_WEST]) {
    const n = bed === BED_BACK ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const p = pointIn(bed, 3);
      plantFlower(p.x, p.y, range(6, 11));
    }
  }
  for (let i = 0; i < 4; i++) {
    const p = pointIn(LAWN, 12);
    plantFlower(p.x, p.y, range(5.5, 9));
  }

  // ---- dynamic props ----
  const addDynamic = (
    mesh: THREE.Mesh,
    colliderDesc: RAPIER_API.ColliderDesc,
    x: number,
    y: number,
    z: number,
    kind?: SalvageKind,
  ) => {
    mesh.castShadow = true;
    group.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(0.6),
    );
    world.createCollider(colliderDesc, body);
    dynamicProps.push({
      mesh, body, salvage: kind !== undefined, kind,
      home: new THREE.Vector3(x, y, z),
    });
  };

  // soda can — too heavy to carry, grapple-only. The "you move, not it" test.
  addDynamic(
    new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 5, 20),
      new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.35, metalness: 0.8 }),
    ),
    RAPIER.ColliderDesc.cylinder(2.5, 1.4).setDensity(0.02).setFriction(0.7),
    14, 2.5, 12,
  );

  // toy block — heavy-ish, draggable
  addDynamic(
    new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.6 }),
    ),
    RAPIER.ColliderDesc.cuboid(1.2, 1.2, 1.2).setDensity(0.015).setFriction(0.8),
    -12, 1.2, 16,
  );

  // pebbles — light, the bread-and-butter carry targets
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const pr = range(0.4, 0.9);
    const p = pointIn(LAWN, 8);
    addDynamic(
      new THREE.Mesh(new THREE.IcosahedronGeometry(pr, 1), pebbleMat),
      RAPIER.ColliderDesc.ball(pr).setDensity(0.05).setFriction(0.9),
      p.x, pr + 0.5, p.y,
    );
  }

  // ---- salvage ----
  // Four kinds, so a quest can ask for a SPECIFIC thing and sending you to a
  // specific corner of the property is a design tool rather than a coin hunt.
  const batteryBody = new THREE.MeshStandardMaterial({
    color: 0x1d1d1f, roughness: 0.5, metalness: 0.4,
  });
  const batteryCap = new THREE.MeshStandardMaterial({
    color: 0xc9a227, roughness: 0.3, metalness: 0.9,
  });
  const mkBattery = () => {
    const batt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 14), batteryBody);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), batteryCap);
    cap.position.y = 0.93;
    batt.add(cap);
    return batt;
  };
  // Batteries live where batteries die: around the shed and the wheelbarrow.
  const batterySpots: Array<[number, number]> = [
    [30, -38], [22, -50], [34, -18], [12, -46], [-6, -30],
  ];
  for (const [x, z] of batterySpots) {
    addDynamic(
      mkBattery(),
      RAPIER.ColliderDesc.cylinder(0.85, 0.55).setDensity(0.06).setFriction(0.8),
      x, 1.2, z, 'battery',
    );
  }

  // Circuit boards — the rest of the reverse-engineering diet, scattered wide.
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x1f6b3a, roughness: 0.6, metalness: 0.2,
  });
  const traceMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227, roughness: 0.3, metalness: 0.9,
  });
  for (let i = 0; i < 6; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.5), boardMat);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.55), traceMat);
    chip.position.y = 0.2;
    board.add(chip);
    const p = pointIn(LAWN, 10);
    addDynamic(
      board,
      RAPIER.ColliderDesc.cuboid(1.1, 0.15, 0.75).setDensity(0.03).setFriction(0.9),
      p.x, 1.0, p.y,
      'board',
    );
  }

  // Bottle caps — up on the deck, where the drinks were.
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xc0392b, roughness: 0.35, metalness: 0.7,
  });
  const capSpots: Array<[number, number]> = [
    [-18, 44], [4, 52], [24, 40], [34, 56], [-26, 58],
  ];
  for (const [x, z] of capSpots) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.36, 16), capMat);
    addDynamic(
      cap,
      RAPIER.ColliderDesc.cylinder(0.18, 1.05).setDensity(0.04).setFriction(0.9),
      x, DECK_HEIGHT + 2, z, 'cap',
    );
  }

  // Wood screws — spilled where someone was fixing the fence.
  const screwMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6, roughness: 0.3, metalness: 0.95,
  });
  for (let i = 0; i < 5; i++) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 2.2, 8), screwMat);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10), screwMat);
    head.position.y = 1.1;
    screw.add(head);
    screw.rotation.z = Math.PI / 2;
    addDynamic(
      screw,
      RAPIER.ColliderDesc.capsule(0.9, 0.3).setDensity(0.05).setFriction(0.9),
      -54 + range(-8, 8), 1.0, -18 + i * 7,
      'screw',
    );
  }

  scene.add(group);
  return {
    group,
    dynamicProps,
    flowers,
    groundColliderHandle: property.groundColliderHandle,
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

/**
 * Anything that leaves the property comes home.
 *
 * The human kicks props as he walks — that's good comedy right up until he
 * punts the last battery over the fence and the quest becomes uncompletable.
 * The fence catches almost everything now; this catches the rest, including
 * anything thrown over it on purpose.
 */
export function containProps(props: DynamicProp[]): number {
  let recovered = 0;
  for (const p of props) {
    if (p.consumed) continue;
    const t = p.body.translation();
    if (t.y > -30 && t.y < 400 && rectContains(YARD, t.x, t.z, 8)) continue;
    p.body.setTranslation({ x: p.home.x, y: p.home.y + 2, z: p.home.z }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    recovered++;
  }
  return recovered;
}

// Spring joints bake their stiffness at creation, so live-tuning the sliders
// means rebuilding them. Cheap at this many flowers.
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
