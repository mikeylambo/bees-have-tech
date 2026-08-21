# The Bees Have Tech! — Prototype

**M0 — Flight ✅ · M1 — Grapple & Carry ✅ · M2 — One Human ✅**

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
| H | Hide the dev UI |
| Esc | Release mouse |

Gamepad: L-stick fly · R-stick look · **LT up / RT down** (analog; swappable in
the Controller folder) · **A** overdrive · **RB** grapple · **LB** carry ·
**X** throw

### What `damping` and `overspeed drag` actually do

Both slow you down, but they act in different places and shape different
moments.

**damping** — how thick the air is. Applied *always*, proportional to your
current speed. It decides what happens when you **let go of the stick**: high
damping stops you almost immediately (twitchy, precise, insect-like); low
damping lets you coast for ages (floaty, drifty, more like a paper plane).
Tune this for how the bee feels to *stop*.

**overspeed drag** — only bites *above* `maxSpeed`. Normal flying never touches
it. It decides how long **borrowed speed** sticks around: a grapple swing, a
swat sending you flying, a fan gust later on. High values snap you back to
normal speed almost at once, which makes swings feel abrupt and safe. Low
values let a good swing fling you across the yard and stay fast for a while.
Tune this for how far a swing throws you.

Rule of thumb: `damping` is the feel of your own flying; `overspeed drag` is
the feel of the world throwing you around.

### Settings persistence

Tuning is saved to `localStorage` automatically (debounced) and restored on
load, before the world is built. **↩︎ reset to shipped defaults** clears it.

### Sharing tuning values

The **Settings I/O** folder copies every tuning value to the clipboard as JSON
(or shows it in a selectable box if the clipboard is blocked), and pastes a
JSON blob back in. Paste-apply only writes keys that already exist and match
types, so a stale blob can't inject junk.

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

**Simulate honestly, assist generously.** The world's physics stay real —
that's where the comedy comes from, because real physics doing stupid things is
funnier than fake physics. The player's *gadgets* are arcade-y and cheat in
their favour: aim assist, no accidental drops, forgiving reel. Same trick Goat
Simulator plays with honest ragdolls and an absurdly sticky tongue.

**Aim is two-stage.** The camera ray finds a point; the gadget fires from the
*bee* toward that point. Firing straight from the camera makes close-range
shots miss by the parallax between camera and bee.

**The lawn is demoted.** The ground is enormous and always under the crosshair,
so a raw raycast catches it constantly. If a shot would land on ground and a
real target sits within the assist cone, it snaps to that target. Deliberate
ground shots still work — you just need nothing better nearby.

**Altitude is the risk dial.** This fell out of M2 rather than being designed
up front, and it's the best thing in the milestone. Fly at head or chest
height and the human connects almost every swing. Fly low and he swings and
whiffs — all the thrill, none of the damage. Drop into the grass and he can't
see you at all. Height, visibility and danger are one axis, and it's teachable
without a word of tutorial.

**The human's blind spots are real and exploitable.** Vertical FOV is ±75°, so
directly overhead or right at his feet is genuinely safe. He also won't walk so
close that you fall into his own blind spot — otherwise he'd stroll up, lose
you, and wander off looking silly.

**Swat hit detection sweeps, it doesn't snapshot.** The hand is tested against
the bee every frame of the swing. Resolving at one chosen instant means the arm
only ever connects at whatever height it happens to be passing then — the first
version swiped at ankle level and whiffed every bee at head height.

**Heavy cargo taxes flight; it never falls out of the beam.** A bee hauling a
battery flies like a sluggish pig (readable, funny). Dropping the battery
because you turned too fast is just punishment. `carry.breakDistance` is a
safety net for wedged objects, not a gameplay rule.

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
