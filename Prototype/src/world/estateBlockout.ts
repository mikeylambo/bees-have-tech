// THE ESTATE — a blockout, in metres.
//
// This file is DATA on purpose. Every object in property.ts is hand-written
// TypeScript geometry, and that is exactly the work that does not survive a
// port: you rebuild it in an editor with real assets. A table of zones does
// survive. It is the blockout spec, and it reads the same in Three.js, Unity,
// Godot or on a whiteboard.
//
// So: nothing here knows about Three.js. The viewer in estate.ts turns it into
// grey volumes; a level designer would turn it into a level.
//
// Scale is the same everywhere: the human is 1.7 m. What this file is FOR is
// answering one question — is estate scale the right scale? — before anyone
// spends a week detailing a house.

/** Units per metre in the runtime, fixed by the 100-unit human. */
export const M = 100 / 1.7;

export type ZoneKind =
  | 'ground' // lawn, meadow — flat, walkable
  | 'paving' // terrace, path, court surface
  | 'gravel' // drive
  | 'building' // solid mass
  | 'glass' // you can see in, and the bee can get inside
  | 'water'
  | 'planting' // hedge, bed, orchard floor
  | 'wall' // boundary
  | 'prop' // furniture-scale object
  | 'ref'; // human-scale reference figure

export interface Zone {
  id: string;
  /** Shown floating over the volume in the viewer. Empty = unlabelled. */
  label: string;
  kind: ZoneKind;
  /** Plan centre, metres. */
  x: number;
  z: number;
  /** Footprint, metres. */
  w: number;
  d: number;
  /** Height, metres. 0 renders as a flat surface. */
  h: number;
  /** Base height, metres. Defaults to 0. */
  y?: number;
  /** Rotation about Y, radians. */
  yaw?: number;
  /** The bee can get inside this volume — it renders as a shell, not a mass. */
  hollow?: boolean;
  /** What this is FOR at bee scale. The reason the zone exists. */
  note?: string;
}

/** Overall grounds, metres. Everything below sits inside this. */
export const ESTATE = {
  width: 90,
  depth: 120,
  /** Wall line — the playable boundary. */
  minX: -45,
  maxX: 45,
  minZ: -60,
  maxZ: 60,
  wallHeight: 2.4,
  wallThickness: 0.5,
};

