# The Bees Have Tech! — Game Shell

**Status:** v1 — 2026-08-24
**Scope:** everything around the simulation. Nothing inside it.
**Reconstructed:** this file was referenced by `SHELL_BUILD_PROMPT.md` but was
not in the repository. It is written back from that prompt's spec, the pillars,
and the M5–M9 record, so the build has a plan on file rather than a prompt.

---

## Why a shell

M0–M9 built a simulation. You load a URL and you are a bee, mid-air, forever.
That is a *sandbox*: there is no moment where the game starts, no moment where
it stops, nothing that survives a refresh, and no way to step out of it without
closing the tab.

A game is the same simulation with a frame around it:

- somewhere to **arrive** before you are flying,
- a way to **stop** that isn't alt-tab,
- a way to **come back** to what you were doing,
- and a way to **get unstuck** without losing the run.

That is the whole of this document. It is deliberately not a feature list —
every item below exists because its absence is currently a way for the build to
waste somebody's time.

### The one rule

**The shell routes input and scales time. It does not touch the simulation.**

Flight, camera, exposure arithmetic, quest content and the household are read
and never edited. Every existing tuning number keeps its meaning. If a shell
feature can only work by changing how the bee flies, the feature is wrong.

The shell gets exactly two levers, and both already exist:

| lever | already used by | shell uses it for |
|---|---|---|
| `simDt` multiplier in the frame loop | radial + workshop slow-mo (×0.25) | pause (×0) |
| input routing before `flight.applyInput` | workshop feeds `NEUTRAL_INPUT` | menus |

### One visual language

The HUD already has one: honey-gold `#ffd75e` on `rgba(20, 24, 18, ·)`,
`ui-monospace`, 10–13px, 10px radius, hairline `rgba(255,255,255,0.16)`
borders. Every screen below uses that and nothing else. No framework, no web
font, no second aesthetic. A title screen that looks like a different product
than the HUD under it is worse than no title screen.

### Two devices, always

Every screen is fully drivable by **gamepad alone** and by **keyboard alone**.
The workshop's `menuDelta` pattern (edge-detected W/S + ArrowUp/Down + d-pad,
confirm on RB/E) already solves this; menus reuse it rather than inventing a
second convention. `prefers-reduced-motion` is respected by every animation
this plan adds.

---

## §1 — The state machine

Four states, in `src/shell/`:

```
boot ──▶ title ──▶ playing ⇄ paused
                      ▲          │
                      └──────────┘   (Resume)
                                 │
                      title ◀────┘   (Quit to title)
```

- **boot** — the world is being built. Physics, the estate, 325 colliders and
  a grass field are not free, and right now that time is a white screen.
- **title** — the world exists and is rendering, but the player is not in it.
- **playing** — the frame loop runs at full `simDt`.
- **paused** — the frame loop still *runs* (so the menu renders and the world
  is visible behind it) but `simDt` is 0.

The machine owns the transitions and publishes them; it does not own any DOM.
Screens subscribe. That split is what keeps Pass 1 invisible and testable:
the state machine is correct before anything is drawn.

**Pointer lock is a consequence of state, never a cause.** `playing` wants
lock, everything else releases it. The existing `Input` already tracks lock
and its own hint; the shell asks for lock on entering `playing` and lets the
browser refuse.

## §2 — Pause, and what "frozen" means

Pause is `simDt = 0`, not `cancelAnimationFrame`. The distinction matters:

- rendering continues, so the world is visible behind the menu — a paused game
  that shows a black rectangle has thrown away the one asset it has;
- the fixed-step accumulator stops advancing, so nothing integrates;
- no `physics.world.step()`, so nothing drifts, falls, or walks;
- resuming cannot produce a catch-up spike, because no time accumulated.

Pause is entered by **Esc**, by **Start** on a pad (needs mapping — the pad
currently has no Start), and by **losing the window** (`blur` / `visibilitychange`).
That last one is not a nicety: alt-tabbing out of a game where a human is
walking toward you and coming back to a raised exposure meter is the build
taking something from you while you were not looking.

Pause also has to hold the input line. While paused the bee gets
`NEUTRAL_INPUT` exactly as it does while the workshop is open, or a key held
across the pause boundary arrives as a shove on resume.

## §3 — Rescue, and progress that survives a refresh

### Hold to come home

A physics sandbox with 325 colliders, hollow buildings and a gutter you can
fly inside will eventually wedge a bee somewhere it cannot fly out of. Today
that costs the run.

**Hold X (keyboard) or Back/Select (pad) for 1.2 s** → the bee is returned to
the hive mouth, velocity zeroed, cargo dropped, grapple released.

- It is a *hold*, with a fill ring, because a tap-to-teleport is a fast-travel
  button and this property is meant to be crossed.
- Pad **X/Square is already `alt`**, so on a pad this is Back/Select. Keyboard
  X is free.
- **It does not reset exposure.** Rescue is for geometry, not for consequences.
  Teleporting away from a household that has just watched you steal a battery
  and having them forget is a cheat, and the meter is the game's spine.

