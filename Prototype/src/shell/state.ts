// THE SHELL — everything around the simulation, and nothing inside it.
//
// M0-M9 built a world you load into and never leave. This is the frame around
// it: somewhere to arrive, a way to stop, a way to come back.
//
// The one rule (SHELL_PLAN.md): the shell ROUTES INPUT AND SCALES TIME. It
// never edits the sim. Flight, camera, exposure arithmetic, quest content and
// the household are read and never written. That leaves exactly two levers,
// and both already existed before the shell did:
//
//   · the simDt multiplier in the frame loop — the radial and the workshop
//     already use it for slow-mo; pause is the same lever at zero
//   · the input line — the workshop already feeds the bee NEUTRAL_INPUT;
//     menus do the same
//
// This file owns the transitions and publishes them. It owns no DOM at all,
// which is what let the machine ship and be tested a whole pass before
// anything was drawn.

export type GameState = 'boot' | 'title' | 'playing' | 'paused';

/** Why we left `playing` — the pause menu says different things for each. */
export type PauseReason = 'player' | 'lostFocus';

export class Shell {
  private _state: GameState = 'boot';
  private _pauseReason: PauseReason = 'player';

  /** Fired on every transition, with the state we left. */
  onChange?: (to: GameState, from: GameState) => void;
  /** Asked to take pointer lock on entering `playing`. May be refused. */
  requestLock?: () => void;
  /** Asked to give it back on leaving. */
  releaseLock?: () => void;

  get state(): GameState {
    return this._state;
  }

  get pauseReason(): PauseReason {
    return this._pauseReason;
  }

  /** True only while the simulation should advance. */
  get running(): boolean {
    return this._state === 'playing';
  }

  /** True while any shell screen is up — menus swallow gameplay input. */
  get inMenu(): boolean {
    return this._state === 'title' || this._state === 'paused';
  }

  /** The world finished building. */
  ready() {
    this.go('title');
  }

  play() {
    if (this._state !== 'title' && this._state !== 'paused') return;
    this.go('playing');
  }

  pause(reason: PauseReason = 'player') {
    if (this._state !== 'playing') return;
    this._pauseReason = reason;
    this.go('paused');
  }

  resume() {
    if (this._state !== 'paused') return;
    this.go('playing');
  }

  toTitle() {
    if (this._state === 'boot') return;
    this.go('title');
  }

  /** Esc and Start both mean "the other one of playing/paused". */
  togglePause() {
    if (this._state === 'playing') this.pause('player');
    else if (this._state === 'paused') this.resume();
  }

  private go(to: GameState) {
    if (to === this._state) return;
    const from = this._state;
    this._state = to;
    // Pointer lock is a CONSEQUENCE of state, never a cause. Playing wants it;
    // everything else gives it back. Getting this backwards is how a pause menu
    // ends up with an invisible cursor.
    if (to === 'playing') this.requestLock?.();
    else if (from === 'playing') this.releaseLock?.();
    this.onChange?.(to, from);
  }
}
