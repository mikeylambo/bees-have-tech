# The Bees Have Tech!

A physics-comedy sandbox where **one bee with wearable tech** turns an ordinary
property into an epic open world — and, mission by mission, turns its hive into
a civilization.

> "Scientists thought bees built hives. They actually built civilization."

Standalone IP. Not part of the Soulfire Legends Universe.

## Play the prototype

**▶ https://bees-have-tech.vercel.app**

**📐 Estate blockout:** `/estate.html` — a flyable greybox of the **90 × 120 m**
gated estate: gate, 80 m drive, motor court, three buildings, garden rooms.
No quests, no human, no grass; flat volumes, human figures for scale and a
readout of how long everything takes to cross.

Desktop only — needs a mouse and keyboard, or a game controller.
Auto-deploys from `main`; build root is `Prototype/`.

| Input | Action |
|---|---|
| WASD | Fly (camera-relative) |
| Space / C | Ascend / descend |
| Shift | Wing Overdrive (boost) |
| Left click / E | Use the equipped tech |
| Right click / Q | Sting (innate — never swapped away) |
| F | Alt action (throw what you're carrying) |
| Tab (hold) | Tech wheel · scroll to quick-cycle |
| R | Hive Workshop — only at the hive mouth |
| Mouse | Look · Esc to release · H hides the UI |

Gamepad: L-stick fly · R-stick look · RT/LT altitude · **A** overdrive ·
**RB** use · **B** sting · **X** alt · **LB** hold for the wheel ·
**Y** workshop

## Repo layout

| Path | What |
|---|---|
| [CONCEPT_PILLARS.md](CONCEPT_PILLARS.md) | Identity, pillars, what this game is NOT |
| [SLICE_PLAN.md](SLICE_PLAN.md) | Scope, core loop, milestones M0–M5 |
| [Prototype/](Prototype/) | Playable build — Three.js + Rapier + TypeScript + Vite |
| [Prototype/src/world/property.ts](Prototype/src/world/property.ts) | The built environment: fences, house, deck, shed, beds, neighbourhood |
| [Prototype/src/game/quests.ts](Prototype/src/game/quests.ts) | Quest chain and objective tracking |
| [Prototype/src/game/blueprints.ts](Prototype/src/game/blueprints.ts) | Workshop catalog — what salvage buys |
| [Prototype/src/world/grass.ts](Prototype/src/world/grass.ts) | The grass field that rides along with the bee |
| [Prototype/src/world/estateBlockout.ts](Prototype/src/world/estateBlockout.ts) | The estate layout as plain data — the part that ports to a real engine |
| [Reference/](Reference/) | Original design brainstorm |

## Milestones

- **M0 — Flight** ✅ Flight feel, tiny-world scale, instanced grass, live tuning
- **M1 — Grapple & carry** ✅ Stinger grapple, tractor beam, springy flowers
- **M2 — One human** ✅ Reactive NPC, perception gates, exposure ladder
- **M3 — Hack & chain reactions** ✅ Sprinkler, zapper, fan; water meets electricity
- **M4 — Swarm & salvage** ✅ Hive, swarm beacon, reverse engineering
- **M5 — The property** ✅ Enclosed yard, quest chain, the Hive Workshop
- **M6 — Real scale** ✅ A 10 × 8.7 m garden, six vertical layers, grass that follows you
- **Flight retune** ✅ Cruise 1.02 → 3.35 m/s; the world had outgrown the model
- **Estate blockout** 📐 90 × 120 m greybox of the flagship property, pending a verdict

## The loop, as it plays now

Fly out, find salvage, haul it into the hive. Quests name what to look for and
put a waypoint on it; the hive banks what you bring. Then hover at the hive
mouth and press **R** to open the **Hive Workshop** and spend it — the catalog
is a place you fly to, not a menu you escape into, and time only slows to 25%
while it's open, so the human keeps walking toward you while you shop.

Salvage is finite and the catalog costs more than a careless run collects.
Choosing what to wear is the point.

## Scale and speed

One unit is 1.7 cm, fixed by the human at 100 units. The bee cruises at
**3.35 m/s** and hits **8.75 m/s** on Wing Overdrive — a real honeybee forages
at 4–5.5 and tops out near 8, so overdrive is the tech doing something a bee
can't. (It used to cruise at 1.02 m/s, which was 1.09× a walking man.)

The backyard vertical slice is **10.0 × 8.7 m** — four seconds to cross at
cruise. The estate blockout is **90 × 120 m** — 26 s across, 44 s corner to
corner, 15 s corner to corner on overdrive. The house wall is
six metres of backlit siding above you, the fence is 1.8 m of cliff, and there
are six places a person can't follow you into: under the deck, under the shed,
inside the gutter and its downspout, over the hedge, up the tree, and into the
woodpile.

## Local development

```bash
cd Prototype && npm install && npm run dev
```

Open http://localhost:5173. The Tweakpane panel live-edits every feel constant —
flight, camera, grapple, tractor beam, flower springiness — plus a seeded yard
reshuffle and **grass density**, which is the one number that was guessed
against software rendering rather than a real GPU. Dial it in and paste the
settings JSON back.
