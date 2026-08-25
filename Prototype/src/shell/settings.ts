import { params } from '../core/tuning';

// PLAYER SETTINGS — deliberately not the tuning panel.
//
// The dev panel has ~80 numbers and exists to answer "does this feel right".
// This has four, and exists so somebody can turn the volume down. Keeping them
// apart is the difference between a game with options and a game with its
// guts on the screen.
//
// The list is short on purpose. Nothing in the SIMULATION is settable here:
// the moment a player can dial exposure down, the escalation ladder is
// optional, and the ladder is the game (CONCEPT_PILLARS §3).

const KEY = 'bees-settings-v1';

export interface PlayerSettings {
  volume: number; // 0..1
  sensitivity: number; // params.camera.sensitivity
  invertY: boolean;
  reducedMotion: boolean;
}

/** Sensitivity slider ends. The shipped value sits about a third along. */
export const SENS_MIN = 0.0008;
export const SENS_MAX = 0.005;

function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class Settings {
  readonly values: PlayerSettings;
  /** Fired after any change, so the shell can push it into the world. */
  onChange?: (v: PlayerSettings) => void;

  constructor() {
    this.values = {
      volume: 0.5,
      sensitivity: params.camera.sensitivity,
      invertY: params.camera.invertY,
      // Defaults to what the OS says, and stays overridable from here — the
      // media query is a starting position, not a verdict.
      reducedMotion: systemPrefersReducedMotion(),
    };
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<PlayerSettings>;
      if (typeof saved.volume === 'number') {
        this.values.volume = Math.max(0, Math.min(1, saved.volume));
      }
      if (typeof saved.sensitivity === 'number') {
        this.values.sensitivity = Math.max(SENS_MIN, Math.min(SENS_MAX, saved.sensitivity));
      }
      if (typeof saved.invertY === 'boolean') this.values.invertY = saved.invertY;
      if (typeof saved.reducedMotion === 'boolean') {
        this.values.reducedMotion = saved.reducedMotion;
      }
    } catch {
      // Unreadable settings are not worth a message. Shipped defaults, quietly.
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch { /* private mode; the session still honours them */ }
  }

  set<K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) {
    this.values[key] = value;
    this.apply();
    this.save();
  }

  /**
   * Push into the world. Two of the four ARE tuning params — the panel and
   * this screen are two doors onto the same number, which is the point: a
   * player setting that shadowed a tuning value would drift out of sync the
   * first time either moved.
   */
  apply() {
    params.camera.sensitivity = this.values.sensitivity;
    params.camera.invertY = this.values.invertY;
    this.onChange?.(this.values);
  }
}
