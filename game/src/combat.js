// SOLMAR STREETS — combat.
// One pistol, fully working: aim with the mouse, click to fire, R to reload, 12
// rounds a magazine. Shots are hitscan rays against enemies and the city's shootable
// meshes, with a tracer, a muzzle flash, a hit marker and damage numbers in the HUD.
// Enemies are the harbour crew: they take cover in range, close in, and shoot back
// with inaccuracy that grows with distance, so a fight is winnable but never free.

import * as THREE from 'three';
import { WEAPON } from './config.js';

const ENEMY_SHIRTS = [0x5a2e2e, 0x3a3a3a, 0x4a5a2e];

export function createCombat(scene, city, rng) {
  const enemies = [];
  const raycaster = new THREE.Raycaster();
  const tracers = [];
  let onPlayerShot = null;
  let onEnemyDown = null;

  const weapon = {
    ammo: WEAPON.magSize,
    reloading: false,
    reloadEndsAt: 0,
    lastShotAt: -99,
    flashUntil: 0,
  };

  function buildEnemy(x, z, name, hp = 100) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(ENEMY_SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.34), shirt);
    torso.position.y = 1.04;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.64;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.68, 0.25), pants);
    legL.position.set(-0.16, 0.34, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirt);
    armL.position.set(-0.42, 1.04, 0);
    const armR = armL.clone();
    armR.position.x = 0.42;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.42, 1.1, 0.3);
    group.add(torso, head, legL, legR, armL, armR, gun);
    group.position.set(x, 0, z);
    scene.add(group);
    const enemy = {
      group,
      name,
      pos: group.position,
      hp,
      maxHp: hp,
      alive: true,
      heading: 0,
      phase: rng.range(0, 6),
      nextShotAt: 0,
      strafeDir: rng.chance(0.5) ? 1 : -1,
      strafeUntil: 0,
    };
    enemies.push(enemy);
    return enemy;
  }

  function addTracer(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, length),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.lookAt(to);
    scene.add(mesh);
    tracers.push({ mesh, until: performance.now() + 70 });
  }

  function shootableMeshes() {
    return city.shootables;
  }

  return {
    weapon,
    enemies,
    setHandlers(handlers) {
      onPlayerShot = handlers.onPlayerShot ?? null;
      onEnemyDown = handlers.onEnemyDown ?? null;
    },
    spawnEnemy(x, z, name, hp) {
      return buildEnemy(x, z, name, hp);
    },
    clearEnemies() {
      for (const enemy of enemies) scene.remove(enemy.group);
      enemies.length = 0;
    },
    /** Fire the pistol from the camera. Returns 'hit' | 'miss' | 'blocked' | null. */
    fire(camera, now, playerPos) {
      if (weapon.reloading || now - weapon.lastShotAt < WEAPON.fireInterval) return null;
      if (weapon.ammo <= 0) return 'empty';
      weapon.ammo -= 1;
      weapon.lastShotAt = now;
      weapon.flashUntil = now + 0.06;
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = WEAPON.range;
      const origin = raycaster.ray.origin.clone();
      const direction = raycaster.ray.direction.clone();

      // Nearest enemy the ray passes close to.
      let hitEnemy = null;
      let hitDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const toEnemy = new THREE.Vector3().subVectors(enemy.pos, origin);
        const along = toEnemy.dot(direction);
        if (along < 1 || along > WEAPON.range) continue;
        const closest = origin.clone().addScaledVector(direction, along);
        const miss = closest.distanceTo(new THREE.Vector3(enemy.pos.x, 1.2, enemy.pos.z));
        if (miss < 1.1 && along < hitDist) {
          hitDist = along;
          hitEnemy = enemy;
        }
      }
      // Nearest building the ray hits — it blocks the shot.
      const wallHits = raycaster.intersectObjects(shootableMeshes(), false);
      const wallDist = wallHits.length ? wallHits[0].distance : Infinity;
      if (hitEnemy && hitDist < wallDist) {
        const hitPoint = origin.clone().addScaledVector(direction, hitDist);
        addTracer(origin, hitPoint);
        hitEnemy.hp -= WEAPON.damage;
        if (hitEnemy.hp <= 0) {
          hitEnemy.alive = false;
          hitEnemy.group.rotation.x = -Math.PI / 2;
          hitEnemy.group.position.y = 0.4;
          if (onEnemyDown) onEnemyDown(hitEnemy);
        }
        if (onPlayerShot) onPlayerShot('hit', hitEnemy);
        return 'hit';
      }
      const endPoint = origin.clone().addScaledVector(direction, Math.min(wallDist, WEAPON.range));
      addTracer(origin, endPoint);
      if (onPlayerShot) onPlayerShot(wallDist < WEAPON.range ? 'blocked' : 'miss', null);
      return wallDist < WEAPON.range ? 'blocked' : 'miss';
    },
    startReload(now) {
      if (weapon.reloading || weapon.ammo === WEAPON.magSize) return false;
      weapon.reloading = true;
      weapon.reloadEndsAt = now + WEAPON.reloadSeconds;
      return true;
    },
    /** Enemy AI: close in, strafe, and shoot back. Returns damage dealt to player. */
    update(dt, now, playerPos, playerAlive, onPlayerHit) {
      if (weapon.reloading && now >= weapon.reloadEndsAt) {
        weapon.reloading = false;
        weapon.ammo = WEAPON.magSize;
      }
      for (const tracer of [...tracers]) {
        if (performance.now() > tracer.until) {
          scene.remove(tracer.mesh);
          tracers.splice(tracers.indexOf(tracer), 1);
        }
      }
      let damage = 0;
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dx = playerPos.x - enemy.pos.x;
        const dz = playerPos.z - enemy.pos.z;
        const dist = Math.hypot(dx, dz);
        enemy.heading = Math.atan2(dx, dz);
        enemy.group.rotation.y = enemy.heading;
        if (playerAlive && dist < 42) {
          // Close to 12–18 m, then strafe while shooting.
          let moveX = 0;
          let moveZ = 0;
          if (dist > 18) {
            moveX = Math.sin(enemy.heading);
            moveZ = Math.cos(enemy.heading);
          } else if (dist < 10) {
            moveX = -Math.sin(enemy.heading);
            moveZ = -Math.cos(enemy.heading);
          }
          if (now > enemy.strafeUntil) {
            enemy.strafeDir *= -1;
            enemy.strafeUntil = now + rng.range(1.2, 2.6);
          }
          moveX += Math.cos(enemy.heading) * enemy.strafeDir * 0.6;
          moveZ += -Math.sin(enemy.heading) * enemy.strafeDir * 0.6;
          const len = Math.hypot(moveX, moveZ) || 1;
          enemy.pos.x += (moveX / len) * 3.4 * dt;
          enemy.pos.z += (moveZ / len) * 3.4 * dt;
          enemy.phase += dt * 6;
          const swing = Math.sin(enemy.phase) * 0.45;
          enemy.group.children[2].rotation.x = swing;
          enemy.group.children[3].rotation.x = -swing;
          if (now >= enemy.nextShotAt && dist < 38) {
            enemy.nextShotAt = now + rng.range(0.9, 1.6);
            const hitChance = Math.max(0.12, 0.5 - dist * 0.011);
            if (rng.next() < hitChance) {
              const shotDamage = rng.int(7, 12);
              damage += shotDamage;
              if (onPlayerHit) onPlayerHit(enemy, shotDamage);
            }
            // A visible enemy shot: tracer from the enemy toward the player.
            const from = new THREE.Vector3(enemy.pos.x, 1.3, enemy.pos.z);
            const to = new THREE.Vector3(playerPos.x, 1.2 + rng.range(-0.4, 0.6), playerPos.z);
            addTracer(from, to);
          }
        }
      }
      return damage;
    },
  };
}
