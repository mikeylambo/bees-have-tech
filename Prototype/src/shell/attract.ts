import * as THREE from 'three';
import { M } from '../world/estateWorld';

// THE ATTRACT CAMERA — the title screen's background is the actual game.
//
// Not a still, not a video. The estate's best argument is that it is BIG, and
// a slow push up 80 m of driveway toward a nine-metre house makes that
// argument for free, using geometry that already exists and costs nothing
// extra to render.
//
// The path is the property's spine, which is also the first thing a player
// will fly: gate → drive → motor court → house. Somebody who has watched the
// title screen for ten seconds already knows where they are.

const m = (metres: number) => metres * M;

interface Waypoint {
  /** Camera position, metres. */
  eye: [number, number, number];
  /** What it is pointed at, metres. */
  at: [number, number, number];
  /** Seconds spent travelling INTO this waypoint. */
  time: number;
}

const PATH: Waypoint[] = [
  // Low at the gate, looking up the drive. The hive is in the pillar to the
  // left of frame — home, before you know it is home.
  { eye: [3.5, 2.2, -57], at: [-2, 1.5, -40], time: 0 },
  // Rising, running the drive north.
  { eye: [2.5, 5, -34], at: [-4, 3, -8], time: 13 },
  // Over the motor court, the fountain below.
  { eye: [-2, 11, 6], at: [-14, 6, 34], time: 13 },
  // Pulling up the house facade to the roofline.
  { eye: [-10, 15, 28], at: [-23, 9, 46], time: 11 },
  // Back out wide over the east lawn, so the loop reads as a lap of the
  // property rather than a rewind.
  { eye: [26, 26, -6], at: [0, 4, -30], time: 15 },
];

const _eye = new THREE.Vector3();
const _at = new THREE.Vector3();
const _eyeB = new THREE.Vector3();
const _atB = new THREE.Vector3();

export class AttractCamera {
  private t = 0;
  private leg = 1;
  /**
   * A slow camera drift is exactly the kind of motion that makes some people
   * ill. With reduced motion on, the shot holds still instead — the estate is
   * still the background, it just stops moving.
   */
  reducedMotion = false;

  reset() {
    this.t = 0;
    this.leg = 1;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const a = PATH[this.leg - 1];
    const b = PATH[this.leg];

    if (this.reducedMotion) {
      // One held vantage: high enough to read the whole spine at once.
      _eye.set(m(18), m(22), m(-34));
      _at.set(m(-10), m(6), m(20));
      camera.position.copy(_eye);
      camera.lookAt(_at);
      return;
    }

    this.t += dt;
    if (this.t >= b.time) {
      this.t -= b.time;
      this.leg = this.leg + 1 >= PATH.length ? 1 : this.leg + 1;
      return this.update(0, camera);
    }

    // Smoothstep between waypoints so each leg eases in and out — a linear
    // dolly that changes direction on a corner reads as a mistake.
    const k = this.t / b.time;
    const e = k * k * (3 - 2 * k);
    _eye.set(m(a.eye[0]), m(a.eye[1]), m(a.eye[2]));
    _eyeB.set(m(b.eye[0]), m(b.eye[1]), m(b.eye[2]));
    _at.set(m(a.at[0]), m(a.at[1]), m(a.at[2]));
    _atB.set(m(b.at[0]), m(b.at[1]), m(b.at[2]));
    camera.position.copy(_eye.lerp(_eyeB, e));
    camera.lookAt(_at.lerp(_atB, e));
  }
}
