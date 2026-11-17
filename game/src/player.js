// SOLMAR STREETS — the player on foot.
// A simple third-person walker: WASD moves relative to the camera, Shift sprints, the
// mouse (pointer locked) turns the camera, and the body leans into its stride. The
// player is a small built-up figure — head, torso, legs, arms — so it reads at a glance
// on the street and in the minimap.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCollisions } from './city.js';

export function createPlayer(scene, startX, startZ) {
  const group = new THREE.Group();
  group.name = 'player';

  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6db8 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const shoes = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.66;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0xc96a3b }));
  cap.position.y = 1.9;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pants);
  legL.position.set(-0.16, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(torso, head, cap, legL, legR, armL, armR);
  scene.add(group);

  const player = {
    group,
    pos: new THREE.Vector3(startX, 0, startZ),
    heading: 0,
    cameraYaw: 0,
    cameraPitch: 0.32,
    speed: 0,
    hp: PLAYER.maxHp,
    alive: true,
    moving: false,
    walkPhase: 0,
    lastHurtAt: -99,
    /** Update movement from input; returns true while the player is walking. */
    update(dt, input, colliders, time) {
      if (!this.alive) return false;
      const delta = input.takeMouseDelta();
      this.cameraYaw -= delta.x * 0.0032;
      this.cameraPitch = Math.max(-0.1, Math.min(0.9, this.cameraPitch + delta.y * 0.0022));

      let forward = 0;
      let strafe = 0;
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) forward += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) forward -= 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) strafe -= 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) strafe += 1;
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const targetSpeed = (forward !== 0 || strafe !== 0)
        ? (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed)
        : 0;
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
      this.moving = this.speed > 0.4;

      if (this.moving) {
        const length = Math.hypot(forward, strafe) || 1;
        const fx = -Math.sin(this.cameraYaw);
        const fz = -Math.cos(this.cameraYaw);
        const rx = -fz;
        const rz = fx;
        const mx = (fx * forward + rx * strafe) / length;
        const mz = (fz * forward + rz * strafe) / length;
        this.pos.x += mx * this.speed * dt;
        this.pos.z += mz * this.speed * dt;
        this.heading = Math.atan2(mx, mz);
        this.walkPhase += dt * this.speed * 1.6;
      }
      resolveCollisions(this.pos, PLAYER.radius, colliders);
      this.pos.x = Math.max(-258, Math.min(258, this.pos.x));
      this.pos.z = Math.max(-258, Math.min(258, this.pos.z));

      group.position.copy(this.pos);
      group.rotation.y = this.heading;
      const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      torso.position.y = 1.05 + (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0);
      return this.moving;
    },
    /** Camera position for the third-person chase view. */
    cameraTarget() {
      const distance = 7.5;
      const height = 3.2 + this.cameraPitch * 4;
      return {
        x: this.pos.x + Math.sin(this.cameraYaw) * distance,
        y: height,
        z: this.pos.z + Math.cos(this.cameraYaw) * distance,
        lookX: this.pos.x,
        lookY: 1.6,
        lookZ: this.pos.z,
      };
    },
    takeDamage(amount, now) {
      if (!this.alive) return;
      this.hp = Math.max(0, this.hp - amount);
      this.lastHurtAt = now;
      if (this.hp <= 0) this.alive = false;
    },
    heal(amount) {
      this.hp = Math.min(PLAYER.maxHp, this.hp + amount);
    },
    respawn(x, z) {
      this.pos.set(x, 0, z);
      this.hp = PLAYER.maxHp;
      this.alive = true;
      this.speed = 0;
    },
  };
  group.position.copy(player.pos);
  return player;
}
