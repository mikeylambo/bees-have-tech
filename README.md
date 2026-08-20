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
| Left click | Stinger grapple — hold to reel |
| Right click | Tractor beam — hold to carry |
| F | Throw carried object |
| Mouse | Look · Esc to release |

Gamepad: L-stick fly · R-stick look · RT/LT altitude · **A** overdrive ·
**RB** grapple · **LB** carry · **X** throw

## Repo layout

| Path | What |
|---|---|
| [CONCEPT_PILLARS.md](CONCEPT_PILLARS.md) | Identity, pillars, what this game is NOT |
| [SLICE_PLAN.md](SLICE_PLAN.md) | Scope, core loop, milestones M0–M4 |
| [Prototype/](Prototype/) | Playable build — Three.js + Rapier + TypeScript + Vite |
| [Reference/](Reference/) | Original design brainstorm |

## Milestones

- **M0 — Flight** ✅ Flight feel, tiny-world scale, instanced grass, live tuning
- **M1 — Grapple & carry** ✅ Stinger grapple, tractor beam, springy flowers
- **M2 — One human** — reactive NPC + exposure ladder *(next)*
- **M3 — Hack & chain reactions** — sprinkler, zapper, fan; water meets electricity
- **M4 — Swarm & research** — recruit bees, salvage parts, close the loop

## Local development

```bash
cd Prototype && npm install && npm run dev
```

Open http://localhost:5173. The Tweakpane panel live-edits every feel constant —
flight, camera, grapple, tractor beam, flower springiness — plus a seeded yard
reshuffle.
