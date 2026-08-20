// USB / Bluetooth controller support via the Gamepad API.
// Standard mapping (Xbox/PS/most USB pads):
//   axes 0,1 = left stick (move)   axes 2,3 = right stick (look)
//   b0 = A/Cross (ascend)  b1 = B/Circle (descend)
//   b6 = LT (descend)      b7 = RT (boost)
//   b4 = LB (descend)      b5 = RB (boost)
export interface PadState {
  connected: boolean;
  moveX: number; // strafe, -1..1
  moveY: number; // forward, -1..1 (stick up = +1 = forward)
  lookX: number; // -1..1
  lookY: number; // -1..1
  ascend: number; // 0..1
  descend: number; // 0..1
  boost: boolean;
  grapple: boolean;
  carry: boolean;
  throwBtn: boolean;
}

const EMPTY: PadState = {
  connected: false,
  moveX: 0, moveY: 0, lookX: 0, lookY: 0,
  ascend: 0, descend: 0, boost: false,
  grapple: false, carry: false, throwBtn: false,
};

function applyDeadzone(v: number, dz: number): number {
  if (Math.abs(v) < dz) return 0;
  // rescale so motion starts smoothly at the deadzone edge instead of jumping
  return Math.sign(v) * ((Math.abs(v) - dz) / (1 - dz));
}

export class Gamepads {
  private lastConnected = false;
  onConnectionChange?: (connected: boolean, id: string) => void;

  constructor() {
    window.addEventListener('gamepadconnected', (e) => {
      this.onConnectionChange?.(true, (e as GamepadEvent).gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.onConnectionChange?.(false, '');
    });
  }

  private active(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  read(deadzone: number): PadState {
    const p = this.active();
    if (!p) {
      if (this.lastConnected) this.lastConnected = false;
      return EMPTY;
    }
    this.lastConnected = true;

    const ax = (i: number) => applyDeadzone(p.axes[i] ?? 0, deadzone);
    const btn = (i: number) => {
      const b = p.buttons[i];
      if (!b) return 0;
      return typeof b === 'object' ? b.value : (b as number);
    };
    const pressed = (i: number) => btn(i) > 0.5;

    return {
      connected: true,
      moveX: ax(0),
      moveY: -ax(1), // stick up reports negative; forward should be positive
      lookX: ax(2),
      lookY: ax(3),
      // Triggers are analog — perfect for fine altitude control while hovering.
      ascend: btn(7),
      descend: btn(6),
      boost: pressed(0) || pressed(10), // A / left-stick click
      grapple: pressed(5), // RB
      carry: pressed(4), // LB
      throwBtn: pressed(2), // X / Square
    };
  }
}
