# The Bees Have Tech! — Vertical Slice Plan

**Status:** v12 — 2026-08-25 · supersedes the "one backyard corner" slice in CONCEPT_PILLARS.md
**Target:** the seven-verb chain — Flight → Physics → Gadget → Hack → Swarm →
Human Reaction → Chain Reaction.
**Web version (phone-friendly):** https://claude.ai/code/artifact/1fb7ce48-5aa3-4dd8-9f45-98c0ce69c9e1

---

## Scope: one property plus family

**Launch footprint = one property, fully realized.** Yard, shed, garage, house
interior, roof, wall cavities — plus the family who lives there. Not a
backyard; a home with people in it.

### What the references actually shipped
- **Goat Simulator (2014):** ONE map (GoatVille, small suburban). ~10 weeks,
  ~10 devs, $10. Second map free 2 months later. The big world is Goat
  Simulator 3 (2022), ~18× bigger, 8 years and a franchise later.
- **Bee Simulator (2019):** ONE map (Central Park), ~3h main story. Premium
  price; thinness was the standard review complaint.

Neither shipped a town. But the argument for going bigger than a backyard isn't
square footage — **the tech needs somewhere to escalate into.** A government
response must be provoked somewhere; a lone yard can't host that fiction, so
the top of the exposure ladder would be unreachable.

### Why one property is bigger than it sounds
**Volume, not area.** At bee scale a house is a layered dungeon:
roof/gutters → attic → interior → **wall cavities (the hive)** → yard/deck/
driveway → shed/garage → crawlspace/drains.

**The family is the content.** 4–5 humans who react to evidence *differently*
turn exposure from a meter into a social system:

| Member | Role | Effect on exposure |
|---|---|---|
| The Handy One | Fixes things, notices missing parts | Raises — investigates |
| The Kid | Thinks the bee is awesome, hides it from adults | Lowers — conceals, can ally |
| The Short Fuse | No patience, reaches for spray, tells everyone | Escalates fastest |
| The Skeptic | Explains away every piece of evidence | Dampens — buys time |
| The Dog | Kaiju; can't be reasoned with | Chaos — ignores the social system |

Getting caught by the Kid is a *resource*. Caught by the Short Fuse in front of
the Skeptic is survivable. Both at once is how the government ends up on the lawn.

## Growth: three axes, one of them nearly free

1. **Repopulate — same house, new tenants.** ⭐ Strongest and cheapest. The
   people were always the content, so swapping them is a new game that reuses
   every expensive system (AI, exposure, hacking) at full value.
   *Friends on vacation · company retreat · family reunion · parade staging in
   the street · house going up for sale.*
2. **Deeper — more of the same property.** Sewer line, neighbor's fence, the
   car, storm drains. Reuses the art vocabulary. Free-update territory.
3. **Wider — neighborhood, then town.** Genuinely new geography, most
   expensive. Much cheaper *after* one house exists, since a second house is
   mostly reuse — which is the argument for making the first one deep.

**The unlock:** the government arriving is just a *tenant swap*. Containment
tents, black SUVs, a scientist where the dad used to be — same geometry,
different game. **Escalation and episodic content are the same system.**

---

## The core loop, in one sentence

**Steal human tech → reverse-engineer it into bee tech → using bee tech gets
you noticed → humans escalate → escalation creates better tech to steal.**

That's a closed loop, and it's the whole game. Reverse Engineering and Human
Exposure are not two systems — they're the two halves of one flywheel.
Progression *causes* the difficulty curve. Nothing else in the design needs
to carry the arc.

## Why this is the differentiator

Goat Simulator gives you verbs and a world that reacts. Bee Simulator gives
you scale and flight. Neither has a reason to *keep* playing beyond content.
Our loop means every ridiculous thing you do has a consequence that makes the
world more interesting, which is what neither reference has.

**The design lens:** every mundane object has a second interpretation. The
lawn mower is a boss, a vehicle, a power source, a salvage field, a hazard,
*and* a hackable weapon. If a new object only has one interpretation, it isn't
finished.

---

## Atmosphere is a system, not a setting

Came out of tuning M2: **`damping` — how thick the air is — should be a
property of the space, not a global constant.** The bee's whole feel changes
with it, so the air becomes a gameplay layer we get almost for free.

- Open lawn: baseline
- In front of a box fan: low damping, high push — you get flung
- Inside the house: still, heavy air — precise, claustrophobic flying
- Steam over a kettle / humid greenhouse: high damping, sluggish
- Rain or sprinkler spray: damping plus downward force
- A/C vent or draft under a door: a current you can ride like a highway

**Why it matters:** it makes *where you are* change *how you fly*, which is
the cheapest possible way to make one property feel like many places. It also
gives the fan a real reason to exist beyond blowing props around.

**How to apply:** damping and gravity/force become fields sampled at the bee's
position rather than globals. Start with one zone type in M3 (the fan) and
prove the sampling architecture; everything else is then content.

Generalized rule worth hunting for elsewhere: **look for constants that should
be fields.** Light level (seen/unseen), noise, temperature and wind are all
candidates.

## The verb that matters most: HACK

Physics lets you *move* objects. Hacking makes objects into **systems you can
turn against each other** — and that's what produces chains nobody scripted.
A sprinkler you can shove is a prop. A sprinkler you can *trigger on demand*
is a weather machine, a distraction, a weapon, and an electrical hazard
depending on what else is nearby.

Design rule: **every hackable object exposes one simple verb** (on/off,
aim, speed up). Complexity comes from combining them, never from any single
object's interface.

---

## Exposure ladder (drives everything)

