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
  grappleHeld: boolean;
  grapplePressed: boolean;
  grappleReleased: boolean;
  carryHeld: boolean;
  carryPressed: boolean;
  carryReleased: boolean;
  throwPressed: boolean;
}

export class Input {
  private keys = new Set<string>();
  private pads = new Gamepads();
  private mouseDX = 0;
  private mouseDY = 0;
  private mouseButtons = new Set<number>();
  private prevGrapple = false;
  private prevCarry = false;
  private prevThrow = false;
  locked = false;
  padConnected = false;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) e.preventDefault();
      this.mouseButtons.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
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
    const p = this.pads.read(params.pad.deadzone);
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
    const p = this.pads.read(params.pad.deadzone);
    const grapple = this.mouseButtons.has(0) || this.keys.has('KeyE') || p.grapple;
    const carry = this.mouseButtons.has(2) || this.keys.has('KeyQ') || p.carry;
    const thrown = this.keys.has('KeyF') || p.throwBtn;

    const a: Actions = {
      grappleHeld: grapple,
      grapplePressed: grapple && !this.prevGrapple,
      grappleReleased: !grapple && this.prevGrapple,
      carryHeld: carry,
      carryPressed: carry && !this.prevCarry,
      carryReleased: !carry && this.prevCarry,
      throwPressed: thrown && !this.prevThrow,
    };
    this.prevGrapple = grapple;
    this.prevCarry = carry;
    this.prevThrow = thrown;
    return a;
  }

  // Consume accumulated look input for this frame.
  takeLook(): LookDelta {
    const p = this.pads.read(params.pad.deadzone);
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