// ---------------------------------------------------------------- the plan
//
//  z +60 ┌───────────────────────────────────────────────┐ north
//        │  SERVICE │   MAIN HOUSE    │  GUEST HOUSE      │
//        │  garage  ├──────┬──────────┴───────────────────│
//        │ PARTERRE │ MOTOR│  KITCHEN GARDEN / GREENHOUSE │
//   z +18│──────────┤ COURT├──────────────────────────────│
//        │          │      │  POOL TERRACE · CABANA       │
//        │ WEST     │ THE  ├──────────────────────────────│
//        │ LAWN     │ DRIVE│         EAST LAWN            │
//        │ fire pit │      │         playground           │
//   z -60└──────────┴─ GATE ┴─────────────────────────────┘ south
//       x -45                                          x +45
//
// The spine is the point. Gate to motor court is 80 m of straight driveway —
// the only place on the property you can hold overdrive in a line and feel
// fast. The old 40 x 30 blockout was all rooms and no corridor, which is a
// large part of why it read as a box rather than a world.
const zones: Zone[] = [
  // ---- surfaces ----
  {
    id: 'lawn-west', label: 'WEST LAWN', kind: 'ground',
    x: -26, z: -22, w: 34, d: 66, h: 0,
    note: 'The long panel. 66 m of unbroken flight line down one side.',
  },
  {
    id: 'lawn-east', label: 'EAST LAWN', kind: 'ground',
    x: 26, z: -28, w: 34, d: 54, h: 0,
    note: 'Its mirror, broken up by the playground and the fruit trees.',
  },
  {
    id: 'meadow', label: '', kind: 'ground',
    x: 0, z: 30, w: 90, d: 60, h: 0,
    note: 'Grass around the buildings and courts.',
  },
  {
    id: 'drive', label: 'THE DRIVE', kind: 'gravel',
    x: 0, z: -19, w: 10, d: 82, h: 0.03,
    note: '80 m of straight run from the gate. The property\'s highway.',
  },
  {
    id: 'motor-court', label: 'MOTOR COURT', kind: 'gravel',
    x: -8, z: 30, w: 32, d: 32, h: 0.03,
    note: 'The roundabout. Where the spine ends and the estate opens up.',
  },
  {
    id: 'fountain-island', label: '', kind: 'planting',
    x: -8, z: 30, w: 14, d: 14, h: 0.5,
    note: 'Clipped island in the middle of the turning circle.',
  },
  {
    id: 'fountain', label: 'FOUNTAIN', kind: 'water',
    x: -8, z: 30, w: 4, d: 4, h: 1.6,
    note: 'Standing water, raised, dead centre of the approach.',
  },

  // ---- the three houses ----
  {
    id: 'house', label: 'MAIN HOUSE', kind: 'building',
    x: -23, z: 48, w: 34, d: 20, h: 9,
    note: 'Nine metres to the eaves against a 1.7 m human.',
  },
  {
    id: 'house-roof', label: '', kind: 'building',
    x: -23, z: 48, w: 36, d: 22, h: 4.5, y: 9,
    note: 'Steep hipped roof with dormers. The high ground.',
  },
  {
    id: 'gutter', label: 'GUTTER RUN', kind: 'prop',
    x: -23, z: 37.4, w: 34, d: 0.2, h: 0.2, y: 9, hollow: true,
    note: '34 m channel you fly inside, the length of the whole facade.',
  },
  {
    id: 'chimney', label: '', kind: 'building',
    x: -34, z: 48, w: 2, d: 2, h: 4, y: 13.5,
    note: 'Highest point on the property.',
  },
  {
    id: 'garage', label: 'GARAGE', kind: 'building',
    x: -38, z: 34, w: 14, d: 12, h: 4.5, hollow: true,
    note: 'Three bays, one left open. A real interior with a car in it.',
  },
  {
    id: 'guest-house', label: 'GUEST HOUSE', kind: 'building',
    x: 20, z: 47, w: 20, d: 14, h: 5.5, hollow: true,
    note: 'Its own tenants, its own habits. The repopulate axis, built in.',
  },
  {
    id: 'cabana', label: 'CABANA', kind: 'building',
    x: 19, z: 22, w: 14, d: 8, h: 3.6, hollow: true,
    note: 'Open-sided. The furnished one: loungers, fire table, bar.',
  },

  // ---- pool terrace ----
  {
    id: 'pool-terrace', label: 'POOL TERRACE', kind: 'paving',
    x: 21, z: 8, w: 26, d: 20, h: 0.25,
    note: 'Raised stone. A 25 cm lip is a fifteen-storey drop to a bee.',
  },
  {
    id: 'pool', label: 'SWIMMING POOL', kind: 'water',
    x: 22, z: 8, w: 16, d: 12, h: 0.08,
    note: 'Sixteen metres of open water. Crossing it should be a decision.',
  },
  {
    id: 'spa', label: 'SPA', kind: 'water',
    x: 9, z: 1, w: 5, d: 5, h: 0.6,
    note: 'Hot, humid, steaming — an atmosphere zone with a lid of vapour.',
  },

  // ---- gardens ----
  {
    id: 'parterre', label: 'FORMAL GARDEN', kind: 'planting',
    x: -28, z: 14, w: 28, d: 20, h: 0,
    note: 'Box hedge grid: ankle-height maze, bee-height canyon system.',
  },
  {
    id: 'kitchen-garden', label: 'KITCHEN GARDEN', kind: 'planting',
    x: 34, z: 33, w: 18, d: 18, h: 0,
    note: 'Raised beds, cold frames, cover at ground level.',
  },
  {
    id: 'greenhouse', label: 'GREENHOUSE', kind: 'glass',
    x: 36, z: 40, w: 10, d: 5, h: 3.4, hollow: true,
    note: 'Glass, hot, still air. Fly in through the roof vent.',
  },
  {
    id: 'shed', label: 'POTTING SHED', kind: 'building',
    x: 26, z: 32, w: 4, d: 4, h: 2.6, hollow: true,
    note: 'Jars, tools, salvage. The dense-loot room.',
  },
  {
    id: 'service', label: 'SERVICE YARD', kind: 'paving',
    x: -37, z: 22, w: 14, d: 10, h: 0.05,
    note: 'Bins and compost behind the garage. Where the salvage lives.',
  },
  {
    id: 'compost', label: '', kind: 'prop',
    x: -40, z: 20, w: 3, d: 3, h: 1.4,
    note: 'Warm, humid, full of parts.',
  },

  // ---- the far end ----
  {
    id: 'firepit', label: 'FIRE PIT', kind: 'paving',
    x: -22, z: -26, w: 10, d: 10, h: 0.1,
    note: 'Ringed by chairs. Heat column above it when lit.',
  },
  {
    id: 'playground', label: 'PLAYGROUND', kind: 'prop',
    x: 24, z: -30, w: 12, d: 10, h: 3.2, hollow: true,
    note: 'A climbing frame is a cathedral at this size.',
  },

  // ---- the gate ----
  {
    id: 'gate', label: 'THE GATE', kind: 'wall',
    x: 0, z: -60, w: 10, d: 0.4, h: 3.4, hollow: true,
    note: 'Ornamental ironwork — the best climbing frame on the property.',
  },
  {
    id: 'gate-pillar-w', label: '', kind: 'wall',
    x: -6.5, z: -60, w: 3, d: 3, h: 4.4,
    note: 'Stone pillar with a lantern on top.',
  },
  {
    id: 'gate-pillar-e', label: '', kind: 'wall',
    x: 6.5, z: -60, w: 3, d: 3, h: 4.4,
  },
  {
    id: 'hive', label: 'THE HIVE', kind: 'prop',
    x: -6.5, z: -58.2, w: 2, d: 1, h: 1.6, y: 1.4,
    note: 'In a hollow of the west gate pillar. The bees live in the front gate.',
  },
];