### Progress persistence

New key, `bees-progress-v1`, separate from the dev tuning store
(`bht.settings.v4`). Two different things with two different lifetimes: one is
a designer's tuning file, the other is a player's save.

Saved: quest position (index, per-objective counts, and the backlog of work
done before it was asked for), known and built blueprints, banked and lifetime
salvage, exposure, the active belt slot, and which teach-once lines have fired.

Not saved: prop positions, household positions, appliance states, the bee's
position. A save that restores exactly where every pebble was is a save format
that breaks every time the yard changes, for a fidelity nobody asked for. The
world reshuffles; your *progress* is what persists.

**Order matters.** Load applies **after the world is built** and **before
`quests.begin()`** — the quest log has to be at the right position before it
offers anything, or a returning player is pitched quest 1 again.

**Built blueprints are restored by re-running `build(ctx)`**, not by storing
their effects. Blueprint upgrades are multiplicative over the shipped defaults
(M5), so replaying them from a fresh page is exact, and it is the only way the
belt items and recruited bees come back too.

**Version mismatch discards; it never migrates.** A prototype that ships a
migration path for a save format nobody has played is inventing work. A stale
or corrupt blob is dropped silently and the player gets a new game — which is
also what makes the format safe to change.

---

## §4 — Boot and title

### The boot screen costs zero JavaScript

Inlined in `index.html`, painted before any module arrives, then removed by the
shell. It reports the phase honestly — *starting physics*, *building the
estate*, *scattering the yard* — because a progress bar that lies is worse than
text that doesn't move.

### Title

Over a **live attract camera**: the real scene, drifting the gate → drive →
house spine. Not a still, not a video. The estate's best argument is that it is
big, and a slow push up 80 m of driveway makes that argument for free.

```
        THE BEES HAVE TECH!
   Scientists thought bees built hives.
     They actually built civilization.

        ▸ Continue          (only with a save)
          New Game
          Settings
          Controls
          Estate blockout
```

**Play takes pointer lock and starts audio in the same click.** WebAudio needs
a gesture and so does pointer lock; spending two clicks on one intention is a
tax nobody should pay. **New Game over an existing save asks once** — losing a
run to a mis-press is the one destructive thing a title screen can do.

The estate blockout link moves here from the in-game HUD corner. It is a
developer view; it does not belong on top of the game.

## §5 — Pause menu, settings, controls

Pause: **Resume · Settings · Controls · Quit to title**. The world stays
visible behind it, dimmed.

Settings are *player* settings, distinct from the dev tuning panel, and every
one of them is backed by something that already exists:

| setting | backed by |
|---|---|
| Master volume | `Sound.setVolume` (already there, previously unused) |
| Look sensitivity | `params.camera.sensitivity` |
| Invert Y | `params.camera.invertY` |
| Reduced motion | new flag; the JS speed FX read it |

Reduced motion needs a flag rather than only a media query because the FOV kick
and camera dolly are JS, not CSS — `prefers-reduced-motion` cannot reach them.
The flag defaults to whatever the media query says and stays overridable.

Controls is a static two-column reference, keyboard and pad, in the same
language as the in-game hint strip.

## §6 — Onboarding, and getting the dev panel off the screen

### Three lines, once each, ever

The game already teaches by doing. It needs exactly three things said out loud,
each fired once and remembered across a refresh (which is why taught lines are
in the save):

1. the hive is home, and salvage goes into its mouth,
2. the grass hides you,
3. hold X if you are stuck.

They reuse the quest HUD's existing toast — a second notification system for
three strings would be the definition of over-building.

### Tweakpane behind `?dev`

The tuning panel is a development tool sitting on top of the game. It moves
behind `?dev` in the URL (or backtick to summon), and everything a *player*
should be able to change moves into Settings. This is the change that most
makes the build read as a game rather than a demo, and it costs one condition.

---

## Deliberately not in this pass

- **No settings for anything in the sim.** Difficulty, exposure rates and
  flight feel stay in the dev panel. The moment a player can dial exposure
  down, the escalation ladder is optional, and the ladder is the game.
- **No save slots, no autosave indicator, no cloud.** One save, written on
  change, silent.
- **No audio beyond volume.** Music does not exist yet; a mute toggle for
  silence is furniture.
- **No accessibility work beyond reduced motion and full pad/keyboard
  parity.** Both of those are correctness. Colour-blind palettes, remapping and
  text scaling are a real pass, and pretending three checkboxes cover it is
  worse than scoping it honestly.

## Known interaction, not fixed here

The dev tuning panel autosaves the whole `params` object whenever a slider
moves. Blueprint upgrades mutate `params` directly, so a developer who builds
a blueprint *and then* touches a slider bakes the upgraded value into the dev
tuning file — and it compounds on the next load, because restoring built
blueprints replays their multipliers. This predates the shell and only reaches
a developer with `?dev` open. Noted rather than fixed: the fix belongs with the
tuning store, not the shell.