| Level | Human read | World response |
|---|---|---|
| 0 — Nature | "Just a bee." | Nothing |
| 1 — Nuisance | "Annoying bee." | Swatting, bug spray, closed windows |
| 2 — Infestation | "We have a problem." | Traps, exterminator visits, hive searches |
| 3 — Anomaly | "That bee has a LASER." | Cameras, drones, a scientist |
| 4 — Species | "First contact." | The property is no longer theirs — new tenants, in hazmat |

Exposure should be **partially reversible** — lie low, sabotage evidence,
hack the cameras. Otherwise the ladder is a one-way difficulty ratchet and
players will avoid using the fun toys, which kills the game.

---

## Milestones (sequenced, not all at once)

Each milestone ends with a playable build and a specific question answered.

### M0 — Flight ✅ DONE
Flight feel, tiny-world scale, instanced grass, physics props, tuning panel,
gamepad + KBM. **Answered:** does bee flight feel good? Yes.

### M1 — Physics + Gadget ✅ BUILT
Stinger grapple (rope joint — you *swing*, not winch) and tractor beam
(velocity servo — stable at any mass, weight reads visually). Springy flower
stems on spring joints, salvage batteries, targeting reticle with
anchor/liftable states.
**Question:** is *interacting* with the yard as fun as flying through it?
**Status:** mechanics verified in-engine; awaiting feel feedback.

### M2 — One Human + Exposure ✅ BUILT
A 100-unit human patrols the yard with three perception gates (range, split
yaw/pitch FOV, line of sight) plus **grass concealment** — fly below the grass
line and you're invisible unless you're in his face. States: idle → suspicious
→ investigate → swat → recoil. A connecting swat flings the bee, drops your
cargo and spikes exposure. Exposure decays when unseen, so it's reversible.

**Emergent finding — altitude is the risk dial.** Head/chest height: he
connects nearly every swing. Low: he swings and misses (thrill, no damage).
In the grass: never seen. Height, visibility and danger turned out to be one
axis, teachable without a tutorial. This wasn't designed up front and is the
best thing to come out of M2.

### M2 — original brief
A single reactive NPC in the yard. They notice, investigate, swat, flee, and
raise a visible Exposure meter. Bug spray and a swatter as counterplay.
**Question:** does being noticed feel thrilling rather than punishing?
*This is the highest-risk unknown in the whole design — it comes early on purpose.*

### Control pass ✅ BUILT (between M2 and M3)
Done before adding gadget #3, because three is where a control scheme stops
being a list and becomes a system — and the ladder names ~10 gadgets.

**Innate vs tech.** Flight, wing overdrive and the **stinger** are the bee's
*body*; everything else is tech in a belt, reached by a radial. Canon basis:
the OG doc's "stinger grappling cable" — anatomy is permanent, tech bolts onto
it. This also means nothing is welded to a button forever.

**The radial switches, one button uses.** Holding it drops time to 25% rather
than pausing, so it never interrupts a chase.

**No slot cap yet, deliberately.** Belt is uncapped until we know what the
gadgets do; capping later is a filter (researched vs. worn), not a rewrite.

**Grapple and tractor beam were one verb wearing two hats.** Split hard:
Grappling Cable = traversal (heavy/static only, moves *you*, lifts nothing);
Tractor Beam = manipulation (light only, never moves you). One threshold
divides them so they can never both claim an object.

### M3 — Hack + Chain Reactions ✅ BUILT
**Hacker Antenna** (third tech): hold on an appliance to flip its one verb.
Holding rather than tapping means hacking in the open costs you exposure.

Three appliances, one verb each: **sprinkler** (water — wets ground, spreads a
puddle), **bug zapper** (electricity — arcs, hazard radius), **box fan** (moving
air — the first atmosphere zone).

**The chain nobody scripted:** water reaching a live zapper electrifies the
puddle, hazard radius 16 → 38. Neither object knows about the other — the
sprinkler publishes a wet radius, the zapper asks whether it's standing in one.

**Atmosphere shipped as a field**, per the note above: damping is sampled at
the bee's position, so the fan's blast is thin air (2.6 → 1.05) plus a shove.
Every future zone is now content, not engineering.

**Humans react to evidence**, not just to the bee: an appliance running by
itself in view drives exposure independently of whether you were seen.

**Question answered?** Chains happen and compound. Whether they're *funny*
needs playtesting, not measurement.

### M3 — original brief
Three hackable objects with overlapping effects: sprinkler (water), bug
zapper (electricity), box fan (wind/force). Water + electricity must
interact. Add the Human Threat Database beat where the human reacts to
*evidence* rather than to the bee directly.
**Question:** do unscripted chains actually happen, and are they funny?

### M4 — Swarm + Reverse Engineering ✅ BUILT
**Hive** at the fence line — visible to humans, reachable only by bees. Fly
salvage into the glowing mouth to bank it.

**Salvage**: batteries and circuit boards scattered in the yard, carried by the
tractor beam or by swarm bees.

**Research** auto-unlocks on total delivered: 3 → Swarm Beacon, 7 → a second
bee, 12 → Overdrive Mk II. Deliberately not a spend-menu; the fantasy is
reverse-engineering, not shopping.

**Swarm**: throw a beacon, bees converge, then each picks a job from context —
haul nearby salvage home, or mob the human. Mobbing cuts his sight range to
45%, so the beacon is a real tool. No command camera, per the pillar.

**Question answered?** The loop closes: steal → bank → unlock → new capability.
Whether it's *motivating* over hours needs content, not more systems.

### M4 — original brief
Recruit 2–3 bees with simple jobs (distract, lift, harvest). Salvage parts
from hacked objects, carry them home, spend them on a small research tree
that unlocks the next gadget.
**Question:** does the loop close — does stealing tech feel like progress?

**M1–M4 completed = the full seven-verb chain is playable.** That is the real
vertical slice, and the point where this becomes pitchable.

### M5 — The property, quests, and the hive workshop ✅ BUILT

