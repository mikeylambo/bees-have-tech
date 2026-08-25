# Prompt for Claude Code

Build the game shell described in SHELL_PLAN.md (repo root). Read it in full first,
then CONCEPT_PILLARS.md and the M5–M9 sections of SLICE_PLAN.md for the design
rules it leans on. All work is in Prototype/.

Do it in the plan's two passes, as two commits:

Pass 1 — invisible shell (SHELL_PLAN §1–§3): the boot→title→playing→paused state
machine in src/shell/, pause with the sim frozen (the existing simDt lever at 0),
the hold-X/hold-Back respawn-to-hive with fill ring, and progress persistence
under a new versioned localStorage key (bees-progress-v1) — quests, blueprints,
banked salvage, exposure, belt, taught lines. Load applies after world build,
before quests.begin(); version mismatch discards, never migrates.

Pass 2 — visible shell (SHELL_PLAN §4–§6): the zero-JS boot screen inlined in
index.html with honest phase text; the title screen over a live attract camera
drifting the gate→drive→house spine, with Continue / New Game / Settings /
Controls / Estate blockout and the tagline "Scientists thought bees built hives.
They actually built civilization."; the pause menu; player settings backed by
existing params plus Sound.setVolume and a reduced-motion flag the JS speed FX
respect; the controls screen; the three teach-once onboarding lines; Tweakpane
behind ?dev (or backtick).

Hard constraints, non-negotiable:
- Nothing in the sim changes — flight, camera, exposure arithmetic, quest
  content, the household are read, never edited. The shell routes input and
  scales time only.
- One visual language: the existing HUD's honey-gold #ffd75e on
  rgba(20,24,18,·), ui-monospace, existing radius/border idiom. No frameworks,
  no fonts, no second aesthetic.
- Every menu fully drivable by gamepad alone (reuse the workshop's menuDelta
  nav pattern; map Start in gamepad.ts for pause) and by keyboard alone.
- prefers-reduced-motion respected in every new animation.
- estate.html untouched except for where its link moves.

Definition of done, per pass — verify each, don't assume:
- npm run build passes (tsc --noEmit + vite build).
- Pass 1: Esc and alt-tab both pause a frozen world; Resume returns cleanly and
  re-locks; hold-X rescues a wedged bee to the hive mouth without resetting
  exposure; a refresh mid-quest-chain restores quests, blueprints, salvage and
  exposure exactly; a corrupted or stale save blob is discarded silently.
- Pass 2: cold load paints boot text before any JS chunk arrives; Play takes
  pointer lock and starts audio in one click; New Game over an existing save
  asks once; Continue skips quests.begin() correctly mid-chain; menus work
  pad-only end to end; no Tweakpane without ?dev; each teach line fires exactly
  once across a refresh.

Anything shape-testable (save round-trip, state transitions) goes in the
existing test pattern. Where the plan is silent, prefer the smallest thing
consistent with the pillars — and note the decision in the commit message.
When both passes are green, append a short "Shell" milestone entry to
SLICE_PLAN.md and update README controls/links to match, in the docs' voice.
