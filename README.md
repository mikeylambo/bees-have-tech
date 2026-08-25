# The Bees Have Tech!

A physics-comedy sandbox where **one bee with wearable tech** turns an ordinary
property into an epic open world — and, mission by mission, turns its hive into
a civilization.

> "Scientists thought bees built hives. They actually built civilization."

Standalone IP. Not part of the Soulfire Legends Universe.

## Play the prototype

**▶ https://bees-have-tech.vercel.app**

You land on a title screen over a live camera drifting the property's spine.
**New Game** starts a fresh run; **Continue** picks up the one you were on —
quests, blueprints, salvage and exposure all survive a refresh. Play takes
pointer lock and starts audio in the same click.

**📐 Estate blockout:** linked from the title screen, or `/estate.html`
directly — a flyable greybox of the same **90 × 120 m** estate as flat volumes,
with human figures for scale and a readout of how long everything takes to
cross. No quests, no household, no grass.

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
| **X (hold)** | **Come home** — rescues a wedged bee to the hive |
| **Esc** | **Pause** — the world stops dead behind the menu |
| Mouse | Look · H hides the HUD |

Gamepad: L-stick fly · R-stick look · RT/LT altitude · **A** overdrive ·
**RB** use · **B** sting · **X** alt · **LB** hold for the wheel ·
**Y** workshop · **Back** hold to come home · **Start** pause.
Every menu is fully drivable by pad alone and by keyboard alone.

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
- **Bee presets** ✅ Playtested vs retuned flight, switchable — so scale and feel can be judged one at a time
- **M7 — Feel & look** ✅ Pollen optical flow, speed FX, synthesised wingbeat, cel shading
- **M8 — The household** ✅ Four people who disagree about you; exposure is now a social problem
- **M9 — The estate** ✅ The 90 × 120 m property IS the game now. The backyard is gone.
- **The shell** ✅ Title, pause, settings, rescue, and a run that survives a refresh

## The property

Ninety metres by a hundred and twenty. A main house, a guest house, a garage
and a cabana; a pool terrace, a formal garden, an orchard, a kitchen garden
and a potting shed; and an 80 m straight driveway from the gate to the motor
court, which is the one place you can hold overdrive in a line.

The hive is in a hollow of the **west gate pillar**. The bees live in the
front gate.

Salvage lives where that kind of salvage would end up — bottle caps at the
fire pit, screws under the climbing frame, batteries in the service yard,
circuit boards in the potting shed — and each of those sits at a different
distance from home, guarded by a different person.

## Who lives here

Four people share the property, and exposure depends on **which** of them is
looking at you, not just whether anyone is.

- **Dale** — the handy one. Sees furthest and believes the evidence. Keeps the
  service yard, where every battery is.
- **Marla** — the short fuse. Escalates fastest, walks fastest, hits hardest.
  Owns the pool terrace and all three appliances.
- **Robin** — the kid. Notices everything, chases, never swings, and is
  actively covering for you. While Robin is the only one watching, exposure
  **falls**. Lives at the playground, where the screws are.
- **Ned** — the skeptic. Barely moves, barely looks, and multiplies everyone
  else's certainty down while he's in the room. Sits at the fire pit, next to
  the first salvage a new bee can reach.

So "don't be seen" becomes "be seen by the right person", which is a better
game than a stealth cone. The exposure bar names its watchers: ▲ for the ones
raising it, ▼ for the one who isn't.

## The loop, as it plays now

Fly out, find salvage, haul it into the hive. Quests name what to look for and
put a waypoint on it; the hive banks what you bring. Then hover at the hive
mouth and press **R** to open the **Hive Workshop** and spend it — the catalog
is a place you fly to, not a menu you escape into, and time only slows to 25%
while it's open, so the human keeps walking toward you while you shop.

Salvage is finite and the catalog costs more than a careless run collects.
Choosing what to wear is the point.

## Scale and speed

One unit is 1.7 cm, fixed by the human at 100 units. The property is
**90 × 120 m** — 10,800 m², crossed in about 26 seconds at cruise.

Two **bee presets**, switchable from the tuning panel (or `1` / `2` in the
blockout). Each is a complete coupled set — flight, camera lead, and every
reach measured in world units — so you compare configurations rather than
hybrids:

| | Estate (default) | Backyard |
|---|---|---|
| Cruise | 3.4 m/s | 0.78 m/s |
| Overdrive | 10.2 m/s | 3.83 m/s |
| Grapple line | 6.8 m | 2.0 m |
| Estate, corner to corner | 44 s / 15 s | ~3 min / 39 s |

*A real honeybee forages at 4–5.5 m/s and tops out near 8.* The main house is
nine metres to the eaves, the boundary wall is 2.4 m of cliff, and the places a
person can't follow you into are the ones that fly: the 34 m gutter run under
the eaves, the greenhouse roof vent, the garage and the cabana, the tree
canopies, and the ironwork of the gate itself.

## Local development

```bash
cd Prototype && npm install && npm run dev
```

Open **http://localhost:5173/?dev** — the tuning panel is a development tool
and lives behind that flag now (or press backtick in any build to summon it).
The four things a player should be able to change — volume, look sensitivity,
invert Y, reduced motion — are in the in-game Settings screen instead.

The Tweakpane panel live-edits every feel constant —
flight, camera, grapple, tractor beam, flower springiness — plus a seeded yard
reshuffle and **grass density**, which is the one number that was guessed
against software rendering rather than a real GPU. Dial it in and paste the
settings JSON back.
