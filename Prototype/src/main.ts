import * as THREE from 'three';
import { initPhysics } from './core/physics';
import { Input, type InputState } from './core/input';
import { FollowCamera } from './core/camera';
import { params, createTuning, loadSavedSettings } from './core/tuning';
import { GrassField } from './world/grass';
import { buildProps, syncProps, syncFlowers, applyFlowerSpring, containProps } from './world/props';
import {
  M, SPAWN, HIVE_AT, WALK_BLOCKERS, WALK_BLOCK_CIRCLES, zoneCentre,
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
import { Workshop, type BuildContext } from './game/blueprints';
import { QuestLog, buildQuests } from './game/quests';
import { RadialMenu } from './ui/radial';
import { QuestHud } from './ui/questHud';
import { WorkshopUI } from './ui/workshop';
import { Household, type HouseholdSense } from './world/household';
import { Exposure } from './game/exposure';
import { Sprinkler, BugZapper, BoxFan, type Appliance } from './world/appliances';
import { Atmosphere } from './world/atmosphere';
import { Hacker, hackerTech } from './bee/hacker';
import { Motes } from './fx/motes';
import { SpeedFx } from './fx/speedFx';
import { Sound } from './audio/sound';
import { applyLook } from './look/toon';
import { OutlinePass } from './look/outline';

const NEUTRAL_INPUT: InputState = { forward: 0, strafe: 0, vertical: 0, boost: false };

async function main() {
  // Before anything is built — the yard, household and flower springs all read
  // these values at construction time.
  loadSavedSettings();

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
  const yard = buildProps(physics, scene, params.world.seed);
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
  const appliances: Appliance[] = [sprinkler, zapper, fan];
  for (const a of [sprinkler.group, zapper.group, fan.group]) scene.add(a);

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

  createTuning(
    (seed) => grass.scatter(seed),
    () => applyFlowerSpring(physics, yard.flowers),
    { onLookChange: () => applyLook(scene) },
  );
  // Banded shading over everything already built.
  applyLook(scene);

  const reticle = document.getElementById('reticle');

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') document.body.classList.toggle('hide-ui');
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
  const taught = new Set<string>();
  function teachHousehold(sense: HouseholdSense) {
    if (!sense.seen) return;
    const covering = sense.seenBy.filter((h) => h.profile.suspicion < 0);
    const accusing = sense.seenBy.filter((h) => h.profile.suspicion > 0);
    const calming = sense.seenBy.filter((h) => h.profile.dampen < 1);
    if (covering.length && !accusing.length && !taught.has('cover')) {
      taught.add('cover');
      questHud.say(`${covering[0].name} has seen you — and is saying nothing`);
    } else if (calming.length && accusing.length && !taught.has('calm')) {
      taught.add('calm');
      questHud.say(`${calming[0].name} is talking them down`);
    } else if (accusing.length > 1 && !taught.has('gang')) {
      taught.add('gang');
      questHud.say(`${accusing.length} of them are watching you`);
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
      if (expLevel) expLevel.textContent = `EXPOSURE ${lvl} · ${info.name}`;
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
    hive, swarm, workshop, quests, workshopUI, questHud,
    motes, speedFx, sound, outline,
  };
  updateBankHud();
  quests.begin();

  function frame(now: number) {
    requestAnimationFrame(frame);
    // Two clocks on purpose: `dt` is clamped so one long stall can't teleport
    // the simulation, but the FPS readout must use the REAL frame time or it
    // reports a comfortable 20 while the game runs at one frame a second.
    const rawDt = (now - last) / 1000;
    const dt = Math.min(rawDt, 1 / 20);
    last = now;

    const look = input.takeLook();
    const act = input.actions();
    const shopping = workshopUI.open;
    // While the radial or the shop is open the stick steers the menu.
    if (!act.radialHeld && !shopping) followCam.addLook(look, dt);
    const state = input.state();

    // The crosshair finds a point; gadgets then fire from the BEE toward it,
    // so close-range shots don't miss by camera parallax.
    followCam.camera.getWorldDirection(aimDir);
    followCam.camera.getWorldPosition(camPos);
    flight.position(beePos);
    aiming.resolve(physics, camPos, aimDir, beePos, flight.collider, flight.body, aim);

    // --- the hive workshop: a shop that is a PLACE ---
    const atHive = hive.nearMouth(beePos);
    workshopUI.showPrompt(atHive && !radial.open);
    if (act.interactPressed) {
      if (shopping) workshopUI.hide();
      else if (atHive && !radial.open) workshopUI.show(hive.stored);
    }
    if (workshopUI.open) {
      const nav = act.menuDelta + act.cycleDelta;
      if (nav !== 0) workshopUI.move(Math.sign(nav), hive.stored);
      if (act.usePressed) {
        const bought = workshopUI.confirm(hive.stored, buildCtx);
        if (bought) {
          hive.spend(bought.cost);
          quests.built();
          updateBankHud();
          refreshTechHud();
        }
      }
    }

    // --- tech radial: switches tools, never uses them ---
    if (!workshopUI.open) {
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
    if (!radial.open && !workshopUI.open && tech) {
      if (act.usePressed) tech.useStart?.(techCtx);
      if (act.useHeld) tech.useHold?.(techCtx);
      if (act.useReleased) tech.useEnd?.(techCtx);
      if (act.altPressed) tech.altUse?.(techCtx);
    }

    // --- innate stinger ---
    stinger.update(dt);
    if (!radial.open && !workshopUI.open && act.stingPressed) {
      stinger.jab(aim.dirFromBee, beePos, household.bodyHandles);
    }

    // Slow-mo while a menu is open: readable, and a bee frozen mid-swing
    // looks broken where a bee in slow motion looks deliberate. It also means
    // the household keeps walking toward you while you shop, which is the whole
    // reason the workshop can be a menu at all.
    const menuOpen = radial.open || workshopUI.open;
    const simDt = menuOpen ? dt * params.radial.timeScale : dt;
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
    teachHousehold(sense);
    updateExposureHud(sense);

    // --- quests ---
    quests.update(dt);
    quests.checkVisit(beePos);
    questHud.update(dt);
    const mark = quests.marker();
    questHud.marker(
      followCam.camera, mark?.point ?? null, mark?.label ?? '', beePos,
    );

    bee.update(dt, beePos, beeVel, state.boost);
    // Sense of speed: pollen streaming past, then the camera's reaction to it.
    const speed = beeVel.length();
    motes.update(dt, beePos, beeVel);
    speedFx.update(dt, speed);
    sound.wing(speed / (params.flight.maxSpeed * params.flight.boostMul), state.boost);
    grapple.update(dt, beePos);
    syncProps(yard.dynamicProps);
    syncFlowers(yard.flowers);
    // Speed feeds the grass LOD: moving fast widens the tiles, which keeps
    // buffer uploads rare at overdrive.
    grass.update(dt, beePos, beeVel.length());
    // Shadows ride with the bee — see property.ts for why a yard-wide frustum
    // can't work at this size.
    yard.updateShadow(beePos);
    followCam.update(dt, beePos, firstFrame);
    firstFrame = false;

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