M4 proved the loop. M5 gave it somewhere to happen and a reason to happen in
an order.

**The property is enclosed.** The yard was a lit disc fading into fog with one
fence, which read as "a small patch of land in a void" — and let the human punt
salvage into nowhere it could never be recovered from. It is now a real
property with four different edges, each doing a different job:

| Edge | Job |
|---|---|
| Back fence | The hive lives in it. The original scale cue. |
| Side fences | Containment, and grapple walls |
| The house | A 210-unit wall dwarfing the 100-unit human, with a deck you can fly *under* — the first interior-ish space |
| The shed | A solid landmark that blocks line of sight; the doc's late-game dungeon, from the outside |

Plus the things that make it somebody's yard rather than a field: flowerbeds
(where the flowers are now *planted*, not scattered), a mown lawn with mower
stripes, a stone path, a kiddie pool, a bird bath, a coiled hose, a
wheelbarrow, terracotta pots, a bin, one climbable tree — and a neighbourhood
beyond the fence, so flying over the top is rewarded with a view instead of
grey.

**Nothing can be lost.** Fence colliders catch almost everything; every prop
also remembers where it started and comes home if it leaves the property.
A collect quest can never become uncompletable because the human kicked a
battery over the fence.

**Quests are the framing device, not the content.** Per the pillar, missions
frame and punchline; the sandbox generates the comedy. So the quest log is
deliberately thin — it names a thing and points at where, and never scripts
how. Every objective type is satisfied by systems that already existed and
didn't know about each other: deliver a specific piece of salvage, reach a
place, flip an appliance, cause a chain, build something. The log just
notices. One quest active at a time; a list of six open objectives is a
checklist screen, and that's what this game is least trying to be.

Four surfaces, each answering one question: the **card** pitches it, the
**tracker** remembers it, the **toast** confirms each step, the **banner** pays
it off — plus a **waypoint** that pins to the screen edge when the target is
behind you. The waypoint isn't decoration: the yard got roughly four times
bigger this milestone, and a collect quest in a world you can get lost in is a
chore without one.

**Anything you did before being asked still counts.** Found by testing, not by
looking: haul three batteries home during the gap between quests and they're
consumed before the objective exists — with five batteries in the yard and a
quest asking for three, that's a softlock you'd hit *by playing well*.
Unmatched events now go to a backlog the next quest drains as it opens, so a
quest you accidentally half-finished opens reading 2/3.

**The shop is a place, not a menu.** M4 said no spend-menu, deliberately: an
economy is not the fantasy, reverse-engineering is. That reasoning holds for a
*menu*. It does not hold for a *place*. The **Hive Workshop** only opens at the
hive mouth, with the bee hovering in front of it, in the middle of the world
where the human can still walk up — and time slows to 25% rather than stopping,
exactly like the tech radial. You are never lifted out of the body, which is
the actual pillar.

That splits progression cleanly in two:

- **Quests decide what is available.** A blueprint is knowledge, and knowledge
  comes from doing something in the yard.
- **The shop decides what gets built.** Salvage is finite, so wearing one thing
  means not wearing another.

Seven blueprints — Swarm Beacon, Cargo Harness, Long-Line Filament, Drone
Wingman, Pollen Cloak, Antenna Mk II, Overdrive Mk II. Total catalog cost is
tuned just under what a *thorough* run collects: a careless run cannot afford
everything. Running out is the design, not a shortfall.

**Bugs the screenshots hid, again.** The FPS readout was computed from the
*clamped* frame time, so it reported a comfortable 20 while the page ran at one
frame a second. The shadow camera was sized to the yard's footprint rather than
its bounding sphere, so the 210-unit house fell outside the frustum and the
shadow map's clamped edge smeared its shadow across half the lawn — the whole
property rendered in permanent dusk, and it read as art direction rather than
as the bug it was. The kiddie pool's collider was a solid six-unit disc, so
props rested on invisible air above the water and the bee couldn't get in at
all. The hive had no collider whatsoever, so the camera slid inside it and the
human could see straight through it — invisible until the workshop made you
hover there on purpose.

**Question answered?** The loop now has a shape: somewhere to be, an order to
do it in, and a choice about what to spend. Whether that shape holds attention
for an hour is still a content-and-art question, not a systems one.

### M6 — The yard was the wrong size ✅ BUILT

M5 enclosed the property. It did not check how big it was.

**The measurement.** The human is 100 units for 1.7 m, so one unit is 1.7 cm.
The yard was 144 × 128 units — **2.4 × 2.2 m**. A patio. At `maxSpeed` 60 you
crossed the entire world in 2.4 seconds, and half a second on overdrive. That
is the whole "it doesn't feel open" report, and it is not an art problem: no
amount of texture makes a world two seconds wide feel like somewhere.

Worth stating as a rule, because it was missed for six milestones: **the yard
is the only thing in this build with no reference object.** The bee, the human,
the batteries and the grass blades were all authored against something real and
were all roughly correct. The ground plan was authored against the camera.

**The fix.** `property.ts` is now written in metres against one constant
(`M = 100 / 1.7`), and the human did not move — he is the ruler. The yard is
**10.0 × 8.7 m**: about ten seconds to cross at cruise, two on overdrive, and
eleven seconds for the human to walk end to end. His 210-unit sight range now
covers 36% of the width rather than all of it, which turns "get out of his
line of sight" from a fiction into a thing you can actually do.

**Volume, not just area** — because a bigger flat lawn is only more of the same
two-second feeling. Six layers went in with the resize:

| Layer | What it is at bee scale |
|---|---|
| Under the deck | A 0.55 m room — thirty bee-heights of ceiling — that a human cannot reach into |
| Under the shed | A crawl gap on concrete blocks |
| The gutter | An open-topped channel along the house you fly *inside*, with a hollow downspout back down |
| The hedge | Solid low, open on top — a wall you can go over but not see through |
| The tree | 6.2 m, with branches to perch on and a canopy with room inside it |
| The woodpile | Stacked logs with gaps you can get into |

