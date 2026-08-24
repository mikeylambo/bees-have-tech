import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type RAPIER_API from '@dimforge/rapier3d-compat';
import type { Physics } from '../core/physics';
import { mulberry32, rangeFrom } from '../core/rng';
import { params } from '../core/tuning';
import {
  buildEstate, rectContains, zone, zoneRect,
  M, BOUNDS, type Rect,
} from './estateWorld';

/** Shorthand: everything below is placed in metres, like the estate is. */
const m = (metres: number) => metres * M;

// The toys. The built environment lives in estateWorld.ts; everything here is
// something the bee can move, bend, steal or knock over.
//
// Props use toy-physics densities — a bee CAN tip a soda can here, because
// comedy beats realism.
//
// M9 note: everything below is placed BY ZONE, never by typed-in coordinates.
// Salvage lives where that kind of salvage would actually end up — caps at
// the fire pit, screws under the climbing frame, batteries in the service
// yard, boards in the potting shed — so "go and get four boards" sends you to
// a specific corner of a 90 x 120 m property instead of sweeping a lawn.

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

export interface Props {
  group: THREE.Group;
  dynamicProps: DynamicProp[];
  flowers: Flower[];
  /** Aim assist demotes this so open ground stops eating every grapple shot. */
  groundColliderHandle: number;
  /** Shadows follow the bee; call this with its position each frame. */
  updateShadow: (focus: THREE.Vector3) => void;
}

/** Kept as an alias so the aim-assist and swarm call sites read the same. */
export type Yard = Props;

