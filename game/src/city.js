// SOLMAR STREETS — the city itself.
// Builds Solmar from a seed: ground, sea and beach, the road grid, downtown blocks,
// the harbour with its warehouses and containers, the promenade with palms, and the
// lighthouse on the north-east point. Also hands the rest of the game the collision
// boxes, the road graph traffic drives on, and the meshes bullets can hit.

import * as THREE from 'three';
import { WORLD, DISTRICTS, COLOURS, PLACES } from './config.js';

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cfc4ae';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = ((row * 7 + col * 3) % 5) < 2;
      ctx.fillStyle = lit ? '#ffe9a8' : '#5d7d99';
      ctx.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(30, 0, 4, 256);
  ctx.fillStyle = '#3a3d42';
  for (let y = 0; y < 256; y += 64) ctx.fillRect(30, y + 8, 4, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function box(w, h, d, colour, x, y, z, material = null) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material ?? new THREE.MeshLambertMaterial({ color: colour }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const shootables = [];
  const animated = { water: [], beacon: null, beaconLight: null };
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const windowTexture = makeWindowTexture();
  const roadTexture = makeRoadTexture();

  function addCollider(x0, z0, x1, z1) {
    colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  // --- Ground, sand and sea -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: COLOURS.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(48, WORLD.half * 2),
    new THREE.MeshLambertMaterial({ color: COLOURS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.beachX + 22, 0.01, 0);
  group.add(sand);

  const seaMat = new THREE.MeshLambertMaterial({ color: COLOURS.sea, transparent: true, opacity: 0.92 });
  const seaEast = new THREE.Mesh(new THREE.PlaneGeometry(120, WORLD.half * 2 + 80), seaMat);
  seaEast.rotation.x = -Math.PI / 2;
  seaEast.position.set(WORLD.beachX + 106, 0.05, 0);
  group.add(seaEast);
  animated.water.push(seaEast);
  const seaWest = new THREE.Mesh(new THREE.PlaneGeometry(60, WORLD.half * 2), seaMat.clone());
  seaWest.rotation.x = -Math.PI / 2;
  seaWest.position.set(WORLD.harbourX - 28, 0.05, 0);
  group.add(seaWest);
  animated.water.push(seaWest);

  // --- Roads ------------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture });
  for (const line of WORLD.roadLines) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.half * 2), roadMat.clone());
    vertical.material.map = roadTexture.clone();
    vertical.material.map.needsUpdate = true;
    vertical.material.map.repeat.set(1, 16);
    vertical.rotation.x = -Math.PI / 2;
    vertical.position.set(line, 0.02, 0);
    group.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.roadWidth), roadMat.clone());
    horizontal.material.map = roadTexture.clone();
    horizontal.material.map.needsUpdate = true;
    horizontal.material.map.repeat.set(16, 1);
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.02, line);
    group.add(horizontal);
  }

  // --- Road graph for traffic --------------------------------------------------
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of WORLD.roadLines) {
    for (const z of WORLD.roadLines) {
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z, neighbours: [] });
    }
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${node.x + dx * 80},${node.z + dz * 80}`;
      if (nodeIndex.has(key)) node.neighbours.push(nodeIndex.get(key));
    }
  }

  // --- Downtown blocks ---------------------------------------------------------
  const blockXs = [[-240, -166], [-154, -86], [-74, -6], [6, 74], [86, 154], [166, 196]];
  const blockZs = [[-240, -166], [-154, -86], [-74, -6], [6, 74], [86, 154], [166, 240]];
  const buildingMat = new THREE.MeshLambertMaterial({ map: windowTexture });
  for (const [bx0, bx1] of blockXs) {
    for (const [bz0, bz1] of blockZs) {
      // Harbour strip and beach strip are not downtown blocks.
      if (bx1 <= -166 || bx0 >= 196) continue;
      // The garage plot stays clear: the family garage sits here instead.
      const isGarageBlock = bx0 === 6 && bz0 === 86;
      const centreX = (bx0 + bx1) / 2;
      const centreZ = (bz0 + bz1) / 2;
      const downtown = Math.abs(centreX) < 100 && Math.abs(centreZ) < 100;
      const count = isGarageBlock ? 0 : rng.int(1, 2);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(18, Math.min(42, bx1 - bx0 - 8));
        const d = rng.range(18, Math.min(42, bz1 - bz0 - 8));
        const h = downtown ? rng.range(22, 58) : rng.range(8, 22);
        // Keep a 3 m pavement clear around every block so pedestrians never
        // clip through a facade.
        const x = Math.max(bx0 + 3 + w / 2, Math.min(bx1 - 3 - w / 2, centreX + (count === 2 ? (i === 0 ? -w * 0.55 : w * 0.55) : 0)));
        const z = Math.max(bz0 + 3 + d / 2, Math.min(bz1 - 3 - d / 2, centreZ + rng.range(-6, 6)));
        const colour = rng.pick(COLOURS.building);
        const material = buildingMat.clone();
        material.color = new THREE.Color(colour);
        material.map = windowTexture.clone();
        material.map.needsUpdate = true;
        material.map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        const building = box(w, h, d, colour, x, h / 2, z, material);
        group.add(building);
        shootables.push(building);
        addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        // A flat roof cap in a darker tone, so blocks read from above.
        const roof = box(w + 0.6, 0.6, d + 0.6, 0x6b655c, x, h + 0.3, z);
        group.add(roof);
      }
    }
  }

  // --- Family garage (player home) ---------------------------------------------
  const garage = box(26, 7, 18, 0xc96a3b, PLACES.garage.x, 3.5, PLACES.garage.z);
  group.add(garage);
  shootables.push(garage);
  addCollider(PLACES.garage.x - 13, PLACES.garage.z - 9, PLACES.garage.x + 13, PLACES.garage.z + 9);
  const garageDoor = box(16, 5, 0.4, 0x3c3f45, PLACES.garage.x, 2.5, PLACES.garage.z - 9.2);
  group.add(garageDoor);
  const garageSign = box(20, 2.2, 0.5, 0xf2e6c8, PLACES.garage.x, 7.6, PLACES.garage.z - 9.2);
  group.add(garageSign);

  // --- Harbour: warehouses, containers, cranes, piers ---------------------------
  const warehouseMat = new THREE.MeshLambertMaterial({ color: 0x8a7f6d });
  for (const [wx, wz, ww, wd] of [[-212, -64, 34, 22], [-212, 20, 30, 20], [-212, 110, 36, 24]]) {
    const warehouse = box(ww, 10, wd, 0x8a7f6d, wx, 5, wz, warehouseMat);
    group.add(warehouse);
    shootables.push(warehouse);
    addCollider(wx - ww / 2, wz - wd / 2, wx + ww / 2, wz + wd / 2);
    const roof = box(ww + 1, 1, wd + 1, 0x5d564a, wx, 10.5, wz);
    group.add(roof);
  }
  const containerColours = [0xb8452e, 0x2e6db8, 0x3f8f4f, 0xc9a227, 0x7a4a8f];
  for (let i = 0; i < 16; i += 1) {
    const cx = rng.range(-238, -186);
    const cz = rng.range(-150, 150);
    if (Math.abs(cz + 64) < 22 || Math.abs(cz - 20) < 20 || Math.abs(cz - 110) < 24) continue;
    if (Math.abs(cz - 60) < 14 && cx < -200) continue; // keep the pier delivery clear
    const container = box(12, 2.6, 2.6, rng.pick(containerColours), cx, 1.3, cz);
    container.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    group.add(container);
    addCollider(cx - 6, cz - 1.4, cx + 6, cz + 1.4);
  }
  // Two cranes over the docks.
  for (const cz of [-120, 90]) {
    const leg1 = box(1.5, 26, 1.5, 0xd8a020, -236, 13, cz - 5);
    const leg2 = box(1.5, 26, 1.5, 0xd8a020, -236, 13, cz + 5);
    const arm = box(1.5, 1.5, 34, 0xd8a020, -236, 25, cz);
    group.add(leg1, leg2, arm);
  }
  // Piers reaching into the western water.
  for (const pz of [-40, 60, 140]) {
    const pier = box(18, 1, 8, 0x7a6a52, -252, 0.5, pz);
    group.add(pier);
  }

  // --- Promenade: palms, benches, lamps -----------------------------------------
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let z = -170; z <= 170; z += 20) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), palmTrunk);
    trunk.position.set(206, 3.5, z);
    group.add(trunk);
    addCollider(205.4, z - 0.6, 206.6, z + 0.6);
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const frond = box(2.8, 0.22, 0.9, 0x3f8f4f, 206 + Math.cos((leaf / 5) * Math.PI * 2) * 1.3, 7.0, z + Math.sin((leaf / 5) * Math.PI * 2) * 1.3, palmLeaf);
      frond.rotateY((leaf / 5) * Math.PI * 2);
      frond.rotateZ(-0.3);
      group.add(frond);
    }
    if (z % 40 === 0) {
      const bench = box(2.4, 0.5, 0.8, 0x6b4f2a, 200, 0.5, z + 6);
      group.add(bench);
    }
  }

  // --- Street lamps along the main roads -----------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  for (const line of WORLD.roadLines) {
    for (const along of [-120, -40, 40, 120]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(line + 7.5, 3, along);
      group.add(pole);
      const head = box(1.2, 0.3, 0.4, 0xffe9a8, line + 7, 6.1, along);
      group.add(head);
    }
  }

  // --- Lighthouse on the north-east point -----------------------------------------
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(10, 16, 6, 8), new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
  rock.position.set(PLACES.lighthouse.x, 3, PLACES.lighthouse.z);
  group.add(rock);
  addCollider(PLACES.lighthouse.x - 12, PLACES.lighthouse.z - 12, PLACES.lighthouse.x + 12, PLACES.lighthouse.z + 12);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 22, 12), new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  tower.position.set(PLACES.lighthouse.x, 17, PLACES.lighthouse.z);
  group.add(tower);
  shootables.push(tower);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 3, 12), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  lampRoom.position.set(PLACES.lighthouse.x, 29, PLACES.lighthouse.z);
  group.add(lampRoom);
  const beacon = new THREE.PointLight(0xffe9a8, 60, 120, 1.6);
  beacon.position.set(PLACES.lighthouse.x, 29, PLACES.lighthouse.z);
  scene.add(beacon);
  animated.beacon = beacon;
  const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  beaconMesh.position.set(PLACES.lighthouse.x, 29, PLACES.lighthouse.z);
  group.add(beaconMesh);
  animated.beaconLight = beaconMesh;

  // --- Boundary: low walls at the map edge, except where the sea is ----------------
  addCollider(-262, -262, -262, 262);
  addCollider(262, -262, 262, 262);
  addCollider(-262, -262, 262, -262);
  addCollider(-262, 262, 262, 262);

  // --- Lighting --------------------------------------------------------------------
  const sun = new THREE.DirectionalLight(COLOURS.sun, 2.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5c, 1.1));
  scene.fog = new THREE.Fog(COLOURS.fog, 260, 620);
  scene.background = new THREE.Color(COLOURS.sky);

  return {
    group,
    colliders,
    shootables,
    nodes,
    animated,
    /** Parked-car spots: kerbside bays along the grid roads. */
    parkingSpots: [
      { x: 88, z: -104, heading: Math.PI / 2 },
      { x: -88, z: 104, heading: -Math.PI / 2 },
      { x: 168, z: 40, heading: 0 },
      { x: -168, z: -40, heading: Math.PI },
      { x: 40, z: -168, heading: Math.PI / 2 },
      { x: -40, z: 168, heading: -Math.PI / 2 },
    ],
    update(dt, time) {
      for (const water of animated.water) {
        water.position.y = 0.05 + Math.sin(time * 0.7) * 0.06;
      }
      if (animated.beaconLight) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
        animated.beaconLight.material.color.setRGB(1, 0.95 * pulse + 0.05, 0.6 * pulse);
      }
    },
  };
}

/** Push a circle (position + radius) out of every collider it overlaps. */
export function resolveCollisions(pos, radius, colliders) {
  for (const box of colliders) {
    const closestX = Math.max(box.x0, Math.min(pos.x, box.x1));
    const closestZ = Math.max(box.z0, Math.min(pos.z, box.z1));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = closestX + (dx / dist) * radius;
      pos.z = closestZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pushLeft = pos.x - box.x0 + radius;
      const pushRight = box.x1 - pos.x + radius;
      const pushUp = pos.z - box.z0 + radius;
      const pushDown = box.z1 - pos.z + radius;
      const smallest = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (smallest === pushLeft) pos.x = box.x0 - radius;
      else if (smallest === pushRight) pos.x = box.x1 + radius;
      else if (smallest === pushUp) pos.z = box.z0 - radius;
      else pos.z = box.z1 + radius;
    }
  }
}

/** True when the point sits inside any collider (used for spawn validation). */
export function pointInColliders(x, z, colliders) {
  for (const box of colliders) {
    if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) return true;
  }
  return false;
}
