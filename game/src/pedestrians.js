// SOLMAR STREETS — pedestrians.
// People walk the pavements of Solmar: along the road edges, across the promenade and
// around the harbour, turning at corners, pausing to look at the sea. They react to
// the player — they step aside for a speeding car, and they run from gunfire. A
// pedestrian is a small built-up figure with its own shirt colour and walk cycle.

import * as THREE from 'three';
import { WORLD } from './config.js';

const SHIRTS = [0xd85a4a, 0x4a8fd8, 0xe8c84a, 0x7a4a8f, 0x3f8f4f, 0xe8e8e8, 0x222222, 0xd88a4a];

export function createPedestrians(scene, city, rng) {
  const peds = [];

  function buildFigure(shirtColour) {
    const group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColour });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.68, 0.3), shirt);
    torso.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.y = 1.56;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
    legL.position.set(-0.14, 0.31, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.17), shirt);
    armL.position.set(-0.36, 1.0, 0);
    const armR = armL.clone();
    armR.position.x = 0.36;
    group.add(torso, head, legL, legR, armL, armR);
    group.userData.parts = { legL, legR, armL, armR };
    return group;
  }

  function randomWalkTarget() {
    // Walk along a road edge or the promenade.
    if (rng.chance(0.35)) {
      return { x: 206 + rng.range(-4, 4), z: rng.range(-170, 170) };
    }
    const road = rng.pick(WORLD.roadLines);
    if (rng.chance(0.5)) return { x: road + 8.5, z: rng.range(-160, 160) };
    return { x: rng.range(-160, 160), z: road + 8.5 };
  }

  function spawnOne() {
    const target = randomWalkTarget();
    const figure = buildFigure(rng.pick(SHIRTS));
    const x = target.x + rng.range(-30, 30);
    const z = target.z + rng.range(-30, 30);
    figure.position.set(x, 0, z);
    scene.add(figure);
    const ped = {
      figure,
      pos: figure.position,
      heading: rng.range(0, Math.PI * 2),
      target,
      speed: rng.range(1.1, 1.8),
      phase: rng.range(0, 6),
      fleeing: 0,
      fleeFrom: null,
    };
    peds.push(ped);
    return ped;
  }

  return {
    list: peds,
    spawn(count) {
      for (let i = 0; i < count; i += 1) spawnOne();
    },
    /** Everyone near a bang runs away from it. */
    scare(x, z) {
      for (const ped of peds) {
        const dx = ped.pos.x - x;
        const dz = ped.pos.z - z;
        if (dx * dx + dz * dz < 45 * 45) {
          ped.fleeing = rng.range(2, 4);
          ped.fleeFrom = { x, z };
        }
      }
    },
    update(dt, cars = []) {
      for (const ped of peds) {
        let heading;
        let speed = ped.speed;
        // Step out of the way of a car that is about to run them over.
        let dodge = null;
        for (const car of cars) {
          if (!car || car.destroyed) continue;
          const dx = ped.pos.x - car.pos.x;
          const dz = ped.pos.z - car.pos.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 81) {
            dodge = { x: dx, z: dz };
            if (d2 < 6.8) {
              // Shoved out of the car's path: land on the car's flank and run.
              const len = Math.sqrt(d2);
              let pushX = len > 0.5 ? dx / len : Math.cos(car.heading);
              let pushZ = len > 0.5 ? dz / len : -Math.sin(car.heading);
              ped.pos.x = car.pos.x + pushX * 2.8;
              ped.pos.z = car.pos.z + pushZ * 2.8;
              ped.fleeing = Math.max(ped.fleeing, 1.5);
              ped.fleeFrom = { x: car.pos.x, z: car.pos.z };
            }
            break;
          }
        }
        if (dodge) {
          heading = Math.atan2(dodge.x, dodge.z);
          speed = 4.2;
        } else if (ped.fleeing > 0) {
          ped.fleeing -= dt;
          const dx = ped.pos.x - ped.fleeFrom.x;
          const dz = ped.pos.z - ped.fleeFrom.z;
          heading = Math.atan2(dx, dz);
          speed = 4.6;
        } else {
          const dx = ped.target.x - ped.pos.x;
          const dz = ped.target.z - ped.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2) {
            ped.target = randomWalkTarget();
            continue;
          }
          heading = Math.atan2(dx, dz);
        }
        let diff = heading - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        ped.pos.x += Math.sin(ped.heading) * speed * dt;
        ped.pos.z += Math.cos(ped.heading) * speed * dt;
        ped.pos.x = Math.max(-250, Math.min(250, ped.pos.x));
        ped.pos.z = Math.max(-250, Math.min(250, ped.pos.z));
        ped.phase += dt * speed * 2.2;
        ped.figure.rotation.y = ped.heading;
        const swing = Math.sin(ped.phase) * 0.5;
        const parts = ped.figure.userData.parts;
        parts.legL.rotation.x = swing;
        parts.legR.rotation.x = -swing;
        parts.armL.rotation.x = -swing * 0.7;
        parts.armR.rotation.x = swing * 0.7;
      }
    },
  };
}