// Repeated things are generated from constants so the numbers stay honest.
function orchard(): Zone[] {
  const out: Zone[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      out.push({
        id: `orchard-${row}-${col}`, label: '', kind: 'planting',
        x: 14 + col * 6.5, z: -52 + row * 7,
        w: 5, d: 5, h: 7,
        note: 'Fruit tree: 7 m of trunk and canopy.',
      });
    }
  }
  return out;
}

function hedgeGrid(): Zone[] {
  const out: Zone[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      out.push({
        id: `parterre-${i}-${j}`, label: '', kind: 'planting',
        x: -40 + i * 4.6, z: 6 + j * 4.6, w: 3.2, d: 3.2, h: 0.8,
      });
    }
  }
  return out;
}

/** Mature planting rings the whole property. These are the real walls. */
function woodland(): Zone[] {
  const out: Zone[] = [];
  const { minX, maxX, minZ, maxZ } = ESTATE;
  let n = 0;
  const put = (x: number, z: number, h: number) => {
    out.push({
      id: `wood-${n++}`, label: '', kind: 'planting',
      x, z, w: h * 0.75, d: h * 0.75, h,
      note: 'Mature tree. The estate is enclosed by planting, not by fence.',
    });
  };
  for (let z = minZ + 6; z < maxZ; z += 9) {
    put(minX + 3.5, z + (z % 18 ? 0 : 3), 11 + ((z * 7) % 5));
    put(maxX - 3.5, z + (z % 18 ? 3 : 0), 11 + ((z * 5) % 5));
  }
  for (let x = minX + 12; x < maxX - 8; x += 10) {
    put(x, maxZ - 4, 12 + ((x * 3) % 4));
  }
  return out;
}