Each one is verified by shape-casting in the test suite rather than by
screenshot, because "is it hollow" is exactly the kind of thing a screenshot
cannot answer.

**Grass had to be rebuilt.** The lawn went from 11k units² to 207k, and holding
the density that actually looks like grass would need ~1.7 million blades. The
field now **follows the bee**: a window of tiles rides along, addressed
toroidally so crossing a boundary refills one row rather than the whole field,
and seeded from world tile coordinates so the same patch of lawn grows the same
grass every time you fly back over it. Three altitude LODs widen the window as
you climb — by then each blade is a couple of pixels — and the ground plane
under it is painted the average blade colour so the window's edge never reads
as a circle of mown lawn following you around.

**Shadows follow too.** A frustum enclosing a 10 m yard plus a 6 m house needs
a ~440-unit radius, which is four texels per unit; the bee's own shadow turned
to mush. A tight frustum tracking the bee gives fifteen, snapped to a grid so
the map doesn't crawl a texel at a time and shimmer every edge in the yard.

**Two scale bugs the suite caught.** The quest arrival radius was still 18
units — 0.3 m, which is smaller than the hive — so "fly to the hive" could not
be completed by arriving at it. And the test's own delivery used hard-coded
mouth offsets rather than asking the hive where its mouth was, which is the
same class of mistake at one level up.

**Question answered?** The world is the size the flight model always assumed.
Whether ten metres is the *right* ten metres — enough to explore, not so much
that it's empty — is the next playtest, and the honest reason the art pass is
still after this rather than before it.

---

## The estate question, and why it's a greybox

Asked 2026-08-22, before designing the house: *have we hit the limits of this
engine, and should we port before building something estate-sized?*

**Measured rather than argued.** `renderer.info` across four vantage points in
the finished backyard:

| | Now | Rough ceiling | Used |
|---|---|---|---|
| Draw calls | 65–147 | ~1000–2000 before CPU-bound | ~10% |
| Triangles | ~920k | 2–5M on desktop | ~20–30% |
| Colliders / bodies | 225 / 130 | thousands in Rapier | ~5% |
| Textures | **1** | usually the first web ceiling | ~0% |
| JS heap | 35 MB | — | nothing |

Extrapolated to a 40 × 30 m estate — **13.8× the area** — the two expensive
problems are already solved: the grass field follows the bee, so it costs the
same on an estate as in a yard, and the shadow frustum does too. Static
geometry scales with *content*, not area: call it 400–900 draw calls in the
densest views and ~1.5M triangles, still inside budget. The genuine runtime
risks are per-object frustum culling of ~10k meshes (1–2 ms/frame, fixable by
merging) and startup build time needing to be chunked. Both are known problems
with known fixes.

**So the answer is: no engine reason to port.** What would actually be wasted
is not capacity, it's **authoring**. Every object in `property.ts` is
hand-written TypeScript geometry, and that is precisely the work that does not
survive a port — you rebuild it in an editor with real assets. Systems, tuned
numbers and design decisions transfer. Hand-placed geometry does not.

**Hence the greybox.** `src/world/estateBlockout.ts` is a plain data table —
54 zones in metres, with a note on each saying what it's *for* at bee scale.
Nothing in it knows about Three.js. `estate.html` turns it into flat grey
volumes with human figures for scale, a metre grid and floating zone names;
a level designer would turn the same table into a level. **The table is the
artefact that ports.**

### The blockout

40 × 30 m of grounds, 50 m corner to corner. One property, per the scope doc —
just a much larger one, and a *holiday* one, which matters for more than size:
"repopulate — same house, new tenants" is already named as the cheapest growth
axis, and people who don't live somewhere don't know what's normal in its
garden. That is a better fit for the exposure system than a family who would
notice everything.

| Zone | What it is at bee scale |
|---|---|
| The house, 18 × 9 m, two storeys | 8 m of wall; an 18 m gutter run you fly inside |
| Swimming pool + terrace | 10 m of open water; a 15 cm terrace lip is a cliff |
| Garage, door left open | A real interior with a car in it |
| Greenhouse | Glass, hot, still air — the atmosphere zone the design doc wanted |
| Sport court, fenced | A cage with an open top |
| Orchard, 12 trees | Canopy flying with regular gaps |
| Formal garden | A hedge grid: ankle-height maze, bee-height canyon |
| Summer house | The folly the property is named for |
| Potting shed, compost | The dense-loot rooms |

### The number that decides it

At the current flight model the estate is **39 s across at cruise and 7.8 s on
overdrive**; corner to corner, **49 s and 9.8 s**. The backyard is 9.8 s and
2.0 s. Those are printed on the greybox HUD, because "is this the right size"
is a question about seconds, not square metres, and it can only be answered by
flying it.

**Resolved 2026-08-22:** 40 × 30 read as too small, and the blockout is now
**90 × 120 m** — the gated estate from the reference aerials. But the size
question turned out to be downstream of a worse one.

### The bee flew slower than the human walked

| | Playtested (default) | Retuned (preset) | Real honeybee |
|---|---|---|---|
| Cruise | **0.78 m/s** | 3.35 m/s | 4–5.5 m/s foraging |
| Overdrive | 3.83 m/s | 8.75 m/s | ~8 m/s max |
| vs. the human's walk | **0.84×** | 2.40× | — |
| Grapple line | 2.0 m | 6.8 m | — |

Measured in-engine, not computed. An earlier pass quoted cruise as 1.02 m/s by
reading `maxSpeed` — but thrust is a force against damping, so the speed
actually reached is `accel / damping`, and `maxSpeed` is a higher ceiling that
only governs borrowed speed bleeding off. Same mistake the greybox HUD made.
The real figure is worse than reported: the bee was **slower than the human
walked**.

