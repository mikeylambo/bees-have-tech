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
  width: 40,
  depth: 30,
  /** Wall line — the playable boundary. */
  minX: -20,
  maxX: 20,
  minZ: -15,
  maxZ: 15,
  wallHeight: 2.0,
  wallThickness: 0.4,
};

// ---------------------------------------------------------------- the plan
//
//   z +15  ┌──────────────────────────────────────────┐  north
//          │  GARAGE  │      THE HOUSE      │ SUMMER  │
//          │  drive   │                     │  HOUSE  │
//    z +2  │──────────┼── pool terrace ─────┼─────────│
//          │          │   SWIMMING POOL     │ PARTERRE│
//          │  veg +   │                     │  COURT  │
//          │ GREENHSE │    THE GREAT LAWN   │         │
//   z -15  └──────────┴─────── hive ────────┴─ ORCHARD┘  south
//         x -20                                      x +20
//
const zones: Zone[] = [
  // ---- surfaces ----
  {
    id: 'lawn', label: 'THE GREAT LAWN', kind: 'ground',
    x: 0, z: -7.5, w: 22, d: 14, h: 0,
    note: 'The open middle. Longest unbroken flight line on the property.',
  },
  {
    id: 'meadow', label: '', kind: 'ground',
    x: 0, z: 6, w: 40, d: 18, h: 0,
    note: 'Grass under and around the buildings.',
  },
  {
    id: 'pool-terrace', label: 'POOL TERRACE', kind: 'paving',
    x: 0, z: 1.75, w: 17, d: 6.5, h: 0.15,
    note: 'Raised stone. The 15 cm lip is a cliff at bee scale.',
  },
  {
    id: 'pool', label: 'SWIMMING POOL', kind: 'water',
    x: 0, z: 1.75, w: 10, d: 4, h: 0.05,
    note: 'Ten metres of open water. Landing on it should be a decision.',
  },
  {
    id: 'drive', label: 'DRIVEWAY', kind: 'gravel',
    x: -14.5, z: 3, w: 11, d: 16, h: 0.02,
    note: 'Gravel: at bee scale a boulder field you fly between.',
  },
  {
    id: 'court', label: 'SPORT COURT', kind: 'paving',
    x: 15, z: -3, w: 8, d: 8, h: 0.02,
    note: 'Fenced on all four sides — a cage with an open top.',
  },
  {
    id: 'court-fence', label: '', kind: 'wall',
    x: 15, z: -3, w: 8, d: 8, h: 3, hollow: true,
    note: 'Chain-link. Only a flying thing gets in over the top.',
  },

  // ---- the house ----
  {
    id: 'house', label: 'THE HOUSE', kind: 'building',
    x: 0, z: 9.5, w: 18, d: 9, h: 8,
    note: 'Two storeys. 8 m of wall against a 1.7 m human.',
  },
  {
    id: 'house-roof', label: '', kind: 'building',
    x: 0, z: 9.5, w: 19.4, d: 10.4, h: 2.6, y: 8,
    note: 'Overhanging roof; the gutter runs under its edge.',
  },
  {
    id: 'gutter', label: 'GUTTER RUN', kind: 'prop',
    x: 0, z: 4.7, w: 18, d: 0.18, h: 0.18, y: 8, hollow: true,
    note: 'An 18 m channel you fly along. The estate-scale version of M6.',
  },
  {
    id: 'chimney', label: '', kind: 'building',
    x: 5.5, z: 9.5, w: 1.2, d: 1.2, h: 2.4, y: 10.6,
    note: 'Highest point on the property. Perch and landmark.',
  },
  {
    id: 'veranda', label: 'VERANDA', kind: 'building',
    x: 0, z: 4.4, w: 14, d: 2.4, h: 0.2, hollow: true,
    note: 'Decked, raised, open underneath. Human-proof.',
  },

  // ---- outbuildings ----
  {
    id: 'garage', label: 'GARAGE', kind: 'building',
    x: -15.5, z: 9, w: 7, d: 6, h: 3.2, hollow: true,
    note: 'Door left open. An interior with a car in it, one storey up nothing.',
  },
  {
    id: 'greenhouse', label: 'GREENHOUSE', kind: 'glass',
    x: -15, z: -8.5, w: 6, d: 3, h: 2.6, hollow: true,
    note: 'Glass, hot, still air. The atmosphere zone the design doc wanted.',
  },
  {
    id: 'potting-shed', label: 'POTTING SHED', kind: 'building',
    x: -9.5, z: -9.5, w: 3, d: 3, h: 2.4, hollow: true,
    note: 'Tools, jars, salvage. The dense-loot room.',
  },
  {
    id: 'summerhouse', label: 'SUMMER HOUSE', kind: 'building',
    x: 15.5, z: 10, w: 4.5, d: 4.5, h: 3, hollow: true,
    note: 'The folly the property is named for. Open-sided landmark.',
  },

  // ---- planting ----
  {
    id: 'parterre', label: 'FORMAL GARDEN', kind: 'planting',
    x: 10.5, z: 4.5, w: 7, d: 5, h: 0.6,
    note: 'Clipped hedge grid — a maze at ankle height, a canyon at bee height.',
  },
  {
    id: 'fountain', label: 'FOUNTAIN', kind: 'water',
    x: 10.5, z: 4.5, w: 1.6, d: 1.6, h: 0.9,
    note: 'Standing water, high up, in the middle of the hedge grid.',
  },
  {
    id: 'orchard', label: 'ORCHARD', kind: 'planting',
    x: 11, z: -11, w: 15, d: 7, h: 0,
    note: 'Twelve trees on a grid. Canopy flying with regular gaps.',
  },
  {
    id: 'veg', label: 'VEGETABLE BEDS', kind: 'planting',
    x: -13, z: -4.5, w: 11, d: 3.6, h: 0.4,
    note: 'Raised beds. Cover at ground level, and a food source.',
  },
  {
    id: 'compost', label: 'COMPOST', kind: 'prop',
    x: -18, z: -12.5, w: 2, d: 2, h: 1.2,
    note: 'Warm, humid, full of salvage. Another atmosphere zone.',
  },

  // ---- the hive ----
  {
    id: 'hive', label: 'THE HIVE', kind: 'prop',
    x: -2, z: -14.6, w: 1.4, d: 0.7, h: 1.2, y: 0.6,
    note: 'In a hollow of the south wall. Visible to humans, reachable only by bees.',
  },
];

