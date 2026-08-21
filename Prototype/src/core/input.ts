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
  private wheelDelta = 0;
  locked = false;
  padConnected = false;

  constructor(canvas: HTMLCanvasElement) {
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
      // requestPointerLock returns a promise in Chromium and can reject in
      // embedded/automated contexts — mouse-look just stays off until a real
      // user gesture succeeds.
      if (!this.locked) Promise.resolve(canvas.requestPointerLock()).catch(() => {});
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.updateHint();
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

    const a: Actions = {
      useHeld: use,
      usePressed: use && !this.prevUse,
      useReleased: !use && this.prevUse,
      altPressed: alt && !this.prevAlt,
      stingPressed: sting && !this.prevSting,
      radialHeld: radial,
      cycleDelta: this.wheelDelta,
    };
    this.prevUse = use;
    this.prevSting = sting;
    this.prevAlt = alt;
    this.wheelDelta = 0;
    return a;
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