**But speed is not feel, and the retune shipped as the default was a method
error.** Changing the bee and the world in the same build makes neither
judgeable — you cannot tell which one you are reacting to. The playtested set
is the default again, and the faster configuration is a **preset**: two
complete, coherent sets in `BEE_PRESETS`, each covering flight, camera lead and
every reach measured in world units, flipped from the tuning panel or with
1 / 2 in the blockout. You get one honest configuration or the other, never a
hybrid nobody designed.

The blockout carries a tuning panel of its own now (world-only folders hidden)
and loads the same saved settings as the game, so a bee dialled in one place
is the bee you fly in the other.

### The estate, and why it has a spine

90 × 120 m, 150 m corner to corner. On the **retuned** preset that is 26.5 s
across at cruise and 8.8 s on overdrive — 44 s and 14.7 s corner to corner. On
the **playtested** preset the same property is 3 minutes at cruise. Which of
those is right is a feel question, and the presets exist so it can be answered
by flying rather than by arithmetic.

The structural lesson from the 40 × 30 attempt: it was all rooms and no
corridor. The references have a **spine** — gate, 80 m of straight driveway,
motor court, house — and at bee scale that drive is the one place on the
property you can hold overdrive in a line and feel fast. Lined with landscape
lighting, straight off the aerials, it reads as a lit avenue.

Three buildings, per the references: **main house** (34 × 20 m, 9 m to the
eaves, 34 m gutter run, attached three-bay garage), **guest house**, and an
open-sided **cabana**. Three interiors, three sets of habits — and the guest
house makes "repopulate: same house, new tenants" structural rather than
aspirational.

Everything else is **garden rooms**, which is the answer to emptiness: motor
court, parterre, pool terrace, kitchen garden, service yard, fire pit,
playground, orchard, woodland edge. Each enclosed by hedge, wall or level
change; each its own place with its own ceiling and sightlines. Ten metres of
hedge is a canyon at this scale. 139 zones.

**Open:** content density. 10,800 m² wants on the order of 150 points of
interest before it stops being a lawn, and one human on 2.7 acres is scenery
rather than a threat — estate scale forces the family the design already
called for, and real pathfinding with it.

---

### M7 — Feel & look ✅ BUILT

From the playtest, and it is the most useful sentence anyone has said about
this build: *"flying lower to the ground gave a better sense of speed."*

That is not a quirk, it is the mechanism. **You cannot perceive your own
velocity directly — you perceive things streaming past you.** Low over the
lawn, grass blades supply that reference frame. At altitude nothing is close
enough, so the same 8 m/s reads as hanging still. Which also explains why the
retuned bee felt wrong in the blockout: a greybox has almost nothing near you
to stream past.

**Pollen motes.** A field of ~900 motes in a box that rides with the bee,
wrapping toroidally so it is effectively infinite. They sit still in WORLD
space — the important part, because they stream past because you move, not
because they do. Each draws as a line from where it is to where it was, so it
is a dot when you hover and a streak when you fly. That one trick does most of
the work, and it works at any altitude.

**Speed FX.** Field of view widens by up to 14°, the camera eases 22% further
back, and a vignette closes in — all eased rather than driven straight off
velocity, because the ugly version snaps every time you tap the stick. All
three normalise against the *current preset's* top speed, so they mean the
same thing whichever bee you fly.

**Sound, synthesised, no asset files.** The wingbeat is two detuned sawtooths
through a lowpass; the buzz you recognise is the beating between them, not
either tone. Pitch and brightness both climb with speed, and slide rather than
step — the difference between a bee and a modem. Impacts are filtered noise
bursts: grapple fire and thunk, sting, prop hit, swat whoosh, zap, deposit,
unlock. The context starts on the same click that takes pointer lock, so the
autoplay policy costs the player nothing.

**Cel shading.** `MeshToonMaterial` with a three-band gradient map across every
opaque material, cached by colour so 726 meshes collapse onto a couple of dozen
materials — fewer state changes, not more. Plus a screen-space depth-Sobel
outline pass: one extra pass, independent of scene complexity, catching
silhouettes and creases.

**Two look bugs worth recording**, both found by looking at the first render:
- The gradient's darkest band landed near 0.44 and crushed every surface facing
  away from the sun into mud. A yard in permanent dusk, for the second time
  this project. Bands are explicit now: 0.62 / 0.82 / 1.0.
- The outline pass fired on **every individual grass blade**. Ninety thousand
  blades are ninety thousand depth discontinuities, which is precisely what a
  Sobel is built to find, and the lawn turned into a dark smear. Thresholds
  raised to catch object silhouettes, and outlines now default **off in the
  yard and on in the blockout** — where there is no grass to confuse them, and
  where the clean look came from in the first place.

Everything is exposed in a **Feel & look** panel folder: mote count, radius,
streak length and opacity; FOV kick, dolly, vignette and where it starts; toon
and outline toggles with strength and width.

**Outlines, done properly (2026-08-23).** Raising the Sobel threshold had only
traded one wrong answer for another: no grass noise, but no fine silhouettes
either. The real fix is to detect edges in a scene that *has no grass in it*,
then re-introduce grass purely as an occluder:

1. render the frame normally — colour, and depth of everything;
2. render a **depth-only** pass with the noisy objects hidden;
3. Sobel the second buffer to find real silhouettes;
4. per pixel, if the full depth is meaningfully nearer than the grass-free
   depth, something excluded is standing in front — suppress the line.

So a fence outline is correctly hidden *behind* the blades in front of it
rather than drawing over them. Cost is one extra depth-only pass over the
non-grass scene, a few hundred draw calls of a flat material — and the grass,
the expensive part, is exactly what it skips. Outlines are on everywhere now.

