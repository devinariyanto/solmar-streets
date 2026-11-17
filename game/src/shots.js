// SOLMAR STREETS — screenshot staging.
// Each named shot plays the real game forward from a fresh world for a fixed number
// of steps, steered by a tiny scripted driver, so the frame is what a short session
// really looks like — and the same seed always gives the same frame. The four shots:
// the cover (driving the promenade at golden hour), a police chase downtown, a
// harbour firefight mid-mission, and the player on foot among traffic and pedestrians.

import { PLACES } from './config.js';

/** A fake input object with the same interface the game loop reads. */
function makeScriptedInput() {
  const down = new Set();
  return {
    keys: down,
    setDown(code, value) {
      if (value) down.add(code);
      else down.delete(code);
    },
    isDown(code) {
      return down.has(code);
    },
    wasPressed() {
      return false;
    },
    takeMouseDelta() {
      return { x: 0, y: 0 };
    },
    get mouseHeld() {
      return false;
    },
    get clicked() {
      return false;
    },
  };
}

/** Steer a car toward a point: returns {throttle, brake, steer} for one step. */
function driveToward(car, x, z) {
  const dx = x - car.pos.x;
  const dz = z - car.pos.z;
  const wanted = Math.atan2(dx, dz);
  let diff = wanted - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, diff * 2.4)) };
}

const STEP = 1 / 60;

export function stageShot(name, game) {
  const { G, player, city, traffic, peds, police, combat, missions, hud, garageCar } = game;
  const scripted = makeScriptedInput();
  const stepWorld = (count, drive) => {
    for (let i = 0; i < count; i += 1) {
      if (drive) drive();
      game.step(STEP, scripted);
    }
  };

  if (name === 'chase') {
    // Wanted 3, two cop cars on the tail, driving north through downtown.
    const car = garageCar;
    car.place(0, 60, Math.PI);
    G.currentCar = car;
    police.setWanted(3, 0);
    hud.setObjective('Kabur dari polisi! Wanted ★★★');
    hud.setWanted(3);
    stepWorld(60, () => {
      const d = driveToward(car, 0, -160);
      scripted.setDown('KeyW', d.throttle > 0);
      scripted.setDown('KeyA', d.steer < -0.1);
      scripted.setDown('KeyD', d.steer > 0.1);
    });
    // Pull the pursuing cars in flanking the player, so the chase is visible in frame.
    police.copCars.forEach((cop, i) => {
      cop.place(car.pos.x + (i === 0 ? -5 : 5), car.pos.z - 3 - i * 2, car.heading);
    });
    // Only a few frames more: any longer and the pursuit AI converges onto the
    // player's exact spot and hides behind the player's own car.
    stepWorld(15, () => {
      const d = driveToward(car, 0, -160);
      scripted.setDown('KeyW', d.throttle > 0);
      scripted.setDown('KeyA', d.steer < -0.1);
      scripted.setDown('KeyD', d.steer > 0.1);
    });
    return;
  }

  if (name === 'mission') {
    // Mid-fight at the harbour warehouse: the player on foot, two guards ahead.
    missions.start(2);
    player.respawn(-172, -40);
    player.cameraYaw = 0.84;
    combat.spawnEnemy(-190, -56, 'Penjaga 1');
    combat.spawnEnemy(-190, -74, 'Penjaga 2');
    hud.setObjective('Kalahkan 2 penjaga gudang (0/2)');
    stepWorld(150);
    return;
  }

  if (name === 'street') {
    // On foot downtown, walking north up the middle of the road past traffic
    // and pedestrians.
    player.respawn(0, 60);
    player.cameraYaw = 0;
    hud.setObjective('Pagi di Solmar — temui Raka di promenade');
    // Bring two traffic cars and two pedestrians into the frame.
    if (traffic.cars[0]) traffic.cars[0].place(-2, 20, 0);
    if (traffic.cars[1]) traffic.cars[1].place(2, 10, Math.PI);
    if (peds.list[0]) {
      peds.list[0].pos.set(8.5, 0, 20);
      peds.list[0].target = { x: 8.5, z: 70 };
    }
    if (peds.list[1]) {
      peds.list[1].pos.set(-8.5, 0, 30);
      peds.list[1].target = { x: -8.5, z: -20 };
    }
    stepWorld(120, () => {
      scripted.setDown('KeyW', true);
    });
    return;
  }

  // Default: the cover. Driving east along the northern road toward the sea,
  // the city on both sides and the lighthouse ahead, HUD and minimap visible.
  const car = garageCar;
  car.place(0, -160, Math.PI / 2);
  G.currentCar = car;
  hud.setObjective('Pagi di Solmar — antar paket ke dermaga');
  stepWorld(60, () => {
    const d = driveToward(car, 200, -160);
    scripted.setDown('KeyW', d.throttle > 0);
    scripted.setDown('KeyA', d.steer < -0.1);
    scripted.setDown('KeyD', d.steer > 0.1);
  });
  stepWorld(240, () => {
    const d = driveToward(car, 200, -160);
    scripted.setDown('KeyW', d.throttle > 0);
    scripted.setDown('KeyA', d.steer < -0.1);
    scripted.setDown('KeyD', d.steer > 0.1);
  });
}
