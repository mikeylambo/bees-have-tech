import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Input, type InputState } from './core/input';
import { FollowCamera } from './core/camera';
import { params, createTuning, loadSavedSettings } from './core/tuning';
import { GrassField } from './world/grass';
import { buildProps, syncProps, syncFlowers, applyFlowerSpring, containProps } from './world/props';
import {
  M, SPAWN, HIVE_AT, WALK_BLOCKERS, WALK_BLOCK_CIRCLES, zoneCentre,
  grassBlocked, isCut, cutFraction,
} from './world/estateWorld';

/** Everything positioned in this file is placed in metres, like the estate. */
const m = (metres: number) => metres * M;
import { Bee } from './bee/bee';
import { FlightController } from './bee/flight';
import { Grapple } from './bee/grapple';
import { Carry } from './bee/carry';
import { Aiming } from './bee/aiming';
import { Stinger } from './bee/stinger';
import { TechBelt } from './bee/tech';
import { grappleTech, tractorTech, beaconTech } from './bee/techItems';
import { Swarm } from './bee/swarm';
import { Hive } from './game/hive';
import { Workshop, BLUEPRINTS, type BuildContext } from './game/blueprints';
import { QuestLog, buildQuests } from './game/quests';
import { RadialMenu } from './ui/radial';
import { QuestHud } from './ui/questHud';
import { CastCard } from './ui/castCard';
import { WorkshopUI } from './ui/workshop';
import { Household, type HouseholdSense } from './world/household';
import { Exposure } from './game/exposure';
import { Sprinkler, BugZapper, BoxFan, type Appliance } from './world/appliances';
import { Mower } from './world/mower';
import { Atmosphere } from './world/atmosphere';
import { Hacker, hackerTech } from './bee/hacker';
import { Motes } from './fx/motes';
import { SpeedFx } from './fx/speedFx';
import { Sound } from './audio/sound';
import { applyLook } from './look/toon';
import { OutlinePass } from './look/outline';
import { Shell } from './shell/state';
import {
  readProgress, applyProgress, clearProgress, ProgressWriter,
  type ProgressWorld,
} from './shell/progress';
import { Rescue, rescueToHive } from './shell/rescue';
import { Settings } from './shell/settings';
import { Screens } from './shell/screens';
import { AttractCamera } from './shell/attract';
import { Onboarding } from './shell/onboarding';
import { hasProgress } from './shell/progress';

const NEUTRAL_INPUT: InputState = { forward: 0, strafe: 0, vertical: 0, boost: false };

/** Set across a New Game reload so the fresh page starts in play, not on the title. */
const AUTOPLAY = 'bees-autoplay';

