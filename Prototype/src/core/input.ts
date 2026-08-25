import { Gamepads } from './gamepad';
import { params } from './tuning';

// Keyboard + mouse + gamepad merged into one per-frame snapshot, so the
// flight controller never touches DOM events or knows what device you used.
// Analog stick values pass through un-quantized — a half-tilted stick is a
// half-speed bee.
export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1 (+1 = right)
  vertical: number; // -1..1
  boost: boolean;
}

export interface LookDelta {
  mouseDX: number; // raw pixels
  mouseDY: number;
  stickX: number; // -1..1
  stickY: number;
}

// Action buttons, reported as edges (pressed/released this frame) plus held.
export interface Actions {
  /** Use the active tech item. */
  useHeld: boolean;
  usePressed: boolean;
  useReleased: boolean;
  /** Secondary action of the active tech (throw, detach). */
  altPressed: boolean;
  /** Innate stinger jab. */
  stingPressed: boolean;
  /** Hold to open the tech radial. */
  radialHeld: boolean;
  /** Quick-cycle without opening the radial. */
  cycleDelta: number;
  /** Open/close the hive workshop. */
  interactPressed: boolean;
  /** Menu navigation, edge-detected: -1 up, +1 down. */
  menuDelta: number;
  /** Esc / Start — open or close the pause menu. */
  pausePressed: boolean;
  /** X / Back — HELD, not pressed: the shell owns the timing. */
  rescueHeld: boolean;
  /** Menu adjust, edge-detected: -1 left, +1 right. Sliders and toggles. */
  menuDeltaX: number;
  /** Enter / Space / E / A / RB — activate the highlighted menu row. */
  confirmPressed: boolean;
  /** Backspace / B — go back one screen. */
  cancelPressed: boolean;
}