**One bug the fix exposed:** rendering through a render target skips the
renderer's output colour-space conversion, which only happens on the way to the
default framebuffer. Blitting the target back naively left the whole frame in
linear space — everything dark and oversaturated, which looked like a lighting
regression and was a plumbing one. The composite shader converts by hand.

---

### M8 — The household ✅ BUILT

**Goal:** stop exposure being a stealth cone. One human made "don't be seen" a
meter; four make it a social problem, which is the joke the whole game is
built on. The bee isn't hiding from a camera. It's hiding from a family that
cannot agree on what it just saw.

Four people share the yard. The state machine is identical for all of them —
`HumanProfile` (`src/world/human.ts`) is a set of multipliers over
`params.human`, so the tuning panel still moves the whole household at once
and a profile only ever says "more than the others" or "less".

| | sees | pace | fuse | swats | suspicion | dampen | curiosity |
|---|---|---|---|---|---|---|---|
| **Dale** the handy one | 1.15× | 1.0× | 1.0× | yes | **+1.0** | — | **1.9×** |
| **Marla** the short fuse | 1.0× | 1.25× | **1.8×** | yes | **+1.7** | — | 1.0× |
| **Robin** the kid (0.62 height) | **1.3×** | 1.15× | 0.6× | **no** | **−1.2** | — | 0.7× |
| **Ned** the skeptic | 0.7× | 0.55× | 0.5× | yes | +0.3 | **0.4×** | 0.35× |

**The arithmetic.** Every frame the household reports who can see the bee.
Exposure's rise is now the *signed sum* of their suspicion, and a positive sum
is then multiplied by the smallest `dampen` among the watchers:

```
rate = base * Σ suspicion            // base = riseSeen, or riseTech if using tech
value += (rate > 0 ? rate * min(dampen) : rate) * dt
```

Three consequences fall straight out of that and none of them needed special
cases:

- **Being seen by Robin alone LOWERS exposure.** The kid has found the coolest
  thing alive and is covering for it. Measured at −8.4/s against a lone
  human's +7.0/s.
- **Robin runs cover for you.** Marla alone raises at +11.9/s; Marla *and*
  Robin watching is +3.5/s — the kid takes 70% off the accusation.
- **Ned talks a rise down but can't turn one into an alibi.** `dampen` applies
  to positive rates only, so the skeptic can slow Marla to +4.76/s and can
  never make being watched *good* for you.

**Behaviour that isn't a number.** Robin's profile sets `swats: false` — a
child who has found a bee with a laser on its back *chases* it. That's a
different kind of pressure: harmless, relentless, and impossible to lose in
the grass. Evidence works the same way: an appliance running by itself costs
you `evidenceRise × the curiosity of whoever is looking that way`, and only
the most curious witness walks over to investigate — a household that all
converges on one toaster leaves the rest of the yard unwatched, which would
make hacking strictly better than not hacking.

**Reading it.** The exposure HUD names its watchers, ▲ red for the ones
raising it, ▼ green for Robin, grey for Ned. The rules themselves are called
out once each, the first time the player is actually standing in one
("Robin has seen you — and is saying nothing"), and then never again.

**Things that had to change to support four bodies:**
- Distraction is positional. `swarm.distracting` used to be a global boolean;
  mobbing Marla should not blind Dale on the far side of the lawn, or one
  beacon switches off the whole household.
- The stinger takes a *list* of body handles and reports which one it hit, so
  a sting flinches the person who was actually stung.
- People have personal space (scaled by height) and are pushed apart after
  every update. They all chase the same bee, so without it they converge to a
  point and read as one flickering person with eight arms.
- Idle patrol is per-person: each profile owns a fraction of the walkable
  rect, so the shed end, the deck and the open lawn each have someone in them
  instead of four people orbiting the middle.

### The draw-call number was wrong, and why

M7's outline pass renders three times per frame. `renderer.info` resets on
every `render()` call, so the budget probe — which read it *after* the frame —
had been reporting the composite fullscreen quad ever since: **1 draw call, 2
triangles.** It looked like a world that cost nothing.

Accumulating across the whole frame instead (`info.autoReset = false`), the
honest number in the yard is **768 draw calls and ~1.9M triangles**, not the
65–147 recorded at M6. Split by pass, at the low back corner:

| pass | calls |
|---|---|
| scene | 282 |
| shadow map | ~208 |
| outline depth-only | 277 |
| composite | 1 |

**One real bug this exposed.** three.js rebuilds the shadow map on *every*
`render()`, including the depth-only outline pass, which cannot show a shadow
at all — the frame was rendering the shadow map twice, for 194 wasted draw
calls. Setting `shadowMap.autoUpdate = false` around that pass took the frame
from 962 to 768 calls. The lesson is the same one as the FPS readout in M5:
**a probe that reads the wrong thing is worse than no probe**, because it
reports comfort.

Where this leaves the budget: 768 calls and 1.9M triangles is a comfortable
desktop frame and a moderate laptop-iGPU one. It is not the free ride the old
number implied, and the grass is most of the triangles — so the estate's
detail budget should be spent on *geometry that isn't grass*.

---

### M9 — The estate is the world ✅ BUILT

*"All of this is supposed to be on the estate build. We aren't doing the small
house."*

So the 10 x 8.7 m backyard is gone — `property.ts` is deleted, not deprecated —
and the game now runs on the 90 x 120 m estate the blockout described. That is
**124x the area**, and almost none of the work was rendering it.

