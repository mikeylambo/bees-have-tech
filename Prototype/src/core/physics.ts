import RAPIER from '@dimforge/rapier3d-compat';

// World units are abstract "yard units": the bee body is ~0.8u long,
// grass blades 2-4u tall, the whole yard ~120u across. Gravity is a feel
// constant for the toy props; the bee flies on its own forces (gravityScale 0).
export const WORLD_GRAVITY = -22;

export interface Physics {
  RAPIER: typeof RAPIER;
  world: RAPIER.World;
}

export async function initPhysics(): Promise<Physics> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: WORLD_GRAVITY, z: 0 });
  world.timestep = 1 / 60;
  return { RAPIER, world };
}
