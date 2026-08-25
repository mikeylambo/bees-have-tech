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
  /** Use the active tech item. */
  use: boolean;
  /** Innate stinger jab. */
  sting: boolean;
  /** Secondary action of the active tech. */
  alt: boolean;
  /** Hold to open the tech radial. */
  radial: boolean;
  /** Y / Triangle — open the hive workshop when you're at the hive. */
  interact: boolean;
  /** D-pad, edge-detected upstream, for driving menus. */
  dpadUp: boolean;
  dpadDown: boolean;
  /** Start / Options — pause. The pad had no way to stop the game before. */
  start: boolean;
  /** Back / Select — hold to come home. X/Square is already `alt`. */
  back: boolean;
}

const EMPTY: PadState = {
  connected: false,
  moveX: 0, moveY: 0, lookX: 0, lookY: 0,
  ascend: 0, descend: 0, boost: false,
  use: false, sting: false, alt: false, radial: false,
  interact: false, dpadUp: false, dpadDown: false,
  start: false, back: false,
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

  /**
   * Haptics. On a pad this is the clearest "that connected" signal there is —
   * far better than a visual you're not looking at because you're watching the
   * bee. Silently no-ops on pads/browsers without an actuator.
   */
  rumble(strong: number, weak: number, durationMs: number) {
    const p = this.active();
    const actuator = (p as unknown as {
      vibrationActuator?: {
        playEffect: (type: string, params: Record<string, number>) => Promise<unknown>;
      };
    } | null)?.vibrationActuator;
    if (!actuator?.playEffect) return;
    actuator
      .playEffect('dual-rumble', {
        duration: durationMs,
        strongMagnitude: Math.min(1, Math.max(0, strong)),
        weakMagnitude: Math.min(1, Math.max(0, weak)),
      })
      .catch(() => {
        // Some pads reject overlapping effects — not worth surfacing.
      });
  }

  private active(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  read(deadzone: number, swapTriggers = false): PadState {
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
      ascend: swapTriggers ? btn(6) : btn(7),
      descend: swapTriggers ? btn(7) : btn(6),
      boost: pressed(0) || pressed(10), // A / left-stick click
      use: pressed(5), // RB — always the active tech, whatever it is
      sting: pressed(1), // B / Circle — innate, never remapped by tech
      alt: pressed(2), // X / Square
      radial: pressed(4), // LB held — opens the tech radial
      interact: pressed(3), // Y / Triangle — the workshop, at the hive
      dpadUp: pressed(12),
      dpadDown: pressed(13),
      start: pressed(9), // Start / Options
      back: pressed(8), // Back / Select / Share
    };
  }
}