**The blockout became the world, and stayed the source of truth.**
`estateBlockout.ts` is untouched as data; `estateWorld.ts` turns its 139 zones
into geometry and colliders. Nothing in the game types in a coordinate any
more — the walkable region, the walls a person routes around, the bare patches
under the grass, and every salvage site are all *derived from the zone table*.
Moving a terrace in the plan moves the bare patch under it. The M5 bug where
the deck was missing from `WALK_BLOCKERS` is now structurally impossible.

Zones become the right kind of solid:
- `hollow` buildings get a shell — four walls, a roof, one doorway you can fly
  through. A building the bee cannot enter is scenery, and "volume, not area"
  dies with it.
- The greenhouse's roof is vented; the garage's is not.
- Tree canopies have **no collider** — flying up into the leaves is the best
  cover on the property, and a collider there makes it a wall you bounce off.
  Trunks are solid.
- Roofs are hipped frusta with convex-hull colliders, so the eaves aren't
  invisible solid air.
- The pool is a floor and a rim, never a solid disc.

**Where everything went, and why it matters.** The hive is in a hollow of the
west gate pillar — the bees live in the front gate. Salvage is placed where
that kind of salvage would actually end up, and the four sites sit at four
different distances from home:

| | where | who guards it |
|---|---|---|
| bottle caps | the fire pit, 30 m from the gate | **Ned**, the skeptic |
| wood screws | under the playground | **Robin**, the kid |
| batteries | the service yard, 80 m up the drive | **Dale**, the handy one |
| circuit boards | the potting shed | (the far corner) |
| the appliances | the pool terrace | **Marla**, the short fuse |

That is the M8 household and the M9 map doing one job. Each errand the hive
gives you is an errand into somebody's patch, and *whose* decides what it
costs: the first salvage a new bee reaches is guarded by the one person least
inclined to believe his own eyes, and the playground is guarded by the one
person who is pleased to see you.

The quest chain is re-ordered to walk you up the property — gate → fire pit →
playground → service yard → potting shed → pool terrace — and delivery
waypoints now point at the **source** until the first one is banked, then turn
round and point home. On 10,800 m2, "deliver 4 boards" is not a task until you
know where boards live.

**Perception did not scale, on purpose.** A person still only sees 7 m — 8% of
the property's width. Danger is not an ambient field here; it is four small
moving bubbles parked on top of the four places worth going.

**The bee had to change, and this time it is the default.** The estate preset
(cruise 3.4 m/s, overdrive 10.2) is what ships; the backyard set survives as
the A/B, because the comparison is the whole point of having presets. At
default cruise the 90 m width takes 26.5 s. The saved-settings key is bumped
to v4 — a v3 file holds backyard numbers, and silently applying them over the
estate would look like the new world was simply tuned badly.

**Draw calls: 4,078 → 1,346.** The first honest build of the estate cost 5x
the yard, and none of it was necessary:
- The blockout is ~1,400 boxes once windows, hedges, canopies, path lights and
  gate bars are counted, and **not one of them ever moves**. Merged by
  material, that is about a dozen meshes. (Everything is converted to
  non-indexed first — `BoxGeometry` is indexed and `IcosahedronGeometry` is
  not, and `mergeGeometries` refuses a mixed bucket.)
- Every flower built its own petal material and eight petal meshes. Seventy-four
  flowers were 74 materials and 592 draw calls describing objects whose petals
  never move relative to each other. Five shared materials and one merged
  corolla: 74 draw calls.

Triangles are ~2.0M, and grass is ~95% of that — which is the useful number
for the next art pass: **spend the estate's detail budget on geometry that
isn't grass.**

**One bug the colliders exposed.** The gutter run hung at y 9, level with the
eaves — which is *inside* the roof, whose 1 m overhang starts at z 37. In a
greybox with no colliders that is invisible. The moment the estate became
solid it was a 34 m channel you could not enter. A real gutter hangs below the
roof edge; so does this one now. Same lesson as the FPS readout and the
draw-call probe: **the thing you never measured is the thing that is wrong.**

---

### Playtest tune, 2026-08-24 — pollen

*"Pollen motes looked excessive on default, felt like speed lines as the bee
flew."*

The diagnosis is in the word **lines**. Optical flow is supposed to read as
specks going past you; at 900 motes with a streak three times this long it
stopped being a reference frame and became a radial blur effect drawn on top
of the world — a cartoon zoom, not a sense of speed.

Adopted from the playtested file: count 900 → **120**, box radius 90 → **41**
units, streakPerSpeed 0.055 → **0.017**, opacity 0.5 → **0.42**. `maxStreak`
stays at 26 but is now unreachable — at this rate, overdrive terminal (600
u/s) makes a 10-unit streak — so it is a ceiling for anyone who dials the rate
back up, not something that bites.

Grass density came back 0.58 → **0.46**, the first value set on real hardware
rather than guessed against software rendering. Measured: **2.03M → 1.66M
triangles per frame**, an 18% cut, with draw calls unchanged at 1,334.

The seed in the file was left alone. It came back reshuffled, but a reshuffle
is a dice roll rather than a decision, and baking somebody's last roll makes
the world arbitrary in a way nobody chose.

**Not chased further.** Pollen wants a proper visual pass eventually — at this
box radius there is very little of it left at altitude, which is the exact
case it was built for. That is a known trade, deliberately parked.

---

### The shell — it stops being a sandbox ✅ BUILT

*"It's time to make this feel like more of a game than a sandbox."*

M0–M9 built a simulation you load into and never leave. No moment where the
game starts, no way to stop that isn't alt-tab, nothing that survives a
refresh, and no way out of a wedged bee except losing the run. Full plan in
[SHELL_PLAN.md](SHELL_PLAN.md); it is two passes, invisible then visible.

**The one rule: the shell routes input and scales time, and never edits the
sim.** Flight, camera, exposure arithmetic, quest content and the household are
read, never written. That leaves two levers and both already existed — the
`simDt` multiplier the radial and workshop use for slow-mo, and the input line
the workshop already feeds `NEUTRAL_INPUT`.

