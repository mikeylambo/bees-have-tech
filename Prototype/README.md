# The Bees Have Tech! — Prototype

**M0 — Flight ✅ · M1 — Grapple & Carry ✅**

See `../CONCEPT_PILLARS.md` and `../SLICE_PLAN.md` for what this slice exists
to validate: **flight feel, comedy, toy interactions, tiny-world scale,
ability combos.**

## Stack

Three.js (WebGL) · Rapier physics (WASM) · TypeScript · Vite · Tweakpane

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173, click to lock the mouse, fly.

## Controls

| Input | Action |
|---|---|
| WASD | Fly (camera-relative) |
| Space / C | Ascend / descend |
| Shift | Wing Overdrive (boost) |
| **Left click** | Stinger grapple — hold to reel in |
| **Right click** | Tractor beam — hold to carry, release to drop |
| **F** | Throw carried object |
| Mouse | Look |
| Esc | Release mouse |

Gamepad: L-stick fly · R-stick look · RT/LT altitude (analog) · **A** overdrive ·
**RB** grapple · **LB** carry · **X** throw

### Reticle states

| Colour | Meaning |
|---|---|
| White | Nothing in range |
| Yellow | Grapple anchor — world geometry or something too heavy to lift |
| Blue | Light enough for the tractor beam |

## Structure

- `src/bee/flight.ts` — **the flight model.** Zero-G body + damping as air thickness.
- `src/bee/grapple.ts` — stinger grapple. Rope joint, so you *swing* rather than get winched.
- `src/bee/carry.ts` — tractor beam. Velocity servo, stable at any mass.
- `src/bee/bee.ts` — bee visual (goggles + tech backpack, per pillar 0)
- `src/world/grass.ts` — 70k instanced grass blades, seeded scatter, wind sway
- `src/world/yard.ts` — ground, fence, springy flowers, props, salvage batteries
- `src/core/tuning.ts` — Tweakpane panel; every feel constant is live-editable
- `src/core/rng.ts` — seeded RNG (procgen determinism from commit one)

## Design notes worth keeping

**Mass ratio decides who moves.** Grapple a pebble and it comes to you; grapple
the fence and you go to it. Nothing special-cases this — it falls out of the
physics, and it's free comedy.

**Flower stems are springs, not statics.** Each head is a light dynamic body
held to an anchor by a spring joint, and the stem mesh is re-aimed from base to
head each frame so it visibly bends. Stiffness and damping are live-tunable and
rebuild the joints on change.

**Weight is measured against a reference pebble** (`carry.refMass`), not against
1.0 — every prop in this yard weighs well under a kilo, so an absolute scale
would call them all weightless.

## Known rough edges

- Reeling in toward a flower pulls *you* to the flower rather than bending it
  much; the bend shows up when you swing with momentum. Tune `flower.stiffness`
  down if you want floppier stalks.
- No landing/perch state yet — the bee just collides with surfaces.
- The tuning panel has no save; note good values by hand for now.