/**
 * Landscape lighting, straight off the references — both aerials are covered
 * in it. At bee scale a path light is a lamp post: a landmark, a night
 * navigation aid, and something to hack.
 */
function pathLights(): Zone[] {
  const out: Zone[] = [];
  let n = 0;
  const put = (x: number, z: number) => {
    out.push({
      id: `light-${n++}`, label: '', kind: 'prop',
      x, z, w: 0.35, d: 0.35, h: 1.1,
      note: 'Path light. Lamp post at bee scale.',
    });
  };
  for (let z = -56; z < 20; z += 8) {
    put(-6.5, z);
    put(6.5, z);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(-8 + Math.cos(a) * 14, 30 + Math.sin(a) * 14);
  }
  return out;
}

function boundaryWalls(): Zone[] {
  const { minX, maxX, minZ, maxZ, wallHeight: h, wallThickness: t } = ESTATE;
  const w = maxX - minX;
  const d = maxZ - minZ;
  return [
    // The south wall is split by the gate opening.
    { id: 'wall-sw', label: '', kind: 'wall', x: -26, z: minZ, w: 38, d: t, h },
    { id: 'wall-se', label: '', kind: 'wall', x: 26, z: minZ, w: 38, d: t, h },
    { id: 'wall-n', label: '', kind: 'wall', x: 0, z: maxZ, w: w + t, d: t, h },
    { id: 'wall-w', label: '', kind: 'wall', x: minX, z: 0, w: t, d, h },
    { id: 'wall-e', label: '', kind: 'wall', x: maxX, z: 0, w: t, d, h },
  ];
}

/** People, for scale. A greybox without them is just abstract boxes. */
function scaleFigures(): Zone[] {
  const spots: Array<[number, number, string]> = [
    [14, 2, 'poolside'],
    [-8, 44, 'at the front door'],
    [0, -30, 'walking the drive'],
    [30, 34, 'in the kitchen garden'],
    [-24, -24, 'at the fire pit'],
  ];
  return spots.map(([x, z, label], i) => ({
    id: `ref-${i}`, label: i === 0 ? '1.7 m' : '', kind: 'ref' as const,
    x, z, w: 0.45, d: 0.28, h: 1.7, note: `Human, ${label}.`,
  }));
}

export const ZONES: Zone[] = [
  ...zones,
  ...orchard(),
  ...hedgeGrid(),
  ...woodland(),
  ...pathLights(),
  ...boundaryWalls(),
  ...scaleFigures(),
];

/** Longest straight line across the grounds, in metres. */
export function diagonalMetres(): number {
  return Math.hypot(ESTATE.width, ESTATE.depth);
}

/**
 * How long the property takes to cross, which is the only number that
 * actually answers "is this the right size".
 *
 * Cruise is NOT `maxSpeed`. Thrust is a force against linear damping, so the
 * speed you actually reach is accel/damping; `maxSpeed` is a higher threshold
 * that only governs borrowed speed bleeding off. Reading the ceiling instead
 * of the terminal made this HUD claim the estate was a third smaller than it
 * is, which is exactly the wrong way to be wrong about scale.
 */
export function traversal(flight: {
  accel: number; damping: number; maxSpeed: number; boostMul: number;
}) {
  const terminal = (boost: number) =>
    Math.min((flight.accel * boost) / flight.damping, flight.maxSpeed * boost);
  const cruise = terminal(1);
  const boosted = terminal(flight.boostMul);
  const acrossUnits = ESTATE.width * M;
  const diagUnits = diagonalMetres() * M;
  return {
    cruiseMs: cruise / M,
    boostMs: boosted / M,
    acrossCruise: acrossUnits / cruise,
    acrossBoost: acrossUnits / boosted,
    diagCruise: diagUnits / cruise,
    diagBoost: diagUnits / boosted,
  };
}