export function buildProps(physics: Physics, scene: THREE.Scene, seed: number): Props {
  const { RAPIER, world } = physics;
  const estate = buildEstate(physics, scene, seed);
  const group = new THREE.Group();
  const dynamicProps: DynamicProp[] = [];
  const flowers: Flower[] = [];
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const range = rangeFrom(rand);

  /** A point inside `r`, inset from its edges. */
  const pointIn = (r: Rect, inset = 4): THREE.Vector2 => {
    const w = Math.max(0, r.maxX - r.minX - inset * 2);
    const d = Math.max(0, r.maxZ - r.minZ - inset * 2);
    return new THREE.Vector2(
      r.minX + inset + rand() * w,
      r.minZ + inset + rand() * d,
    );
  };

  /** A point inside a named zone from the blockout. */
  const inZone = (id: string, inset = m(0.6)): THREE.Vector2 =>
    pointIn(zoneRect(zone(id)), inset);

  /** Ground height of a zone's surface, so props don't spawn inside paving. */
  const surfaceOf = (id: string): number => {
    const z = zone(id);
    return m((z.y ?? 0) + (z.kind === 'paving' || z.kind === 'gravel' ? z.h : 0));
  };

  // ---- springy flowers ----
  // Planted in the beds, the way a person would plant them, with a few
  // volunteers out on the lawn.
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2e6b1f });
  const centerMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  // FIVE petal materials, shared. One material per flower meant 74 distinct
  // materials on screen, which is 74 shader-state changes that buy nothing.
  const petalMats = [0xe86a8a, 0xffffff, 0xb98ae8, 0xff9d5c, 0xffe066].map(
    (color) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
  );
  // ...and ONE corolla geometry, shared. The eight petals of a head never move
  // relative to each other, so they were eight draw calls describing one
  // rigid object. Merged: 74 flowers cost 74 corollas instead of 592 petals.
  const corollaGeo = (() => {
    const petals: THREE.BufferGeometry[] = [];
    for (let p = 0; p < 8; p++) {
      const pa = (p / 8) * Math.PI * 2;
      const g = new THREE.CircleGeometry(1.5, 10).toNonIndexed();
      g.scale(1, 1.6, 1);
      g.rotateX(-Math.PI / 2);
      g.rotateY(pa);
      g.translate(Math.cos(pa) * 2.1, 0, Math.sin(pa) * 2.1);
      petals.push(g);
    }
    const merged = mergeGeometries(petals, false)!;
    for (const g of petals) g.dispose();
    return merged;
  })();

  const plantFlower = (x: number, z: number, h: number) => {
    const base = new THREE.Vector3(x, 0, z);

    // stem: unit cylinder with its base at origin, re-aimed each frame
    const stemGeo = new THREE.CylinderGeometry(0.36, 0.56, 1, 8);
    stemGeo.translate(0, 0.5, 0);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.copy(base);
    stem.scale.y = h;
    stem.castShadow = true;
    group.add(stem);

    // head visuals, moved by physics
    const headGroup = new THREE.Group();
    const center = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), centerMat);
    center.scale.y = 0.45;
    center.castShadow = true;
    headGroup.add(center);
    const corolla = new THREE.Mesh(
      corollaGeo, petalMats[(rand() * petalMats.length) | 0],
    );
    headGroup.add(corolla);
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
      RAPIER.ColliderDesc.cylinder(0.5, 2.6).setDensity(0.045).setFriction(1),
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

  // A bed of flowers is 30-60 cm of stem. At bee scale that is a forest you
  // fly through, which is most of what the beds are for.
  //
  // Planted where a gardener would plant them: inside the parterre's hedge
  // grid, through the kitchen garden, and as volunteers out on both lawns.
  const beds: Array<[string, number]> = [
    ['parterre', 34], ['kitchen-garden', 22],
  ];
  for (const [id, n] of beds) {
    for (let i = 0; i < n; i++) {
      const p = inZone(id, m(1.2));
      plantFlower(p.x, p.y, range(m(0.3), m(0.62)));
    }
  }
  for (const id of ['lawn-west', 'lawn-east']) {
    for (let i = 0; i < 9; i++) {
      const p = inZone(id, m(3));
      plantFlower(p.x, p.y, range(m(0.22), m(0.42)));
    }
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

  // soda cans — too heavy to carry, grapple-only. The "you move, not it" test.
  // Left where drinks get left: the cabana bar and the fire pit ring.
  const canMat = new THREE.MeshStandardMaterial({
    color: 0xd42a2a, roughness: 0.35, metalness: 0.8,
  });
  for (const id of ['cabana', 'firepit', 'pool-terrace']) {
    const p = inZone(id, m(1.2));
    addDynamic(
      new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 7, 20), canMat),
      RAPIER.ColliderDesc.cylinder(3.5, 2).setDensity(0.02).setFriction(0.7),
      p.x, surfaceOf(id) + 3.5, p.y,
    );
  }

  // toy blocks — heavy-ish, draggable. Somebody's children live here.
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.6 });
  for (const id of ['playground', 'lawn-east']) {
    for (let i = 0; i < 2; i++) {
      const p = inZone(id, m(1.5));
      addDynamic(
        new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), blockMat),
        RAPIER.ColliderDesc.cuboid(1.2, 1.2, 1.2).setDensity(0.015).setFriction(0.8),
        p.x, 1.2, p.y,
      );
    }
  }

  // pebbles — light, the bread-and-butter carry targets. The drive is gravel,
  // so this is also the one place they read as belonging.
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  for (const [id, n] of [['drive', 10], ['motor-court', 8], ['service', 5]] as const) {
    for (let i = 0; i < n; i++) {
      const pr = range(0.4, 0.9);
      const p = inZone(id, m(0.8));
      addDynamic(
        new THREE.Mesh(new THREE.IcosahedronGeometry(pr, 1), pebbleMat),
        RAPIER.ColliderDesc.ball(pr).setDensity(0.05).setFriction(0.9),
        p.x, surfaceOf(id) + pr + 0.5, p.y,
      );
    }
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
    const batt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.9, 14), batteryBody);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 12), batteryCap);
    cap.position.y = 1.58;
    batt.add(cap);
    return batt;
  };
  // Batteries live where batteries die: the service yard behind the garage
  // and the compost heap next to it. Both at the FAR north end, which is what
  // makes the battery quest a trip up the drive rather than a lawn sweep.
  for (const [id, n] of [['service', 5], ['compost', 3]] as const) {
    for (let i = 0; i < n; i++) {
      const p = inZone(id, m(0.7));
      addDynamic(
        mkBattery(),
        RAPIER.ColliderDesc.cylinder(1.45, 0.45).setDensity(0.06).setFriction(0.8),
        p.x, surfaceOf(id) + 2, p.y, 'battery',
      );
    }
  }

  // Circuit boards — the rest of the reverse-engineering diet, scattered wide.
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x1f6b3a, roughness: 0.6, metalness: 0.2,
  });
  const traceMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227, roughness: 0.3, metalness: 0.9,
  });
  // Boards are the potting shed's business — the blockout calls it the
  // dense-loot room — spilling out into the kitchen garden's cold frames.
  for (const [id, n] of [['shed', 4], ['kitchen-garden', 4], ['greenhouse', 2]] as const) {
    for (let i = 0; i < n; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.5), boardMat);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.55), traceMat);
      chip.position.y = 0.2;
      board.add(chip);
      const p = inZone(id, m(0.9));
      addDynamic(
        board,
        RAPIER.ColliderDesc.cuboid(1.1, 0.15, 0.75).setDensity(0.03).setFriction(0.9),
        p.x, surfaceOf(id) + 1.0, p.y,
        'board',
      );
    }
  }

  // Bottle caps — up on the deck, where the drinks were.
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xc0392b, roughness: 0.35, metalness: 0.7,
  });
  // Caps are wherever the drinks were. The fire pit ring is 30 m from the
  // gate, so this is the first salvage a new bee can reach — and it is why
  // the south half of the property has a reason to exist.
  for (const [id, n] of [['firepit', 5], ['cabana', 3], ['pool-terrace', 2]] as const) {
    for (let i = 0; i < n; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.36, 16), capMat);
      const p = inZone(id, m(0.8));
      addDynamic(
        cap,
        RAPIER.ColliderDesc.cylinder(0.18, 1.05).setDensity(0.04).setFriction(0.9),
        p.x, surfaceOf(id) + 3, p.y, 'cap',
      );
    }
  }

  // Wood screws — spilled where someone was fixing the fence.
  const screwMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6, roughness: 0.3, metalness: 0.95,
  });
  // Screws come out of things that are bolted together — the climbing frame
  // and the garage bench.
  for (const [id, n] of [['playground', 4], ['garage', 3]] as const) {
    for (let i = 0; i < n; i++) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 2.2, 8), screwMat);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10), screwMat);
      head.position.y = 1.1;
      screw.add(head);
      screw.rotation.z = Math.PI / 2;
      const p = inZone(id, m(0.9));
      addDynamic(
        screw,
        RAPIER.ColliderDesc.capsule(0.9, 0.3).setDensity(0.05).setFriction(0.9),
        p.x, 1.0, p.y, 'screw',
      );
    }
  }

  scene.add(group);
  return {
    group,
    dynamicProps,
    flowers,
    groundColliderHandle: estate.groundColliderHandle,
    updateShadow: estate.updateShadow,
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
 * The household kicks props as they walk — that's good comedy right up until
 * somebody punts the last battery over the boundary wall and the quest
 * becomes uncompletable. The wall catches almost everything; this catches the
 * rest, including anything thrown over it on purpose.
 */
export function containProps(props: DynamicProp[]): number {
  let recovered = 0;
  for (const p of props) {
    if (p.consumed) continue;
    const t = p.body.translation();
    if (t.y > -m(2) && t.y < m(60) && rectContains(BOUNDS, t.x, t.z, m(1.5))) continue;
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
