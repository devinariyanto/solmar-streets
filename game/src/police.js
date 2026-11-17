// SOLMAR STREETS — the wanted system and the police.
// Crime raises stars; the police respond in proportion. Cop cars spawn on the road
// grid and chase the player's car, ramming it; foot cops chase the player on foot and
// arrest them if they stay close. Breaking line of sight and staying quiet lets the
// heat die down — hiding is a real mechanic, not a timer on the HUD.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar } from './vehicles.js';

export function createPolice(scene, city, rng) {
  const cops = [];
  const footCops = [];
  let wanted = 0;
  let lastCrimeAt = -999;
  let unseenSince = 0;
  let decayTimer = 0;
  let bustedTimer = 0;
  let onCrime = null;
  let onBusted = null;

  function nearestRoadNode(x, z) {
    let best = city.nodes[0];
    let bestDist = Infinity;
    for (const node of city.nodes) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  function spawnCopCar(playerPos) {
    // Spawn two intersections away so the siren arrives before the car does.
    const candidates = city.nodes.filter((node) => {
      const d = Math.hypot(node.x - playerPos.x, node.z - playerPos.z);
      return d > 90 && d < 220;
    });
    const node = candidates.length ? rng.pick(candidates) : city.nodes[0];
    const car = createCar(scene, {
      x: node.x, z: node.z, heading: 0, isPolice: true, owner: 'police', maxSpeed: 36,
    });
    car.parked = false;
    cops.push(car);
    return car;
  }

  function spawnFootCop(playerPos) {
    const angle = rng.range(0, Math.PI * 2);
    const x = playerPos.x + Math.cos(angle) * rng.range(18, 30);
    const z = playerPos.z + Math.sin(angle) * rng.range(18, 30);
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1d2a55 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.32), navy);
    torso.position.y = 1.03;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
    head.position.y = 1.62;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), navy);
    cap.position.y = 1.84;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), navy);
    legL.position.set(-0.15, 0.33, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    group.add(torso, head, cap, legL, legR);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { group, pos: group.position, heading: 0, phase: 0, hp: 100, down: false };
    footCops.push(cop);
    return cop;
  }

  function clearCops() {
    for (const car of cops) car.remove();
    cops.length = 0;
    for (const cop of footCops) scene.remove(cop.group);
    footCops.length = 0;
  }

  return {
    get wanted() {
      return wanted;
    },
    get copCars() {
      return cops;
    },
    get footCops() {
      return footCops;
    },
    setHandlers(handlers) {
      onCrime = handlers.onCrime ?? null;
      onBusted = handlers.onBusted ?? null;
    },
    addWanted(amount, now, reason) {
      if (amount <= 0) return;
      const before = wanted;
      wanted = Math.min(WANTED.max, wanted + amount);
      lastCrimeAt = now;
      unseenSince = 0;
      if (wanted > before && onCrime) onCrime(wanted, reason);
    },
    setWanted(level, now) {
      wanted = Math.max(0, Math.min(WANTED.max, level));
      lastCrimeAt = now;
      unseenSince = 0;
    },
    reset() {
      wanted = 0;
      lastCrimeAt = -999;
      unseenSince = 0;
      decayTimer = 0;
      bustedTimer = 0;
      clearCops();
    },
    /** One frame of pursuit, decay and arrest logic. */
    update(dt, now, playerPos, playerInCar, playerCar) {
      const wantedCars = wanted >= 1 ? Math.min(wanted, 3) : 0;
      const wantedFoot = wanted >= 2 ? Math.min(wanted - 1, 2) : 0;
      while (cops.length < wantedCars) spawnCopCar(playerPos);
      while (footCops.length < wantedFoot) spawnFootCop(playerPos);

      let nearestCop = Infinity;
      for (const car of cops) {
        const dx = playerPos.x - car.pos.x;
        const dz = playerPos.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        nearestCop = Math.min(nearestCop, dist);
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const throttle = dist > 8 ? 1 : 0.6;
        car.drive(dt, { throttle, brake: 0, steer: Math.max(-1, Math.min(1, diff * 2.5)) }, city.colliders);
        // A cop car that catches the player's car rams it and slows it down.
        if (playerInCar && playerCar && dist < 4.5) {
          playerCar.speed *= Math.max(0, 1 - dt * 1.6);
          playerCar.takeDamage(2 * dt);
        }
      }
      for (const cop of footCops) {
        if (cop.down) continue;
        const dx = playerPos.x - cop.pos.x;
        const dz = playerPos.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        nearestCop = Math.min(nearestCop, dist);
        cop.heading = Math.atan2(dx, dz);
        const speed = dist > 3 ? 5.6 : 0;
        cop.pos.x += Math.sin(cop.heading) * speed * dt;
        cop.pos.z += Math.cos(cop.heading) * speed * dt;
        cop.phase += dt * speed * 2;
        cop.group.rotation.y = cop.heading;
        const swing = Math.sin(cop.phase) * 0.5;
        cop.group.children[3].rotation.x = swing;
        cop.group.children[4].rotation.x = -swing;
      }

      // Arrest: a foot cop stays within arm's reach of a player on foot.
      if (!playerInCar && nearestCop < 3.2 && wanted > 0) {
        bustedTimer += dt;
        if (bustedTimer > 2.2 && onBusted) {
          bustedTimer = 0;
          onBusted();
        }
      } else if (!playerInCar && playerCar && playerCar.speed < 1 && nearestCop < 5 && wanted > 0) {
        bustedTimer += dt;
        if (bustedTimer > 3 && onBusted) {
          bustedTimer = 0;
          onBusted();
        }
      } else {
        bustedTimer = Math.max(0, bustedTimer - dt * 2);
      }

      // Heat decay: quiet + unseen for a while, then stars fall one by one.
      if (wanted > 0) {
        if (nearestCop > 55 && now - lastCrimeAt > WANTED.decaySeconds) {
          unseenSince += dt;
          if (unseenSince > WANTED.hideSeconds) {
            decayTimer += dt;
            if (decayTimer > 6) {
              decayTimer = 0;
              wanted -= 1;
              unseenSince = 0;
              while (cops.length > Math.min(wanted, 3)) cops.pop().remove();
              while (footCops.length > Math.max(0, Math.min(wanted - 1, 2))) {
                const cop = footCops.pop();
                scene.remove(cop.group);
              }
            }
          }
        } else {
          unseenSince = 0;
          decayTimer = 0;
        }
      } else if (cops.length > 0 || footCops.length > 0) {
        clearCops();
      }
      return { nearestCop, bustedIn: bustedTimer > 0 ? Math.max(0, 2.2 - bustedTimer) : 0 };
    },
  };
}