// Repeated things are generated from constants so the numbers stay honest.
function orchardTrees(): Zone[] {
  const out: Zone[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      out.push({
        id: `orchard-${row}-${col}`, label: '', kind: 'planting',
        x: 5.5 + col * 3.6, z: -13.5 + row * 2.6,
        w: 2.8, d: 2.8, h: 5,
        note: 'Fruit tree: 5 m of trunk and canopy.',
      });
    }
  }
  return out;
}

function hedgeGrid(): Zone[] {
  const out: Zone[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      out.push({
        id: `parterre-${i}-${j}`, label: '', kind: 'planting',
        x: 7.8 + i * 1.8, z: 2.6 + j * 1.8, w: 1.2, d: 1.2, h: 0.6,
      });
    }
  }
  return out;
}

function boundaryWalls(): Zone[] {
  const { minX, maxX, minZ, maxZ, wallHeight: h, wallThickness: t } = ESTATE;
  const w = maxX - minX;
  const d = maxZ - minZ;
  return [
    { id: 'wall-s', label: '', kind: 'wall', x: 0, z: minZ, w: w + t, d: t, h },
    { id: 'wall-n', label: '', kind: 'wall', x: 0, z: maxZ, w: w + t, d: t, h },
    { id: 'wall-w', label: '', kind: 'wall', x: minX, z: 0, w: t, d, h },
    { id: 'wall-e', label: '', kind: 'wall', x: maxX, z: 0, w: t, d, h },
  ];
}

/** People, for scale. A greybox without them is just abstract boxes. */
function scaleFigures(): Zone[] {
  const spots: Array<[number, number, string]> = [
    [0, -2, 'poolside'],
    [-13, 2, 'by the car'],
    [8, -9, 'in the orchard'],
    [-11, -7, 'at the greenhouse'],
  ];
  return spots.map(([x, z, label], i) => ({
    id: `ref-${i}`, label: i === 0 ? '1.7 m' : '', kind: 'ref' as const,
    x, z, w: 0.45, d: 0.28, h: 1.7, note: `Human, ${label}.`,
  }));
}

export const ZONES: Zone[] = [
  ...zones,
  ...orchardTrees(),
  ...hedgeGrid(),
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
 */
export function traversal(cruiseUnitsPerSec: number, boostMultiplier: number) {
  const acrossUnits = ESTATE.width * M;
  const diagUnits = diagonalMetres() * M;
  return {
    acrossCruise: acrossUnits / cruiseUnitsPerSec,
    acrossBoost: acrossUnits / (cruiseUnitsPerSec * boostMultiplier),
    diagCruise: diagUnits / cruiseUnitsPerSec,
    diagBoost: diagUnits / (cruiseUnitsPerSec * boostMultiplier),
  };
}
