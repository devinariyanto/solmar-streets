// SOLMAR STREETS — cars.
// Every car in Solmar is built by the same factory: a low body, a cabin, four wheels
// and headlights, in a palette of street colours, with a police livery variant. The
// driving model is arcade on purpose — throttle, brake and steering that scale with
// speed, a handbrake slide, and a reset for a flipped or stuck car — so driving feels
// good within the first ten seconds and never strands the player.

import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCollisions } from './city.js';

const STREET_COLOURS = [0xb8452e, 0x2e6db8, 0xd8c25a, 0x3f8f4f, 0xeeeeee, 0x222222, 0x7a4a8f, 0x2fa39a, 0xc96a3b];

function buildCarMesh(colour, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d2a33 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141414 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.0), paint);
  hood.position.set(0, 0.86, 1.7);
  group.add(body, cabin, hood);

  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightL.position.set(-0.28, 1.62, -0.2);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    lightR.position.set(0.28, 1.62, -0.2);
    group.add(lightL, lightR);
    group.userData.flashers = [lightL, lightR];
  }

  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  headL.position.set(-0.62, 0.62, 2.21);
  const headR = headL.clone();
  headR.position.x = 0.62;
  group.add(headL, headR);

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

let carCounter = 0;

export function createCar(scene, options) {
  const {
    x = 0, z = 0, heading = 0, colour = null, isPolice = false,
    owner = 'civilian', maxSpeed = CAR.maxSpeed, label = null,
  } = options;
  carCounter += 1;
  const paint = colour ?? STREET_COLOURS[carCounter % STREET_COLOURS.length];
  const mesh = buildCarMesh(paint, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);

  const car = {
    id: carCounter,
    mesh,
    label: label ?? `Mobil ${carCounter}`,
    owner,
    isPolice,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    hp: 100,
    maxSpeed,
    colour: paint,
    parked: owner !== 'traffic',
    /** Drive with arcade physics. `drive` is {throttle, brake, steer, handbrake}. */
    drive(dt, drive, colliders) {
      const steerTarget = (drive.steer ?? 0) * CAR.steerMax;
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      if (drive.throttle > 0) this.speed += CAR.accel * drive.throttle * dt;
      if (drive.brake > 0) {
        if (this.speed > 0.5) this.speed -= CAR.brake * drive.brake * dt;
        else this.speed -= CAR.accel * 0.6 * dt; // reversing
      }
      if (!drive.throttle && !drive.brake) this.speed -= Math.sign(this.speed) * 6 * dt;
      if (drive.handbrake) this.speed -= Math.sign(this.speed) * 22 * dt;
      const limit = drive.handbrake ? this.maxSpeed * 0.7 : this.maxSpeed;
      this.speed = Math.max(-CAR.reverseMax, Math.min(limit, this.speed));
      if (Math.abs(this.speed) < 0.08 && !drive.throttle && !drive.brake) this.speed = 0;

      const turnRate = this.steer * (this.speed / 9);
      this.heading += turnRate * dt * (this.speed < 0 ? -1 : 1);
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      this.pos.x += fx * this.speed * dt;
      this.pos.z += fz * this.speed * dt;
      resolveCollisions(this.pos, CAR.radius, colliders);
      this.pos.x = Math.max(-256, Math.min(256, this.pos.x));
      this.pos.z = Math.max(-256, Math.min(256, this.pos.z));
      this.syncMesh();
    },
    /** Teleport the car upright to a spot (used for resets and spawns). */
    place(x, z, heading) {
      this.pos.set(x, 0, z);
      this.heading = heading;
      this.speed = 0;
      this.steer = 0;
      this.syncMesh();
    },
    syncMesh() {
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
      const spin = this.speed * 0.06;
      for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
      if (this.mesh.userData.flashers) {
        const phase = Math.floor(performance.now() / 260) % 2 === 0;
        this.mesh.userData.flashers[0].material.color.setHex(phase ? 0xff2222 : 0x550000);
        this.mesh.userData.flashers[1].material.color.setHex(phase ? 0x000055 : 0x2244ff);
      }
    },
    /** Chase camera behind the car. */
    cameraTarget() {
      const back = 10;
      const height = 4.2;
      return {
        x: this.pos.x - Math.sin(this.heading) * back,
        y: height,
        z: this.pos.z - Math.cos(this.heading) * back,
        lookX: this.pos.x + Math.sin(this.heading) * 6,
        lookY: 1.4,
        lookZ: this.pos.z + Math.cos(this.heading) * 6,
      };
    },
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      return this.hp <= 0;
    },
    get destroyed() {
      return this.hp <= 0;
    },
    remove() {
      scene.remove(this.mesh);
    },
  };
  return car;
}