export class Input {
  private keys = new Set<string>();
  private pads = new Gamepads();
  private mouseDX = 0;
  private mouseDY = 0;
  private mouseButtons = new Set<number>();
  private prevUse = false;
  private prevSting = false;
  private prevAlt = false;
  private prevInteract = false;
  private prevPause = false;
  private prevNavUp = false;
  private prevNavDown = false;
  private prevNavLeft = false;
  private prevNavRight = false;
  private prevConfirm = false;
  private prevCancel = false;
  private wheelDelta = 0;
  locked = false;
  padConnected = false;
  /**
   * The shell gates this: clicking the canvas should take pointer lock while
   * you are FLYING, and do nothing at all while a menu is up. Without the
   * gate, clicking a title-screen button also grabs the cursor.
   */
  canLock: () => boolean = () => true;
  /** So the shell can pause when the browser drops the lock (Esc does that). */
  onLockChange?: (locked: boolean) => void;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) e.preventDefault();
      this.mouseButtons.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      // Tab opens the tech radial; don't let it walk the browser's focus ring.
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.canLock()) this.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.updateHint();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    this.pads.onConnectionChange = (connected) => {
      this.padConnected = connected;
      this.updateHint();
    };
  }

  private updateHint() {
    const hint = document.getElementById('lockHint');
    if (!hint) return;
    // A connected pad can fly without pointer lock, so drop the click prompt.
    hint.classList.toggle('hidden', this.locked || this.padConnected);
    const pad = document.getElementById('padStatus');
    if (pad) {
      pad.textContent = this.padConnected ? '🎮 controller connected' : '';
    }
  }

  state(): InputState {
    const k = this.keys;
    const p = this.pads.read(params.pad.deadzone, params.pad.swapTriggers);
    this.padConnected = p.connected;

    const kForward = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const kStrafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const kVert = (k.has('Space') ? 1 : 0) - (k.has('KeyC') ? 1 : 0);

    // Whichever device is pushing harder wins — no fighting between them.
    const pick = (a: number, b: number) => (Math.abs(a) >= Math.abs(b) ? a : b);

    return {
      forward: pick(kForward, p.moveY),
      strafe: pick(kStrafe, p.moveX),
      vertical: pick(kVert, p.ascend - p.descend),
      boost: k.has('ShiftLeft') || k.has('ShiftRight') || p.boost,
    };
  }

  // Edge-detected action buttons. Call once per frame.
  actions(): Actions {
    const p = this.pads.read(params.pad.deadzone, params.pad.swapTriggers);
    const use = this.mouseButtons.has(0) || this.keys.has('KeyE') || p.use;
    const sting = this.mouseButtons.has(2) || this.keys.has('KeyQ') || p.sting;
    const alt = this.keys.has('KeyF') || p.alt;
    const radial = this.keys.has('Tab') || p.radial;
    const interact = this.keys.has('KeyR') || p.interact;
    // Menu nav shares WASD with flight on purpose — you are never doing both,
    // and a menu that needs its own keys is a menu people mis-press.
    // Esc never reaches keydown while pointer-locked in some browsers — the
    // lock exit eats it — so pause also listens for the lock being dropped,
    // over in main. Here it is just another button.
    const pause = this.keys.has('Escape') || p.start;
    const navUp = this.keys.has('KeyW') || this.keys.has('ArrowUp') || p.dpadUp;
    const navDown = this.keys.has('KeyS') || this.keys.has('ArrowDown') || p.dpadDown;
    const menuDelta =
      (navDown && !this.prevNavDown ? 1 : 0) - (navUp && !this.prevNavUp ? 1 : 0);
    const navLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || p.dpadLeft;
    const navRight = this.keys.has('KeyD') || this.keys.has('ArrowRight') || p.dpadRight;
    const menuDeltaX =
      (navRight && !this.prevNavRight ? 1 : 0) - (navLeft && !this.prevNavLeft ? 1 : 0);
    // A/Cross is `boost` in flight and confirm in a menu. You are never doing
    // both, and confirm-is-A is the one pad convention nobody has to be told.
    const confirm = this.keys.has('Enter') || this.keys.has('Space')
      || this.keys.has('KeyE') || p.use || p.boost;
    const cancel = this.keys.has('Backspace') || p.sting;

    const a: Actions = {
      useHeld: use,
      usePressed: use && !this.prevUse,
      useReleased: !use && this.prevUse,
      altPressed: alt && !this.prevAlt,
      stingPressed: sting && !this.prevSting,
      radialHeld: radial,
      cycleDelta: this.wheelDelta,
      interactPressed: interact && !this.prevInteract,
      menuDelta,
      pausePressed: pause && !this.prevPause,
      rescueHeld: this.keys.has('KeyX') || p.back,
      menuDeltaX,
      confirmPressed: confirm && !this.prevConfirm,
      cancelPressed: cancel && !this.prevCancel,
    };
    this.prevUse = use;
    this.prevSting = sting;
    this.prevAlt = alt;
    this.prevInteract = interact;
    this.prevPause = pause;
    this.prevNavUp = navUp;
    this.prevNavDown = navDown;
    this.prevNavLeft = navLeft;
    this.prevNavRight = navRight;
    this.prevConfirm = confirm;
    this.prevCancel = cancel;
    this.wheelDelta = 0;
    return a;
  }

  /**
   * requestPointerLock returns a promise in Chromium and can reject in
   * embedded/automated contexts — mouse-look just stays off until a real user
   * gesture succeeds, which is why nothing here treats failure as an error.
   */
  requestLock() {
    if (this.locked) return;
    Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
  }

  releaseLock() {
    if (!this.locked) return;
    document.exitPointerLock();
  }

  /** Controller haptics — the clearest hit confirmation on a pad. */
  rumble(strong: number, weak: number, durationMs: number) {
    this.pads.rumble(strong, weak, durationMs);
  }

  // Consume accumulated look input for this frame.
  takeLook(): LookDelta {
    const p = this.pads.read(params.pad.deadzone, params.pad.swapTriggers);
    const look = {
      mouseDX: this.mouseDX,
      mouseDY: this.mouseDY,
      stickX: p.lookX,
      stickY: p.lookY,
    };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return look;
  }
}
