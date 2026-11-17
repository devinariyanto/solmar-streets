// SOLMAR STREETS — bootstrap and the game loop.
// This file wires the modules together: the renderer and camera, the city, the
// player, traffic, pedestrians, police, combat and missions, the HUD and the save.
// It owns the screen state machine (title, playing, paused, mission screens,
// busted, wasted, ending), entering and leaving cars, shooting, and the save.
// Shot mode (?shot=cover|chase|mission|street) stages a deterministic scene instead
// of the title screen, for the screenshots.

import * as THREE from 'three';
import { createRng } from './rng.js';
import { WORLD, PLACES, ECONOMY, WEAPON, PLAYER } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') ?? 1) || 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 60, 180);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const rng = createRng(SEED);
const input = createInput(canvas);
const audio = createAudio();
const city = buildCity(scene, rng);

const saved = loadSave();
const G = {
  screen: 'title',
  time: 0,
  cash: saved?.cash ?? ECONOMY.startCash,
  items: saved?.items ?? [],
  mission: saved?.mission ?? 0,
  stats: saved?.stats ?? { missionsDone: 0, carsStolen: 0, shotsFired: 0, enemiesDown: 0, busted: 0, wasted: 0, playSeconds: 0 },
  currentCar: null,
  enterableCars: [],
  saveDirty: false,
  lastSaveAt: 0,
};

const player = createPlayer(scene, PLACES.garage.x + 6, PLACES.garage.z + 14);
const traffic = createTraffic(scene, city, rng);
const peds = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, rng);
const combat = createCombat(scene, city, rng);

const garageCar = createCar(scene, {
  x: 16, z: 116, heading: -Math.PI / 2, colour: 0xc96a3b, owner: 'garage', label: 'Mobil Bengkel',
});
G.enterableCars.push(garageCar);
for (const spot of city.parkingSpots) {
  const parked = createCar(scene, { x: spot.x, z: spot.z, heading: spot.heading, owner: 'civilian' });
  G.enterableCars.push(parked);
}
traffic.spawn(10);
peds.spawn(14);

const hud = createHud(document, {
  onStart: () => startGame(0, true),
  onContinue: () => startGame(G.mission, false),
  onResume: () => setScreen('playing'),
  onRestart: () => startGame(0, true),
  onQuitToTitle: () => setScreen('title'),
  onNextMission: () => {
    hud.hideScreens();
    setScreen('playing');
    missions.startNext();
  },
  onRetry: () => {
    hud.hideScreens();
    setScreen('playing');
    missions.retry();
  },
  onFreeRoam: () => {
    hud.hideScreens();
    setScreen('playing');
    hud.setObjective('Free roam — Solmar milikmu. Jelajahi, curi mobil, kabur dari polisi.');
  },
});
hud.wireButtons();

const ctx = {
  scene,
  city,
  player,
  police,
  combat,
  hud,
  audio,
  stats: G.stats,
  now: () => G.time,
  setScreen: (screen) => setScreen(screen),
  garageCar: () => garageCar,
  currentCar: () => G.currentCar,
  registerCar: (car) => G.enterableCars.push(car),
  unregisterCar: (car) => {
    const i = G.enterableCars.indexOf(car);
    if (i !== -1) G.enterableCars.splice(i, 1);
  },
  resetPlayerCar: () => {
    G.currentCar = null;
    garageCar.place(16, 116, -Math.PI / 2);
    garageCar.hp = 100;
  },
  addCash: (amount) => {
    G.cash += amount;
    G.saveDirty = true;
  },
  addItem: (item) => {
    G.items.push(item);
    G.saveDirty = true;
  },
  saveProgress: (nextMission) => {
    G.mission = Math.max(G.mission, nextMission);
    G.saveDirty = true;
    persistSave();
  },
  onStoryEnd: () => {
    G.mission = 4;
    G.saveDirty = true;
    persistSave();
    const minutes = Math.floor(G.stats.playSeconds / 60);
    hud.hideScreens();
    hud.showEnding(
      `5 misi selesai · $${G.cash.toLocaleString('en-US')} · ${G.stats.carsStolen} mobil dicuri · ` +
      `${G.stats.enemiesDown} musuh dikalahkan · ${G.stats.shotsFired} tembakan · ${minutes} menit bermain`,
    );
    setScreen('ending');
  },
  onMissionFailed: () => {
    // The failed screen is shown by the missions module; the loop just pauses input.
  },
};
const missions = createMissions(ctx);

police.setHandlers({
  onCrime: (level, reason) => {
    hud.message(`Wanted naik ke ${level}★ — ${reason}`, 'bad');
    hud.setWanted(level);
  },
  onBusted: () => {
    G.stats.busted += 1;
    G.saveDirty = true;
    persistSave();
    police.reset();
    audio.setSiren(false);
    if (G.currentCar) G.currentCar = null;
    player.respawn(PLACES.garage.x + 6, PLACES.garage.z + 14);
    hud.showBusted();
    setScreen('busted');
  },
});
combat.setHandlers({
  onPlayerShot: (result) => {
    if (result === 'hit') hud.showHitmarker();
  },
  onEnemyDown: (enemy) => {
    G.stats.enemiesDown += 1;
    hud.message(`${enemy.name} tumbang!`, 'good');
  },
});