async function main() {
  // The boot screen is already on the page — inlined in index.html so it
  // paints before a single byte of this file arrives. All we do is tell it
  // the truth about what is taking the time. Two rAFs per phase, because a
  // textContent change nobody yields for is a change nobody sees.
  const bootEl = document.getElementById('boot');
  const bootPhase = document.getElementById('bootPhase');
  const phase = (label: string) => new Promise<void>((done) => {
    if (bootPhase) bootPhase.textContent = label;
    requestAnimationFrame(() => requestAnimationFrame(() => done()));
  });

  // Before anything is built — the yard, household and flower springs all read
  // these values at construction time.
  loadSavedSettings();

  await phase('starting physics');
  const physics = await initPhysics();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const sound = new Sound();
  // Audio can only start from a gesture; this is the same click that takes
  // pointer lock, so it costs the player nothing.
  renderer.domElement.addEventListener('click', () => sound.start());

  const scene = new THREE.Scene();
  await phase('building the estate');
  const yard = buildProps(physics, scene, params.world.seed);
  await phase('scattering the yard');
  const grass = new GrassField(params.world.seed);
  scene.add(grass.mesh);

  const bee = new Bee();
  scene.add(bee.root);
  const motes = new Motes();
  scene.add(motes.object);
  const flight = new FlightController(physics, SPAWN.clone());

  const grapple = new Grapple(physics, flight.body);
  scene.add(grapple.line);
  const carry = new Carry(physics, flight.body);
  scene.add(carry.beam);
  const aiming = new Aiming(yard);
  const aim = Aiming.emptyResult();

  // --- M3: hackable appliances + atmosphere ---
  // Grouped at the south end of the pool terrace, which is where a lawn
  // sprinkler, a bug zapper and a floor fan would actually be. They have to be
  // within each other's radius — the M3 chain is only a chain if the
  // sprinkler's 2.5 m of spread can reach the zapper.
  const sprinkler = new Sprinkler(physics, new THREE.Vector3(m(16.4), 0, m(-3.4)));
  const zapper = new BugZapper(physics, new THREE.Vector3(m(18.1), 0, m(-4.2)));
  const fan = new BoxFan(
    physics, new THREE.Vector3(m(19.0), 0, m(19.2)), new THREE.Vector3(0, 0, -1),
  );
  // THE MOWER — the first thing on this property that hunts you. Docked at
  // the south end of the west lawn: 66 m of unbroken flight line, which is
  // the best run on the estate and now the one with something on it.
  const mower = new Mower(physics, new THREE.Vector3(m(-34), 0, m(-42)));
  const MOWER_DOCK = mower.position.clone();
  const appliances: Appliance[] = [sprinkler, zapper, fan, mower];
  for (const a of [sprinkler.group, zapper.group, fan.group, mower.group]) scene.add(a);

  const atmosphere = new Atmosphere();
  atmosphere.add(fan.zone);
  const air = Atmosphere.emptySample();

  // --- M4: hive, swarm --- / --- M5: workshop, quests ---
  // The hive lives in a hollow of the WEST GATE PILLAR — 1.4 m up a stone
  // post at the front entrance, per the blockout. Visible to every human who
  // walks through the gate, reachable only by something that flies.
  const hive = new Hive(physics, HIVE_AT.clone());
  scene.add(hive.group);
  const swarm = new Swarm();
  scene.add(swarm.group);
  const workshop = new Workshop();

  const salvageEl = document.getElementById('salvageCount');
  const builtEl = document.getElementById('builtCount');
  const unlockEl = document.getElementById('unlock');
  const unlockKicker = document.getElementById('unlockKicker');
  const unlockName = document.getElementById('unlockName');
  const unlockBlurb = document.getElementById('unlockBlurb');

  const questHud = new QuestHud();
  const workshopUI = new WorkshopUI(workshop);

  function updateBankHud() {
    if (salvageEl) salvageEl.textContent = `${hive.stored} salvage`;
    if (builtEl) {
      builtEl.textContent = workshop.known.size === 0
        ? 'no blueprints yet'
        : `${workshop.built.size}/${workshop.known.size} built`;
    }
    if (workshopUI.open) workshopUI.render(hive.stored);
  }

  function announce(kicker: string, name: string, blurb: string) {
    if (!unlockEl) return;
    if (unlockKicker) unlockKicker.textContent = kicker;
    if (unlockName) unlockName.textContent = name;
    if (unlockBlurb) unlockBlurb.textContent = blurb;
    unlockEl.classList.remove('show');
    void unlockEl.offsetWidth;
    unlockEl.classList.add('show');
  }

  // --- innate vs tech ---
  // The stinger is the bee's body, so it's never in the belt and never
  // swapped away. Everything else is tech the hive built.
  const stinger = new Stinger(physics, flight.body, flight.collider);
  const hacker = new Hacker(appliances);
  scene.add(hacker.beam);
  const belt = new TechBelt();
  belt.add(grappleTech(grapple));
  belt.add(tractorTech(carry));
  belt.add(hackerTech(hacker, (a) => {
    // Flipping a switch in view is far more incriminating than being seen.
    input.rumble(0.4, 0.65, 130);
    sound.hack();
    quests.hacked(a.kind);
    if (household.members.some((h) => h.canSee(physics, a.position, flight.collider))) {
      exposure.spike(14);
    }
  }));
  const radial = new RadialMenu(belt);

  // What a blueprint is allowed to reach. Everything else it does, it does by
  // editing tuning params — which is why most of the catalog is three lines.
  const buildCtx: BuildContext = {
    addTech: (id) => {
      if (id === 'beacon') {
        belt.add(beaconTech(swarm));
        radial.rebuild();
      }
    },
    recruitBee: () => swarm.recruit(hive.mouthPosition(new THREE.Vector3())),
  };

  workshop.onBuild = (bp) => {
    sound.unlock();
    announce('REVERSE ENGINEERED', bp.name, bp.blurb);
    input.rumble(0.6, 0.8, 400);
  };

  // --- quests ---
  const quests = new QuestLog(buildQuests({
    hive: hive.mouthPosition(new THREE.Vector3()),
    sprinkler: sprinkler.position,
    zapper: zapper.position,
    firepit: zoneCentre('firepit'),
    playground: zoneCentre('playground'),
    service: zoneCentre('service'),
    pottingShed: zoneCentre('shed'),
  }));

  quests.onOffer = (q) => {
    questHud.offer(q);
    input.rumble(0.25, 0.4, 140);
  };
  quests.onProgress = (q, o) => {
    questHud.tracker(q);
    questHud.progress(o);
    input.rumble(0.3, 0.5, 110);
  };
  quests.onComplete = (q) => {
    if (q.reward.salvage) hive.credit(q.reward.salvage);
    for (const id of q.reward.blueprints ?? []) workshop.learn(id);
    sound.unlock();
    questHud.complete(q);
    questHud.tracker(null);
    updateBankHud();
    input.rumble(0.7, 0.9, 420);
    if (quests.finished) questHud.allDone();
  };

  const techIcon = document.getElementById('techIcon');
  const techName = document.getElementById('techName');
  function refreshTechHud() {
    const t = belt.active;
    if (techIcon) techIcon.textContent = t ? t.icon : '';
    if (techName) techName.textContent = t ? t.name : 'no tech';
  }
  refreshTechHud();

  // --- M2/M8: a household, one exposure meter ---
  // Four people, one meter, and the meter now depends on WHICH of them is
  // looking. See household.ts for why that's the whole design.
  const household = new Household(physics, params.world.seed ^ 0x5bf03635);
  scene.add(household.group);
  const exposure = new Exposure();

  const swatFlash = document.getElementById('swatFlash');
  const expFill = document.getElementById('expFill');
  const expLevel = document.getElementById('expLevel');
  const expQuote = document.getElementById('expQuote');
  const expBox = document.getElementById('exposure');
  const expSeen = document.getElementById('expSeen');

  function flashSwat() {
    if (!swatFlash) return;
    swatFlash.classList.add('hit');
    setTimeout(() => swatFlash.classList.remove('hit'), 90);
  }

  const hitmark = document.getElementById('hitmark');
  function popHitmark(kind: 'hit' | 'sting') {
    if (!hitmark) return;
    hitmark.classList.remove('pop', 'sting');
    void hitmark.offsetWidth; // restart the animation
    hitmark.classList.add('pop');
    if (kind === 'sting') hitmark.classList.add('sting');
  }

  household.onSwatHit = (dir, who) => {
    // Drop whatever you were holding — getting hit should cost you something.
    if (carry.isCarrying) carry.drop();
    if (grapple.state !== 'idle') grapple.release();
    flight.knockback(dir, params.human.swatImpulse * who.profile.clout);
    sound.swatWhoosh();
    // A connected swat is a story everyone in earshot now wants to hear.
    exposure.spike(6);
    household.alertAll(beePos);
    flashSwat();
    input.rumble(1, 0.8, 320); // you got hit by a hand the size of a house
  };
  stinger.onStingHuman = (_dir, handle) => {
    // Being stung is not something you explain away as "just a bee."
    sound.sting();
    exposure.spike(22);
    const stung = household.memberByHandle(handle);
    stung?.reactToSting();
    // ...and it is definitely not something the rest of them ignore.
    household.alertAll(beePos);
    popHitmark('sting');
    quests.event('sting-human');
    input.rumble(0.85, 0.5, 220); // sharp and unmistakable
  };
  stinger.onHitProp = () => {
    sound.hitProp();
    popHitmark('hit');
    input.rumble(0.25, 0.4, 70);
  };
  household.onSwatMiss = (dir, distance, who) => {
    // Near miss: the air moves. Being *almost* hit should be a thrill.
    const falloff = Math.max(0, 1 - distance / (params.human.swatRange * 2.2));
    if (falloff > 0) {
      flight.knockback(dir, params.human.swatImpulse * who.profile.clout * 0.45 * falloff);
      sound.swatWhoosh();
      input.rumble(0.3 * falloff, 0.5 * falloff, 160); // the air moves past you
    }
  };

  const input = new Input(renderer.domElement);
  // THE SHELL. It routes input and scales time; it never edits the sim.
  const shell = new Shell();
  shell.requestLock = () => input.requestLock();
  shell.releaseLock = () => input.releaseLock();
  // Clicking the canvas grabs the cursor only while you are actually flying.
  input.canLock = () => shell.state === 'playing';
  // Esc leaves pointer lock before any keydown arrives, so the lock dropping
  // IS the pause gesture on KBM. Treat it as one rather than fighting it.
  input.onLockChange = (locked) => {
    if (!locked && shell.state === 'playing') shell.pause('player');
  };
  // Alt-tabbing out of a game where somebody is walking toward you, and
  // coming back to a raised exposure meter, is the build taking something
  // from you while you weren't looking.
  const pauseOnLostFocus = () => {
    if (shell.state === 'playing') shell.pause('lostFocus');
  };
  window.addEventListener('blur', pauseOnLostFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseOnLostFocus();
  });

  const followCam = new FollowCamera(window.innerWidth / window.innerHeight);
  const speedFx = new SpeedFx(followCam);
  const outline = new OutlinePass(renderer);

  // Keep the camera out of solid geometry — otherwise it slips inside the
  // human and he reads as a hologram you can fly through.
  followCam.occlusionTest = (from, dir, maxDist) => {
    const ray = new physics.RAPIER.Ray(
      { x: from.x, y: from.y, z: from.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = physics.world.castRay(
      ray, maxDist, true, undefined, undefined, flight.collider, flight.body,
    );
    return hit ? hit.timeOfImpact : null;
  };

  // The tuning panel is a DEVELOPMENT TOOL sitting on top of the game. Behind
  // ?dev, or summoned with backtick. Everything a player should be able to
  // change lives in Settings instead — which is the single change that most
  // makes this read as a game rather than a demo.
  const devRequested = new URLSearchParams(location.search).has('dev');
  let devPane: unknown = null;
  const openDevPanel = () => {
    if (devPane) return;
    devPane = createTuning(
      (seed) => grass.scatter(seed),
      () => applyFlowerSpring(physics, yard.flowers),
      { onLookChange: () => applyLook(scene) },
    );
  };
  if (devRequested) openDevPanel();
  // Banded shading over everything already built.
  applyLook(scene);

  const reticle = document.getElementById('reticle');
  /** Wired once player settings exist — see the H handler below. */
  let onHudToggle: (() => void) | null = null;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') {
      document.body.classList.toggle('hide-ui');
      // Set once Settings exists. `settings` is a const declared further down,
      // so naming it directly here would be a TDZ throw for anyone who hits H
      // during boot.
      onHudToggle?.();
    }
    // Backtick summons the dev panel without a reload — the same tool, one
    // keystroke away, for anyone who did not think to add ?dev before loading.
    if (e.code === 'Backquote') openDevPanel();
    // Esc leaves pointer lock anyway; make it close the shop too rather than
    // stranding the player in a panel with the mouse free.
    if (e.code === 'Escape' && workshopUI.open) workshopUI.hide();
  });

  // Observe the element, not just window resize: the canvas must re-fit when
  // the page is embedded in a pane that changes size without a window event.
  function fitToViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;
    followCam.camera.aspect = w / h;
    followCam.camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
    outline.setSize(w, h);
  }
  window.addEventListener('resize', fitToViewport);
  window.addEventListener('orientationchange', fitToViewport);
  new ResizeObserver(fitToViewport).observe(document.documentElement);
  fitToViewport();

  // fixed-step physics, per-frame render
  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;

  // The household's arithmetic never appears as a number. Call each rule out
  // the first time the player is actually standing in it, then shut up.
  // Shared with the shell's onboarding lines and saved with progress, so
  // "once" means once across refreshes rather than once per page load.
  const taught = new Set<string>();
  /** Say a line the first time it is true, and remember that forever. */
  function teachOnce(id: string, line: string): boolean {
    if (taught.has(id)) return false;
    taught.add(id);
    questHud.say(line);
    saves.touch();
    return true;
  }
  function teachHousehold(sense: HouseholdSense) {
    if (!sense.seen) return;
    const covering = sense.seenBy.filter((h) => h.profile.suspicion < 0);
    const accusing = sense.seenBy.filter((h) => h.profile.suspicion > 0);
    const calming = sense.seenBy.filter((h) => h.profile.dampen < 1);
    if (covering.length && !accusing.length) {
      teachOnce('cover', `${covering[0].name} has seen you — and is saying nothing`);
    } else if (calming.length && accusing.length) {
      teachOnce('calm', `${calming[0].name} is talking them down`);
    } else if (accusing.length > 1) {
      teachOnce('gang', `${accusing.length} of them are watching you`);
    }
  }

  let lastLevel = -1;
  let lastWatchers = '';
  function updateExposureHud(sense: HouseholdSense) {
    if (expFill) expFill.style.width = `${exposure.value}%`;
    if (expBox) expBox.classList.toggle('seen', sense.seen);
    // WHO is watching is now more actionable than WHETHER. Colour says which
    // way each of them is pushing the meter, so you can learn the household
    // by playing rather than by reading a manual.
    if (expSeen) {
      const key = sense.seenBy.map((h) => h.profile.id).join(',');
      if (key !== lastWatchers) {
        lastWatchers = key;
        expSeen.textContent = '';
        for (const h of sense.seenBy) {
          const el = document.createElement('span');
          const p = h.profile;
          el.className = p.suspicion < 0 ? 'w-down' : p.dampen < 1 ? 'w-calm' : 'w-up';
          el.textContent = `${p.suspicion < 0 ? '▼' : '▲'} ${p.name}`;
          el.title = p.quote;
          expSeen.appendChild(el);
        }
      }
    }
    const lvl = exposure.level;
    if (lvl !== lastLevel) {
      lastLevel = lvl;
      const info = exposure.levelInfo;
      // ONE-BASED on screen. The rungs are talked about as "level 5 is when
      // the agents come", and a HUD that calls the first rung 0 makes the top
      // one 4 — off by one from every conversation anyone has about it.
      if (expLevel) expLevel.textContent = `EXPOSURE ${lvl + 1} · ${info.name}`;
      if (expQuote) expQuote.textContent = info.quote;
      if (expBox) {
        expBox.classList.remove('lvl1', 'lvl2', 'lvl3', 'lvl4');
        if (lvl > 0) expBox.classList.add(`lvl${lvl}`);
      }
    }
  }

  const beePos = new THREE.Vector3();
  const beeVel = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let firstFrame = true;
  let zapCooldown = 0;
  let mowerCooldown = 0;
  /** Counters the headless suite reads — cheaper than inferring from velocity. */
  const probe = { mowerHits: 0 };
  let wasElectrified = false;
  const hiveMouth = new THREE.Vector3();
  const propBodies = yard.dynamicProps.map((p) => p.body);
  // Render-budget probe: renderer.info is the only honest source for draw
  // calls and triangles, and both are what predict how far this world scales.
  (window as unknown as Record<string, unknown>).__renderer = renderer;
  (window as unknown as Record<string, unknown>).__debug = {
    beePos, beeVel, params, grapple, carry, yard, physics, flight, followCam, scene,
    aiming, aim, household, exposure, belt, radial, stinger,
    WALK_BLOCKERS, WALK_BLOCK_CIRCLES,
    appliances, sprinkler, zapper, fan, atmosphere, hacker, air,
    hive, swarm, workshop, quests, workshopUI, questHud, mower, MOWER_DOCK,
    grass, grassBlocked, isCut, cutFraction, probe,
    motes, speedFx, sound, outline,
    shell, taught, buildCtx,
  };
  updateBankHud();

  // ---- the shell: rescue, progress, and the point the game actually starts ----

  // `taught` is the M8 household set, reused rather than duplicated: both the
  // household lines and the onboarding lines mean exactly the same thing —
  // say it once, ever — so one set, and it persists across a refresh now.
  const progressWorld: ProgressWorld = {
    quests, workshop, hive, exposure, belt, taught,
  };
  const saves = new ProgressWriter(progressWorld);
  // A save nobody is told about is a save nobody trusts. One pip, briefly.
  const saveTick = document.getElementById('saveTick');
  let saveTickT: number | undefined;
  saves.onWrite = () => {
    if (!saveTick) return;
    saveTick.classList.add('show');
    clearTimeout(saveTickT);
    saveTickT = setTimeout(() => saveTick.classList.remove('show'), 1400) as unknown as number;
  };

  const rescue = new Rescue();
  rescue.onRescue = () => {
    rescueToHive(flight.body, hive.mouthPosition(new THREE.Vector3()), () => {
      if (carry.isCarrying) carry.drop();
      if (grapple.state !== 'idle') grapple.release();
    });
    sound.unlock();
    input.rumble(0.4, 0.6, 220);
  };

  // Progress applies AFTER the world is built and BEFORE quests.begin(), or a
  // returning player gets pitched quest 1 on top of the quest they were on.
  const saved = readProgress();
  let restored = false;
  if (saved) {
    restored = applyProgress(saved, progressWorld, buildCtx);
    // A blob that doesn't describe this build's quest chain is discarded
    // whole. Half-restoring somebody into a chain that moved is worse than
    // starting them over.
    if (!restored) clearProgress();
    else {
      updateBankHud();
      refreshTechHud();
    }
  }
  if (restored) quests.resume();
  else quests.begin();

  // Anything worth losing sleep over gets written a moment later; a burst
  // collapses into one write.
  quests.onProgress = ((prev) => (q, o) => { prev?.(q, o); saves.touch(); })(quests.onProgress);
  quests.onComplete = ((prev) => (q) => { prev?.(q); saves.touch(); })(quests.onComplete);
  window.addEventListener('pagehide', () => saves.flush());

  Object.assign(
    (window as unknown as Record<string, Record<string, unknown>>).__debug,
    { rescue, saves, progressWorld },
  );

  // ---- player settings, the screens, and the attract camera ----

  const settings = new Settings();
  const attract = new AttractCamera();
  settings.onChange = (v) => {
    // FOV lives on the camera, and SpeedFx rebases off it — set it in both
    // places or the speed kick springs back to the old base on the next frame.
    followCam.camera.fov = v.fov;
    followCam.camera.updateProjectionMatrix();
    speedFx.rebase(v.fov);
    // The plan called this `setVolume`; the method Sound actually ships is
    // `setMasterVolume`. It no-ops until the audio graph exists, which is why
    // Play re-applies it right after start().
    sound.setMasterVolume(v.volume);
    // prefers-reduced-motion is CSS-only and cannot reach a projection matrix
    // or a camera path, so both read the flag instead.
    speedFx.reduced = v.reducedMotion;
    attract.reducedMotion = v.reducedMotion;
  };
  onHudToggle = () => settings.syncHudFromDom();
  settings.apply();

  const screens = new Screens({
    settings,
    // A snapshot, taken when the screen opens. The Journal is a read-only
    // record of the run, not a live view of the simulation.
    journal: () => ({
      salvage: hive.stored,
      lifetime: hive.lifetime,
      quests: quests.all().map((q, i) => ({
        title: q.title,
        done: i < quests.completedCount,
        objectives: q.objectives.map((o) => ({
          text: o.text, have: o.have, need: o.need,
        })),
      })).filter((_, i) => i <= quests.completedCount),
      blueprints: BLUEPRINTS.map((b) => ({
        icon: b.icon,
        name: b.name,
        effect: b.effect,
        cost: b.cost,
        state: workshop.built.has(b.id)
          ? 'built' as const
          : workshop.known.has(b.id) ? 'known' as const : 'locked' as const,
      })),
    }),
    hasSave: () => hasProgress(),
    play: () => {
      // ONE click does both: WebAudio needs a gesture and so does pointer
      // lock, and spending two clicks on one intention is a tax.
      sound.start();
      sound.setMasterVolume(settings.values.volume);
      shell.play();
    },
    newGame: () => {
      clearProgress();
      // A fresh run means a fresh world — props unconsumed, salvage unspent,
      // the household back on their marks — and rebuilding an estate in place
      // is a great deal more code than reloading the page for it. The flag
      // survives the reload so New Game lands you in the GAME rather than
      // back on the title screen you just left.
      try {
        sessionStorage.setItem(AUTOPLAY, '1');
      } catch { /* the reload still gives a clean world, just via the title */ }
      window.location.reload();
    },
    resume: () => shell.resume(),
    quitToTitle: () => {
      saves.flush();
      shell.toTitle();
    },
  });

  const onboarding = new Onboarding(teachOnce);

  // Introduce the cast. M8 gave the property four residents whose disagreement
  // IS the exposure meter, and the player met all of that as four anonymous
  // figures on a lawn. Each of them gets one card, the first time they clock
  // you — which is the moment it means something — and it rides in the same
  // taught set as everything else, so once means once.
  const castCard = new CastCard();
  function meet(id: string, role: string, name: string, quote: string, color: number) {
    if (taught.has(`met:${id}`)) return;
    taught.add(`met:${id}`);
    saves.touch();
    castCard.show({ id, name, role, quote, color });
  }

  // The cut has to be VISIBLE, not just recorded. Tiles outside the grass
  // window scatter fresh when you fly to them and read mown for free; this
  // handles the ones under your nose, and only fires when the blades actually
  // took something down.
  mower.onCut = (x, z) => grass.invalidateAt(x, z);
  // Weather, announced. A machine starting itself is the property having a
  // life of its own, and it is worth saying once so it doesn't read as a bug.
  mower.onWake = () => {
    teachOnce('mower', 'Something just started itself out on the west lawn.');
    // The one thing on the property that hunts you deserves an introduction
    // as much as the people do.
    meet('mower', 'THE GROUNDSKEEPER', 'Robot Mower',
      '"it does the lawns on Tuesdays"', 0xd8683a);
  };

  shell.onChange = (to, from) => {
    // Flush when you STOP PLAYING — not on every transition. Flushing on the
    // way into the title wrote an empty save during boot, which made Continue
    // live on a run that did not exist.
    if (from === 'playing') saves.flush();
    if (to === 'title') {
      attract.reset();
      castCard.clear();
      screens.show('title');
    } else if (to === 'paused') {
      screens.show('pause');
    } else {
      screens.hide();
    }
    // The "click to fly" hint belongs to flying, not to a menu. The HUD only
    // goes away on the TITLE — behind a pause menu, seeing your own exposure
    // meter and quest tracker is the point of the world staying visible.
    document.body.classList.toggle('in-menu', to !== 'playing');
    document.body.classList.toggle('in-title', to === 'title');
  };

  Object.assign(
    (window as unknown as Record<string, Record<string, unknown>>).__debug,
    { screens, settings, attract, onboarding, castCard },
  );

  bootEl?.classList.add('gone');
  setTimeout(() => bootEl?.remove(), 400);
  shell.ready();
  // Came back from a New Game click: skip the title we were just on.
  try {
    if (sessionStorage.getItem(AUTOPLAY)) {
      sessionStorage.removeItem(AUTOPLAY);
      sound.start();
      sound.setMasterVolume(settings.values.volume);
      shell.play();
    }
  } catch { /* no session storage: the title screen is a fine place to land */ }

  function frame(now: number) {
    requestAnimationFrame(frame);
    // Two clocks on purpose: `dt` is clamped so one long stall can't teleport
    // the simulation, but the FPS readout must use the REAL frame time or it
    // reports a comfortable 20 while the game runs at one frame a second.
    const rawDt = (now - last) / 1000;
    last = now;

    const look = input.takeLook();
    const act = input.actions();

    // --- the shell gets first look at input, and decides whether the sim runs ---
    // Menus first: while a screen is up, Esc means "back one screen" until you
    // are at the root of it, and only then does it mean resume.
    const consumedCancel = screens.update(act);
    if (act.pausePressed && !consumedCancel) {
      if (shell.state === 'paused' && screens.depth > 1) screens.back();
      else if (shell.state !== 'title') shell.togglePause();
    }
    const running = shell.running;

    // FROZEN MEANS FROZEN. Everything downstream that advances the world reads
    // `dt` — the household's walk, the appliances, the exposure meter, the
    // stinger cooldown — so while paused it is zero, not merely unstepped.
    // Rendering still runs on rawDt, which is why the world stays visible
    // behind the menu instead of the pause screen being a black rectangle.
    const dt = running ? Math.min(rawDt, 1 / 20) : 0;

    // Hold to come home. Charged only while flying, so a key held behind a
    // menu doesn't quietly bank a rescue — and drained on rawDt so the ring
    // still visibly lets go if you pause mid-hold.
    rescue.update(
      Math.min(rawDt, 1 / 20), act.rescueHeld,
      running && !workshopUI.open && !radial.open,
    );

    const shopping = workshopUI.open;
    // While the radial or the shop is open the stick steers the menu; while a
    // shell screen is up, nothing steers the camera at all.
    if (running && !act.radialHeld && !shopping) followCam.addLook(look, dt);
    // Paused means the bee gets neutral input, exactly as it does while the
    // workshop is open — or a key held across the pause boundary arrives as a
    // shove on resume.
    const state = running ? input.state() : NEUTRAL_INPUT;

    // The crosshair finds a point; gadgets then fire from the BEE toward it,
    // so close-range shots don't miss by camera parallax.
    followCam.camera.getWorldDirection(aimDir);
    followCam.camera.getWorldPosition(camPos);
    flight.position(beePos);
    aiming.resolve(physics, camPos, aimDir, beePos, flight.collider, flight.body, aim);

    // --- the hive workshop: a shop that is a PLACE ---
    const atHive = hive.nearMouth(beePos);
    workshopUI.showPrompt(running && atHive && !radial.open);
    if (running && act.interactPressed) {
      if (shopping) workshopUI.hide();
      else if (atHive && !radial.open) workshopUI.show(hive.stored);
    }
    if (running && workshopUI.open) {
      const nav = act.menuDelta + act.cycleDelta;
      if (nav !== 0) workshopUI.move(Math.sign(nav), hive.stored);
      // The shell's menus take Enter/A to confirm and B to back out. The
      // workshop predates them and only took E/RB; accepting both means one
      // menu grammar across the whole game rather than two.
      if (act.cancelPressed) workshopUI.hide();
      if (act.usePressed || act.confirmPressed) {
        const bought = workshopUI.confirm(hive.stored, buildCtx);
        if (bought) {
          hive.spend(bought.cost);
          quests.built();
          updateBankHud();
          refreshTechHud();
          saves.touch();
        }
      }
    }

    // --- tech radial: switches tools, never uses them ---
    if (running && !workshopUI.open) {
      if (act.radialHeld && !radial.open) radial.show();
      if (act.radialHeld) {
        // Right stick on a pad, mouse motion on KBM. Y is inverted so "up" on
        // the stick points at the top of the ring.
        radial.update(look.stickX + look.mouseDX * 0.02, look.stickY + look.mouseDY * 0.02);
      }
      if (!act.radialHeld && radial.open) {
        const chosen = radial.hide();
        if (chosen >= 0) belt.select(chosen);
        refreshTechHud();
      }
      if (act.cycleDelta !== 0 && !radial.open) {
        belt.cycle(act.cycleDelta);
        refreshTechHud();
      }
    }

    // --- active tech ---
    const techCtx = { physics, beePos, aim, beeCollider: flight.collider, dt };
    const tech = belt.active;
    if (running && !radial.open && !workshopUI.open && tech) {
      if (act.usePressed) tech.useStart?.(techCtx);
      if (act.useHeld) tech.useHold?.(techCtx);
      if (act.useReleased) tech.useEnd?.(techCtx);
      if (act.altPressed) tech.altUse?.(techCtx);
    }

    // --- innate stinger ---
    stinger.update(dt);
    if (running && !radial.open && !workshopUI.open && act.stingPressed) {
      stinger.jab(aim.dirFromBee, beePos, household.bodyHandles);
    }

    // Slow-mo while a menu is open: readable, and a bee frozen mid-swing
    // looks broken where a bee in slow motion looks deliberate. It also means
    // the household keeps walking toward you while you shop, which is the whole
    // reason the workshop can be a menu at all.
    // Pause is the SAME lever the radial and the workshop already use, at
    // zero. Rendering continues — a paused game that shows a black rectangle
    // has thrown away the one asset it has — but the accumulator stops, so
    // nothing integrates and resuming cannot produce a catch-up spike.
    const menuOpen = radial.open || workshopUI.open;
    const simDt = !running ? 0 : menuOpen ? dt * params.radial.timeScale : dt;
    accumulator += simDt;
    const load = carry.loadFactor();
    const flightInput = workshopUI.open ? NEUTRAL_INPUT : state;
    while (accumulator >= FIXED_DT) {
      atmosphere.sample(beePos, air);
      flight.applyInput(flightInput, followCam.forwardYaw(), load, air);
      flight.position(beePos);
      // Refresh inside the loop — the beam feeds this forward, and a stale
      // velocity is exactly what loses cargo during hard acceleration.
      flight.velocity(beeVel);
      carry.update(beePos, aim.dirFromBee, beeVel);
      physics.world.step();
      accumulator -= FIXED_DT;
    }

    flight.position(beePos);
    flight.velocity(beeVel);

    // --- appliances + the chain nobody scripted ---
    // The sprinkler gets the atmosphere so a fan actually blows its spray.
    sprinkler.update(dt, atmosphere);
    zapper.update(dt);
    fan.update(dt);
    mower.update(dt);
    mower.punt(propBodies);
    hacker.update(beePos);
    // Water reaching a live zapper electrifies the puddle. This is the whole
    // point of M3: two objects with one verb each producing a third thing that
    // nobody wrote a special case for.
    zapper.electrifiedWater = zapper.on && sprinkler.wets(zapper.position);
    if (zapper.electrifiedWater && !wasElectrified) quests.event('electrified');
    wasElectrified = zapper.electrifiedWater;
    fan.applyToProps(propBodies, dt);

    if (zapper.on) {
      const zapDist = Math.hypot(
        beePos.x - zapper.position.x,
        beePos.y - (zapper.position.y + 10),
        beePos.z - zapper.position.z,
      );
      if (zapDist < zapper.hazardRadius && zapCooldown <= 0) {
        zapCooldown = 1.2;
        const away = new THREE.Vector3()
          .subVectors(beePos, zapper.position).normalize();
        away.y = Math.max(away.y, 0.5);
        flight.knockback(away.normalize(), params.appliance.zapImpulse);
        if (carry.isCarrying) carry.drop();
        if (grapple.state !== 'idle') grapple.release();
        sound.zap();
        flashSwat();
        input.rumble(0.9, 1, 260);
      }
    }
    zapCooldown = Math.max(0, zapCooldown - dt);

    // --- the mower ---
    const struck = running ? mower.strikes(beePos) : null;
    if (struck && mowerCooldown <= 0) {
      mowerCooldown = 1.4;
      probe.mowerHits++;
      flight.knockback(struck, params.mower.strikeImpulse);
      if (carry.isCarrying) carry.drop();
      if (grapple.state !== 'idle') grapple.release();
      sound.hitProp();
      flashSwat();
      input.rumble(1, 1, 340);
    }
    mowerCooldown = Math.max(0, mowerCooldown - dt);
    // Heard across the property, unmistakable in the last few metres. A
    // roaming hazard you cannot hear coming is an ambush, not a hazard.
    sound.mower(running && mower.on, beePos.distanceTo(mower.position) / m(34));

    // --- hive, swarm, salvage ---
    hive.update(dt);
    // Decoys mob whoever is most worked up — the person actually hunting you.
    const hunter = household.focus();
    swarm.update(dt, hive, hunter.root.position, beePos, yard.dynamicProps);
    const banked = hive.tryDeposit(yard.dynamicProps, hive.mouthPosition(hiveMouth));
    if (banked.length > 0) {
      for (const kind of banked) quests.deliver(kind);
      sound.deposit();
      updateBankHud();
      saves.touch();
      input.rumble(0.3, 0.5, 120);
    }
    // The household punts props as they walk. The fence catches almost
    // everything; this catches the rest, so a quest can never become
    // uncompletable.
    containProps(yard.dynamicProps);
    // Distraction is positional: mobbing Marla shouldn't blind Dale across
    // the lawn, or one beacon would switch off the whole household.
    household.setDistractedNear(swarm.distracting ? hunter.root.position : null);

    // --- household + exposure ---
    const sense = household.update(dt, physics, beePos, flight.collider);
    // Using tech in plain view is far more incriminating than merely existing.
    const techVisible =
      grapple.state !== 'idle' || carry.isCarrying || hacker.target !== null;
    exposure.update(dt, sense.seen, techVisible, sense.suspicion, sense.dampen);

    // Evidence: an appliance running by itself, in view. People react to the
    // WORLD behaving impossibly, not just to the bee — and they ACT on it,
    // because a rising meter is a number, not a reaction. How much it costs
    // you depends entirely on who happened to be looking that way.
    for (const a of appliances) {
      if (!a.conspicuous) continue;
      const weight = household.witnessEvidence(
        physics, a.position, flight.collider, sense.seen,
      );
      if (weight > 0) exposure.spike(params.appliance.evidenceRise * weight * dt);
    }

    // Walking into the sprinkler soaks them — a hack that inconveniences the
    // household directly, without the bee ever being involved.
    if (sprinkler.on) {
      const soaked = household.soakThoseIn((p) => sprinkler.wets(p));
      if (soaked > 0) {
        exposure.spike(4 * soaked);
        input.rumble(0.2, 0.3, 90);
      }
    }
    // Anyone seeing you for the first time introduces themselves.
    for (const who of sense.seenBy) {
      meet(who.profile.id, who.profile.role, who.name,
        who.profile.quote, who.profile.colors.shirt);
    }
    teachHousehold(sense);
    if (running) {
      onboarding.update(dt, {
        atHive, watched: sense.seen, beePos, speed: beeVel.length(),
      });
    }
    updateExposureHud(sense);

    // --- quests ---
    quests.update(dt);
    quests.checkVisit(beePos);
    questHud.update(dt);
    // Sim time, not wall time: pausing mid-introduction holds the card rather
    // than burning it behind the menu.
    castCard.update(dt);
    const mark = quests.marker();
    questHud.marker(
      followCam.camera, mark?.point ?? null, mark?.label ?? '', beePos,
    );
    // The pill's ring reads count progress when there is a count, and
    // PROXIMITY when the objective is a single thing to reach — which on
    // 10,800 m² is the most useful number the HUD can show.
    const obj = quests.currentObjective();
    const reach = mark?.point && obj
      ? 1 - Math.min(1, beePos.distanceTo(mark.point) / m(28))
      : 0;
    questHud.objective(running ? obj : null, reach);

    bee.update(dt, beePos, beeVel, state.boost);
    // Sense of speed: pollen streaming past, then the camera's reaction to it.
    const speed = beeVel.length();
    motes.update(dt, beePos, beeVel);
    speedFx.update(dt, speed);
    // A wingbeat behind a pause menu is a bee that did not stop.
    sound.wing(
      running ? speed / (params.flight.maxSpeed * params.flight.boostMul) : 0,
      running && state.boost,
    );
    grapple.update(dt, beePos);
    syncProps(yard.dynamicProps);
    syncFlowers(yard.flowers);
    // Speed feeds the grass LOD: moving fast widens the tiles, which keeps
    // buffer uploads rare at overdrive.
    grass.update(dt, beePos, beeVel.length());
    // Shadows ride with the bee — see property.ts for why a yard-wide frustum
    // can't work at this size.
    yard.updateShadow(beePos);
    // The title screen's background is the actual game: a slow push up 80 m of
    // driveway toward a nine-metre house, using geometry that already exists.
    if (shell.state === 'title') {
      attract.update(Math.min(rawDt, 1 / 20), followCam.camera);
      firstFrame = true; // so entering play snaps to the bee rather than easing
    } else {
      followCam.update(dt, beePos, firstFrame);
      firstFrame = false;
    }

    // Reticle state: what would this shot do?
    if (reticle) {
      // The reticle reports what the ACTIVE tool would do here, so switching
      // tech visibly changes what the world looks actionable.
      let cls = '';
      const engaged = tech?.status?.() === 'engaged';
      if (engaged) {
        cls = tech?.id === 'tractor' ? 'carrying' : 'attached';
      } else if (aim.hasTarget) {
        if (tech?.id === 'tractor') cls = aim.liftable ? 'liftable' : '';
        else cls = aim.liftable ? '' : 'anchor'; // grapple ignores light things
      }
      if (aim.assisted && !engaged && cls) cls += ' assisted';
      reticle.className = cls;
    }

    // Grass is excluded from edge DETECTION but still occludes edges — see
    // OutlinePass for why that distinction is the whole fix.
    outline.render(scene, followCam.camera, [grass.mesh]);

    fpsAccum += rawDt;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
      params.fps = fpsFrames / fpsAccum;
      // Draw calls and triangles are the two numbers that actually predict how
      // far this world can grow, and they're hardware-independent — unlike
      // fps, they mean the same thing on any machine.
      params.drawCalls = renderer.info.render.calls;
      params.triangles = renderer.info.render.triangles;
      fpsAccum = 0;
      fpsFrames = 0;
    }
  }
  requestAnimationFrame(frame);
}

main();