**Pause is that first lever at zero**, not `cancelAnimationFrame`: rendering
continues so the world stays visible behind the menu, but the accumulator
stops, so nothing integrates and resuming cannot produce a catch-up spike.
Frozen means frozen — `dt` itself is zero while paused, because the
household's walk, the appliances, the stinger cooldown and the exposure meter
all read `dt` directly and a pause that stops only physics is not a pause. Esc,
Start on a pad (newly mapped), and **losing the window**: alt-tabbing out of a
game where somebody is walking toward you and coming back to a raised meter is
the build taking something while you weren't looking.

**Rescue** is hold X, or Back on a pad, for 1.2 s with a fill ring. A hold
rather than a tap because the 80 m drive only means something if flying it is
the only way to be at the other end of it. It does **not** reset exposure —
rescue is for geometry, not consequences.

**Progress** persists under `bees-progress-v1`, kept separate from the dev
tuning store: one is a designer's tuning file, the other is a player's save.
Quest position, blueprints, salvage, exposure, belt slot, taught lines — and
deliberately *not* prop or household positions, which would break the format
every time the yard changed for a fidelity nobody asked for. Built blueprints
restore by **replaying `build()`**, since upgrades are multiplicative over the
shipped defaults (M5), so a replay from a fresh page is exact and it is the
only way belt items and recruited bees come back. Version mismatch discards and
never migrates.

**The title screen's background is the actual game** — a live camera drifting
the gate → drive → house spine. The estate's best argument is that it is big,
and a slow push up 80 m of driveway makes that argument with geometry that
already exists. Play takes pointer lock and starts audio in one click, because
spending two clicks on one intention is a tax.

**The tuning panel moved behind `?dev`** (or backtick). It is a development
tool that was sitting on top of the game; the four things a player should
actually be able to change — volume, sensitivity, invert Y, reduced motion —
moved into Settings. Reduced motion needs a *flag* rather than only the media
query, because the FOV kick and camera dolly are JavaScript and
`prefers-reduced-motion` cannot reach a projection matrix.

**Three bugs the tests caught, all of them the same shape — something firing
at the wrong moment:**

1. **Reaching the title wrote an empty save.** `onChange` flushed on every
   transition, and boot passes through `title`, so `Continue` was live on a run
   that did not exist. A save is worth writing when you stop *playing*, not
   when you arrive at a menu.
2. **New Game reloaded you back to the title you just left.** It reloads for a
   clean world; it now carries a session flag across the reload so it lands in
   the game.
3. **The menu cursor carried across screens.** Opening Settings put you on
   whichever row index the last screen left behind, so A/D adjusted a setting
   nobody was looking at.

Verified 26/26 in a shell suite and 16/16 in a pass-1 suite — including that
pause drifts *nothing* (person, bee and meter all exactly zero over ten
frames), that a mid-chain refresh restores quest position, salvage, blueprints,
belt, exposure and taught lines exactly, that stale/corrupt/moved-chain blobs
are discarded silently, and that every menu is drivable by synthetic pad edges
alone. Gameplay suite still 50/50.

---

## Deliberately deferred

- **Neighborhood & town** — real new geography. Far cheaper once one house
  exists, which is the argument for making the first property deep.
- **Roomba/vehicle piloting** — depends on hacking being proven first (M3).
- **Combat depth** — wasps arrive as a *threat*, not a combat system, until
  the sandbox works. Systemic over combo-heavy, per the reference doc.
- **Collectibles, minigames, customization, multiplayer** — content
  multipliers. They multiply zero if the simulation isn't fun.
- **Full hive construction sim** — the hive should *visibly upgrade* as a
  reward, not become a second game with build queues (see pillar: no RTS).

---

## Worth its own thing: the flight sandbox

Noted 2026-08-22, playing M5. Flight over an open physics world is carrying
more weight than the game needs it to. Stripped of the bee, the hive and the
exposure meter, what's left — momentum flight with a grapple, a tractor beam
and a yard full of loose objects — is *already* a toy people would mess with.

That is a real asset and it should not be spent by accident. Two ways to use
it, and they are not the same product:

1. **Keep it as this game's traversal.** The escalation ladder is what makes
   the flight mean something; without it the sandbox is a tech demo you get
   bored of in twenty minutes. This is the default and nothing changes.
2. **Fork it later as a smaller, separate thing.** The flight controller, the
   camera, the atmosphere field and the grapple/tractor split are already
   independent of the bee fiction — they'd carry a different scale, a
   different body, a different world with almost no rework. That's an option
   worth *keeping open*, not one worth taking now: this build's job is still
   to prove the escalation loop, and splitting focus before it's proven is how
   you get two half-games.

Concretely, the only thing to do about it right now is to keep the flight
stack clean of bee-specific assumptions, which it currently is.

## Open risks

1. **The humans are the hard part, not the physics.** Four who disagree now
   exist (M8) and the *social* arithmetic works. What does not yet exist is
   navigation: they route around the yard with rect-and-circle ejection, which
   is fine for 87 m² of lawn and will not survive a furnished house. Real
   pathfinding is the price of opening the interior.
2. **Interiors are a real cost, not a free layer.** Opening the house means new
   navigation, occlusion, lighting and art. In scope because the humans are
   worth it, but budget it honestly rather than treating it as "more rooms."
3. **Web ceiling.** M0 runs fine, but NPCs + hackable systems + swarm AI +
   persistence will push it. The plan is to prove the loop in web, then port
   to a native engine for the commercial build (per the OG doc).
4. **Persistence scope.** "Chaos compounds rather than resetting" is right,
   but full world simulation is a trap. Start with: knocked-over objects stay
   knocked over, salvaged parts stay gone, Exposure persists. Nothing more.
