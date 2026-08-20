# The Bees Have Tech! — Concept Pillars

**Status:** Identity locked · v1 — 2026-08-20
**IP:** Standalone (not SLU). No shared-universe obligations.
**Source:** [Reference/Bees Have Tech Design Doc OG.pdf](Reference/Bees%20Have%20Tech%20Design%20Doc%20OG.pdf) + design session 2026-08-20

---

## Logline

A physics-comedy sandbox where **one bee with wearable tech** turns an ordinary
backyard into an epic open world — and, mission by mission, turns its hive into
a civilization.

## The joke (protect it)

**Bees have wearable tech.** That's the original joke and the whole pitch.
A bee wearing goggles is funny. A bee with a stinger grappling cable is funny.
Everything in the game must survive this test: *if it stops looking like a bee
wearing something ridiculous, it has drifted off-brand.* Even the endgame mech
is a wearable — the bee is visibly piloting it, antennae poking out.

Corollary: **the premise needs no explanation.** If a feature requires a
paragraph of setup before it's funny, cut it.

---

## Pillars

### 1. Scale inversion IS the open world
The backyard is the map, and it's epic *because* you're an inch tall.
Ordinary objects are systemic set-pieces:

| Human object | At bee scale |
|---|---|
| Lawn mower | Roaming world boss |
| Sprinkler | Scheduled weather catastrophe |
| Dog | Kaiju |
| Bug zapper | Fortress / power station |
| Soda can | Industrial resource deposit |
| Flowerbed | Contested biome (wasp territory) |
| Garden shed | Late-game dungeon |
| Child | Titan-class environmental event |

**Design test for any new content:** does this object get *more* interesting
at one inch tall? If not, it doesn't earn a place in the yard.

### 2. You are always the bee
Embodied, third-person, physics-driven — Goat Simulator lineage. Physics
comedy needs a body; the player never leaves it. The hive, swarm, and drones
grow in capability, but they are **tools you trigger from inside the action**
(a swarm beacon you throw, a drone wingman you whistle for), never a top-down
command mode. No RTS camera. Ever.

### 3. Escalation is the arc
The tech ladder is the game's story structure, not a shop inventory:

> Flight → Scanner → Honey Welder → Micro-Laser → Tractor Beam → Bee Drone →
> Mini Railgun → Swarm Teleporter → Bee Mech → Orbital Hive Platform

Three tiers, each changing how the yard reads:

- **Scout** — solo wearables. The yard is huge and dangerous. Survive it.
- **Engineer** — hive-scale tools, drone wingmen, infrastructure. The yard is
  a resource map. Exploit it.
- **Civilization** — mechs, hijacked human machinery, hive neural interface.
  The yard is yours. The trailer moment lives here: *six bees operating a
  stolen forklift.*

Player power and hive advancement are the same meter — every gadget you earn
visibly upgrades the hive, and every hive upgrade puts new gear on your body.

### 4. Comedy from systems, not scripts
Chaos emerges from physics + interacting toys (honey foam + sprinkler +
angry wasp = content). Missions are framing devices and punchlines; the
sandbox generates the actual comedy. Streamability is a first-class design
goal — every ability should combine with at least two other systems in ways
we didn't fully predict.

---

## Tone

Comedy-forward sandbox with a **light narrative spine** — enough story to give
the escalation a reason (why are the bees militarizing? something in or beyond
the yard is a threat) and a finale, delivered in trailer-beat quantities, not
cutscene quantities. Reference blend:

- **Goat Simulator** — physics chaos, mission-as-punchline
- **Pikmin** — tiny-world charm and texture
- **Honey, I Shrunk the Kids** — scale wonder
- *Explicitly not Bee Movie.*

## What this game is NOT

- Not **Bee Simulator** — zero educational realism obligations
- Not an **RTS or base-builder** — hive growth is expressed through the bee's body and the yard, not menus and build queues
- Not **story-heavy** — narrative is scaffolding for escalation
- Not **"Bee Simulator but the bee owns a laser"** — the identity is scale inversion + wearable tech + escalation, together

---

## Path to playable (next step)

Vertical slice = **one backyard corner**, per the OG doc:
one hive base · one flower patch · one hostile wasp · one human machine ·
three tech abilities (suggest: Wing Overdrive, Stinger Grapple, Honey Foam
Launcher — one traversal, one utility, one chaos toy) · breakable props ·
one ridiculous mission.

The slice exists to validate exactly five things: **flight feel, comedy,
toy interactions, tiny-world scale, ability combos.** Nothing else.

## Open questions (next session)

1. **Engine for the playable** — Three.js web prototype (OG doc's rec, fastest
   to share) vs. Godot 4.6 (existing Game OS Base pipeline/buildloop) vs.
   Unity (house 3D engine — GGPX, Glyphfall). Flight feel + physics density is
   the whole bet, so pick whichever gets *controllable flight over a physics
   yard* in hand fastest.
2. **Title clearance** — "The Bees Have Tech!" needs a USPTO preliminary pass
   before anything public.
3. **Co-op** — the forklift moment implies it. Decide early whether the slice
   must prove it or defer it.