function persistSave() {
  writeSave({ mission: G.mission, cash: G.cash, items: G.items, stats: G.stats });
  G.saveDirty = false;
  G.lastSaveAt = G.time;
}

function setScreen(screen) {
  G.screen = screen;
  if (screen === 'title') {
    hud.showScreen('screen-title');
    document.getElementById('btn-continue').classList.toggle('hidden', G.mission === 0 && G.stats.missionsDone === 0);
    audio.setEngine(false, 0);
    audio.setSiren(false);
    input.releaseLock();
  }
  if (screen === 'playing') {
    hud.hideScreens();
    audio.unlock();
  }
  if (screen === 'paused') hud.showScreen('screen-pause');
}

function startGame(missionIndex, fresh) {
  if (fresh) {
    G.cash = ECONOMY.startCash;
    G.items = [];
    G.stats = { missionsDone: 0, carsStolen: 0, shotsFired: 0, enemiesDown: 0, busted: 0, wasted: 0, playSeconds: 0 };
    ctx.stats = G.stats;
    G.mission = 0;
  }
  hud.hideScreens();
  setScreen('playing');
  audio.unlock();
  missions.start(missionIndex);
  hud.setCash(G.cash);
  hud.message('Selamat datang di Solmar!', 'good');
}

function nearestEnterableCar(maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of G.enterableCars) {
    if (car.destroyed) continue;
    const dist = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  G.currentCar = car;
  car.parked = false;
  audio.carDoor();
  if (car.owner === 'civilian') {
    G.stats.carsStolen += 1;
    police.addWanted(1, G.time, 'Mencuri mobil');
    hud.message('Mobil dicuri! Polisi mengejarmu!', 'bad');
    traffic.remove(car);
    const i = G.enterableCars.indexOf(car);
    if (i !== -1) G.enterableCars.splice(i, 1);
  } else {
    hud.message(`Naik ${car.label}`, 'info');
  }
  input.releaseLock();
}

function exitCar() {
  const car = G.currentCar;
  if (!car) return;
  G.currentCar = null;
  car.parked = true;
  // Step out on the car's left side.
  const sideX = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  player.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + sideZ * 2.2);
  player.cameraYaw = car.heading + Math.PI;
  audio.carDoor();
}

