// SOLMAR STREETS — traffic.
// Civilian cars drive the road grid on their own: each one picks an intersection,
// drives to it, then picks another, slowing for the car ahead and stopping briefly at
// random corners so the streets never look like a conveyor belt. Traffic cars are
// part of the world the player can steal from only when they are parked — a moving
// car cannot be entered — and they swerve away from gunfire.

import { createCar } from './vehicles.js';

export function createTraffic(scene, city, rng) {
  const cars = [];
  const states = new Map();

  function randomNode() {
    return rng.int(0, city.nodes.length - 1);
  }

  function spawnOne() {
    const node = city.nodes[randomNode()];
    const neighbour = city.nodes[node.neighbours[rng.int(0, node.neighbours.length - 1)]];
    const car = createCar(scene, {
      x: node.x + rng.range(-2, 2),
      z: node.z + rng.range(-2, 2),
      heading: Math.atan2(neighbour.x - node.x, neighbour.z - node.z),
      owner: 'traffic',
      maxSpeed: rng.range(8, 12),
    });
    car.parked = false;
    cars.push(car);
    states.set(car.id, {
      target: node.neighbours[rng.int(0, node.neighbours.length - 1)],
      pause: 0,
      scared: 0,
    });
    return car;
  }

  function carAhead(car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let nearest = Infinity;
    for (const other of cars) {
      if (other === car || other.destroyed) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 12 && side < 2.4 && ahead < nearest) nearest = ahead;
    }
    return nearest;
  }

  return {
    cars,
    spawn(count) {
      for (let i = 0; i < count; i += 1) spawnOne();
    },
    /** Flee from a point (gunfire, explosion): cars speed up away from it. */
    scare(x, z) {
      for (const car of cars) {
        const state = states.get(car.id);
        if (!state) continue;
        const dx = car.pos.x - x;
        const dz = car.pos.z - z;
        if (dx * dx + dz * dz < 60 * 60) state.scared = 3;
      }
    },
    update(dt) {
      for (const car of cars) {
        if (car.destroyed) continue;
        const state = states.get(car.id);
        if (!state) continue;
        if (state.pause > 0) {
          state.pause -= dt;
          car.drive(dt, { throttle: 0, brake: 1, steer: 0 }, city.colliders);
          continue;
        }
        const target = city.nodes[state.target];
        const dx = target.x - car.pos.x;
        const dz = target.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3) {
          const node = city.nodes[state.target];
          state.target = node.neighbours[rng.int(0, node.neighbours.length - 1)];
          if (rng.chance(0.25)) state.pause = rng.range(0.5, 2);
          continue;
        }
        const wantedHeading = Math.atan2(dx, dz);
        let diff = wantedHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const ahead = carAhead(car);
        const throttle = ahead < 9 ? 0 : (state.scared > 0 ? 1 : 0.75);
        if (state.scared > 0) state.scared -= dt;
        car.drive(dt, {
          throttle,
          brake: ahead < 9 ? 1 : 0,
          steer: Math.max(-1, Math.min(1, diff * 2.2)),
        }, city.colliders);
      }
    },
    /** Remove a car from the street (stolen by the player, or destroyed). */
    remove(car) {
      const index = cars.indexOf(car);
      if (index !== -1) cars.splice(index, 1);
      states.delete(car.id);
    },
  };
}
