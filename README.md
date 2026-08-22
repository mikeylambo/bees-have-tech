# The Bees Have Tech!

A physics-comedy sandbox where **one bee with wearable tech** turns an ordinary
property into an epic open world — and, mission by mission, turns its hive into
a civilization.

> "Scientists thought bees built hives. They actually built civilization."

Standalone IP. Not part of the Soulfire Legends Universe.

## Play the prototype

**▶ https://bees-have-tech.vercel.app**

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
| [Reference/](Reference/) | Original design brainstorm |

## Milestones

- **M0 — Flight** ✅ Flight feel, tiny-world scale, instanced grass, live tuning
- **M1 — Grapple & carry** ✅ Stinger grapple, tractor beam, springy flowers
- **M2 — One human** ✅ Reactive NPC, perception gates, exposure ladder
- **M3 — Hack & chain reactions** ✅ Sprinkler, zapper, fan; water meets electricity
- **M4 — Swarm & salvage** ✅ Hive, swarm beacon, reverse engineering
- **M5 — The property** ✅ Enclosed yard, quest chain, the Hive Workshop

## The loop, as it plays now

Fly out, find salvage, haul it into the hive. Quests name what to look for and
put a waypoint on it; the hive banks what you bring. Then hover at the hive
mouth and press **R** to open the **Hive Workshop** and spend it — the catalog
is a place you fly to, not a menu you escape into, and time only slows to 25%
while it's open, so the human keeps walking toward you while you shop.

Salvage is finite and the catalog costs more than a careless run collects.
Choosing what to wear is the point.

## Local development

```bash
cd Prototype && npm install && npm run dev
```

Open http://localhost:5173. The Tweakpane panel live-edits every feel constant —
flight, camera, grapple, tractor beam, flower springiness — plus a seeded yard
reshuffle.