function updatePlaying(dt, activeInput) {
  G.time += dt;
  G.stats.playSeconds += dt;

  // --- Missions first: dialogs consume E/click before the car does. ---
  missions.update(dt, G.time, activeInput);
  const dialogOpen = missions.dialogOpen();

  // --- Enter / exit cars. ---
  if (!dialogOpen && G.screen === 'playing') {
    if (!G.currentCar) {
      const near = nearestEnterableCar(4);
      if (near) {
        hud.setPrompt(`Tekan E untuk naik ${near.label}`);
        if (activeInput.wasPressed('KeyE')) enterCar(near);
      }
    } else if (activeInput.wasPressed('KeyE')) {
      exitCar();
    }
  }

  // --- Pause, mute, reset. ---
  if (activeInput.wasPressed('Escape') || activeInput.wasPressed('KeyP')) {
    setScreen('paused');
    return;
  }
  if (activeInput.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    hud.message(muted ? 'Suara mati' : 'Suara hidup', 'info');
  }
  if (activeInput.wasPressed('KeyF') && G.currentCar) {
    const node = city.nodes[0];
    let best = node;
    let bestDist = Infinity;
    for (const candidate of city.nodes) {
      const d = (candidate.x - G.currentCar.pos.x) ** 2 + (candidate.z - G.currentCar.pos.z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    G.currentCar.place(best.x, best.z, 0);
    hud.message('Mobil di-reset ke jalan terdekat', 'info');
  }

  // --- Move the player or the car. ---
  if (G.currentCar) {
    const car = G.currentCar;
    const throttle = activeInput.isDown('KeyW') || activeInput.isDown('ArrowUp') ? 1 : 0;
    const brake = activeInput.isDown('KeyS') || activeInput.isDown('ArrowDown') ? 1 : 0;
    const steer = (activeInput.isDown('KeyA') || activeInput.isDown('ArrowLeft') ? -1 : 0)
      + (activeInput.isDown('KeyD') || activeInput.isDown('ArrowRight') ? 1 : 0);
    car.drive(dt, { throttle, brake, steer, handbrake: activeInput.isDown('Space') }, city.colliders);
    // Bumping traffic at speed is a crime the police notice.
    for (const other of traffic.cars) {
      if (other.destroyed) continue;
      const d = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
      if (d < 3 && Math.abs(car.speed) > 8) {
        other.takeDamage(30);
        police.addWanted(1, G.time, 'Tabrak lari');
      }
    }
    audio.setEngine(true, Math.abs(car.speed) / car.maxSpeed);
    hud.setSpeed(Math.abs(car.speed) * 3.6);
  } else {
    player.update(dt, activeInput, city.colliders, G.time);
    audio.setEngine(false, 0);
    hud.setSpeed(player.speed * 3.6);
    // Shooting, on foot only.
    if (!dialogOpen) {
      if (activeInput.clicked) {
        audio.unlock();
        input.requestLock();
      }
      if (activeInput.mouseHeld || activeInput.clicked) {
        const result = combat.fire(camera, G.time, player.pos);
        if (result === 'hit' || result === 'miss' || result === 'blocked') {
          G.stats.shotsFired += 1;
          audio.gunshot();
          traffic.scare(player.pos.x, player.pos.z);
          peds.scare(player.pos.x, player.pos.z);
          police.addWanted(1, G.time, 'Tembakan di jalan');
        } else if (result === 'empty') {
          combat.startReload(G.time);
          audio.reload();
        }
      }
      if (activeInput.wasPressed('KeyR') && combat.startReload(G.time)) audio.reload();
    }
  }

  // --- The living city. ---
  traffic.update(dt);
  peds.update(dt, [...traffic.cars, ...police.copCars, G.currentCar]);
  city.update(dt, G.time);
  const policeInfo = police.update(dt, G.time, G.currentCar ? G.currentCar.pos : player.pos, !!G.currentCar, G.currentCar);
  audio.setSiren(police.wanted > 0 && policeInfo.nearestCop < 90);

  // --- Combat: enemies shoot back, the player heals when safe. ---
  combat.update(dt, G.time, player.pos, player.alive, (enemy, amount) => {
    if (!player.alive) return;
    player.takeDamage(amount, G.time);
    audio.hurt();
  });
  if (player.alive && G.time - player.lastHurtAt > 6 && player.hp < PLAYER.maxHp) {
    player.heal(5 * dt);
  }
  if (!player.alive && G.screen === 'playing') {
    G.stats.wasted += 1;
    G.saveDirty = true;
    persistSave();
    audio.setSiren(false);
    audio.fail();
    hud.showWasted();
    setScreen('wasted');
    return;
  }

  // --- HUD. ---
  hud.setCash(G.cash);
  hud.setWanted(police.wanted);
  hud.setHealth(player.hp, PLAYER.maxHp);
  hud.setAmmo(combat.weapon.ammo, WEAPON.magSize, combat.weapon.reloading);
  hud.setObjective(missions.objectiveText());
  hud.showCrosshair(!G.currentCar && !dialogOpen);
  hud.drawMinimap({
    roads: WORLD.roadLines,
    city,
    playerX: G.currentCar ? G.currentCar.pos.x : player.pos.x,
    playerZ: G.currentCar ? G.currentCar.pos.z : player.pos.z,
    playerHeading: G.currentCar ? G.currentCar.heading : player.heading,
    policeCars: police.copCars,
    trafficCars: traffic.cars,
    markerPos: () => missions.markerPos(),
  });
  hud.update();

  if (G.saveDirty && G.time - G.lastSaveAt > 5) persistSave();

  // --- Camera. ---
  const target = G.currentCar ? G.currentCar.cameraTarget() : player.cameraTarget();
  const look = new THREE.Vector3(target.lookX, target.lookY, target.lookZ);
  const desired = new THREE.Vector3(target.x, target.y, target.z);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
  camera.lookAt(look);
}

let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (G.screen === 'playing') {
    updatePlaying(dt, input);
  } else if (G.screen === 'title') {
    // A slow orbit over downtown behind the title screen.
    const angle = now / 1000 * 0.05;
    camera.position.set(Math.sin(angle) * 170, 65, Math.cos(angle) * 170);
    camera.lookAt(0, 8, 0);
    city.update(dt, G.time);
    traffic.update(dt);
    peds.update(dt);
    hud.update();
  } else {
    hud.update();
  }
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Debug hook for headless verification: ?probe=1 exposes the live world.
if (params.get('probe')) {
  window.__probe = {
    city, player, traffic, peds, police, combat, missions, hud, G, garageCar, camera,
    step: (dt, fakeInput) => updatePlaying(dt, fakeInput),
    setScreen,
  };
}

// --- Shot mode: stage a deterministic scene, render it, signal readiness. ---
if (SHOT) {
  setScreen('playing');
  const shotObjectives = {
    cover: 'Pagi di Solmar — antar paket ke dermaga',
    chase: 'Kabur dari polisi! Wanted ★★★',
    mission: 'Kalahkan 2 penjaga gudang (0/2)',
    street: 'Pagi di Solmar — temui Raka di promenade',
  };
  stageShot(SHOT, {
    G, player, city, traffic, peds, police, combat, missions, hud, audio,
    garageCar,
    step: (dt, scripted) => updatePlaying(dt, scripted),
    render: () => renderer.render(scene, camera),
    camera,
  });
  hud.hideBanner();
  hud.setObjective(shotObjectives[SHOT] ?? 'Free roam — Solmar milikmu');
  if (SHOT === 'chase') hud.setWanted(3);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  setScreen('title');
  hud.setCash(G.cash);
  hud.setObjective('Pilih misi di menu (Misi 1 siap)');
  requestAnimationFrame(frame);
}
