// SOLMAR STREETS — the five missions and the story.
// A courier in the coastal city of Solmar takes on the harbour extortion ring to save
// the family garage. Each mission is a short list of steps — go somewhere, talk to
// someone, steal or deliver a car, win a fight, pick something up, escape — with a
// clear objective on screen, a beacon in the world, a retry when it fails, and a
// reward when it lands. The last mission ends the story with an epilogue and free roam.

import * as THREE from 'three';
import { PLACES, ECONOMY, WANTED } from './config.js';
import { createCar } from './vehicles.js';

const STORY = {
  intro: 'Solmar, kota pesisir yang disinari matahari. Bengkel keluarga hampir bangkrut karena pemerasan pelabuhan. Kamu, kurir bengkel itu, memutuskan melawan.',
  m1: {
    title: 'Misi 1 — Pagi di Solmar',
    briefing: 'Antar paket pertama hari ini. Temui Raka di promenade, ambil mobil bengkel, antar paket ke dermaga.',
  },
  m2: {
    title: 'Misi 2 — Kunci Pinjaman',
    briefing: 'Penagih utang, Darto, memarkir mobilnya di pusat kota. Curi mobil itu dan sembunyikan di bengkel.',
  },
  m3: {
    title: 'Misi 3 — Utang Dermaga',
    briefing: 'Buku rekening pemerasan ada di gudang pelabuhan. Kalahkan penjaganya dan ambil buku itu.',
  },
  m4: {
    title: 'Misi 4 — Jalan Panas',
    briefing: 'Saksi, Lina, mau bersaksi — tapi polisi mengejarnya. Antar dia lewat perempatan utara ke mercusuar.',
  },
  m5: {
    title: 'Misi 5 — Matahari Terakhir',
    briefing: 'Bos dermaga menunggu di gudang. Akhiri pemerasan ini, ambil buktinya, dan kabur ke mercusuar.',
  },
};

function buildNpc(scene, x, z, shirtColour, name) {
  const group = new THREE.Group();
  group.name = `npc-${name}`;
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColour });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.32), shirt);
  torso.position.y = 1.03;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), pants);
  legL.position.set(-0.15, 0.33, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(torso, head, legL, legR);
  group.position.set(x, 0, z);
  scene.add(group);
  return { group, pos: group.position, name };
}

export function createMissions(ctx) {
  const { scene, city, hud, audio } = ctx;
  let missionIndex = -1;
  let stepIndex = 0;
  let active = false;
  let finished = false;
  let dialog = null;
  let introUntil = 0;
  let failReason = null;
  let missionCars = [];
  let npcs = [];
  let stepState = {};

  // The beacon: a spinning diamond and a beam of light over the current objective.
  const beacon = new THREE.Group();
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 4;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  );
  beam.position.y = 30;
  beacon.add(diamond, beam);
  beacon.visible = false;
  scene.add(beacon);

  function stepsFor(index) {
    switch (index) {
      case 0:
        return [
          { kind: 'goto', pos: PLACES.promenadeContact, radius: 4, text: 'Temui Raka di promenade' },
          {
            kind: 'talk', pos: PLACES.promenadeContact, radius: 4, text: 'Bicara dengan Raka (E)',
            npc: { name: 'Raka', shirt: 0x3f8f4f },
            lines: [
              ['Raka', 'Pagi, kurir! Paket ini harus sampai ke dermaga sebelum siang.'],
              ['Kamu', 'Siap. Mobil bengkel sudah kupanaskan.'],
              ['Raka', 'Hati-hati di jalan. Pelabuhan akhir-akhir ini tidak aman.'],
            ],
          },
          { kind: 'enterCar', carId: 'garage', text: 'Naik mobil bengkel (E)' },
          { kind: 'driveTo', pos: PLACES.harbourPier, radius: 10, text: 'Antar paket ke dermaga pelabuhan' },
          {
            kind: 'talk', pos: PLACES.harbourPier, radius: 5, text: 'Serahkan paket (E)',
            npc: { name: 'Pak Tua Dermaga', shirt: 0x7a4a8f },
            lines: [
              ['Pak Tua', 'Paket dari bengkel? Terima kasih, nak.'],
              ['Pak Tua', 'Tapi dengar... orang-orang Darto makin berani memeras di sini.'],
            ],
          },
        ];
      case 1:
        return [
          { kind: 'goto', pos: PLACES.downtownLot, radius: 8, text: 'Cari mobil Darto di parkir pusat kota' },
          { kind: 'stealCar', carId: 'collector', text: 'Curi mobil Darto (E) — polisi akan mengejarmu!' },
          { kind: 'deliverCar', pos: PLACES.garageDrive, radius: 12, text: 'Sembunyikan mobil di bengkel' },
        ];
      case 2:
        return [
          { kind: 'goto', pos: PLACES.warehouse, radius: 14, text: 'Datangi gudang pelabuhan' },
          {
            kind: 'fight', text: 'Kalahkan 2 penjaga gudang',
            spawn: [
              { x: -190, z: -56, name: 'Penjaga 1' },
              { x: -190, z: -74, name: 'Penjaga 2' },
            ],
          },
          { kind: 'pickup', pos: { x: -190, z: -64 }, radius: 4, item: 'Buku Rekening', text: 'Ambil buku rekening (E)' },
          { kind: 'goto', pos: PLACES.garageDrive, radius: 10, text: 'Bawa buku itu kembali ke bengkel' },
        ];
      case 3:
        return [
          { kind: 'goto', pos: PLACES.witnessSpot, radius: 5, text: 'Temui saksi Lina' },
          {
            kind: 'talk', pos: PLACES.witnessSpot, radius: 5, text: 'Bicara dengan Lina (E)',
            npc: { name: 'Lina', shirt: 0xd85a4a },
            lines: [
              ['Lina', 'Aku melihat semuanya. Darto yang mengatur pemerasan itu.'],
              ['Lina', 'Aku mau bersaksi, tapi mereka mengejarku. Bawa aku ke mercusuar!'],
              ['Kamu', 'Naik. Kita lewat perempatan utara — pegangan yang kuat.'],
            ],
          },
          { kind: 'driveTo', pos: PLACES.checkpointNorth, radius: 10, text: 'Lewati perempatan utara — polisi mengejar!' },
          { kind: 'driveTo', pos: PLACES.lighthouse, radius: 14, text: 'Antar Lina ke mercusuar' },
        ];
      case 4:
        return [
          { kind: 'goto', pos: PLACES.warehouse, radius: 14, text: 'Datangi gudang — Bos Dermaga menunggu' },
          {
            kind: 'fight', text: 'Kalahkan anak buah dan Bos Dermaga',
            spawn: [
              { x: -190, z: -56, name: 'Anak Buah 1' },
              { x: -190, z: -74, name: 'Anak Buah 2' },
              { x: -190, z: -48, name: 'Anak Buah 3' },
              { x: -190, z: -64, name: 'Bos Dermaga', hp: 200 },
            ],
          },
          { kind: 'pickup', pos: { x: -190, z: -64 }, radius: 4, item: 'Bukti Pemerasan', text: 'Ambil bukti pemerasan (E)' },
          { kind: 'escape', pos: PLACES.lighthouse, radius: 14, text: 'Kabur ke mercusuar dan hilangkan wanted' },
        ];
      default:
        return [];
    }
  }

  function clearStepEntities() {
    for (const car of missionCars) {
      ctx.unregisterCar(car);
      if (car !== ctx.garageCar()) car.remove();
    }
    missionCars = [];
    for (const npc of npcs) scene.remove(npc.group);
    npcs = [];
    ctx.combat.clearEnemies();
  }

  function currentStep() {
    const steps = stepsFor(missionIndex);
    return steps[stepIndex] ?? null;
  }

  function placeBeacon(pos) {
    if (!pos) {
      beacon.visible = false;
      return;
    }
    beacon.visible = true;
    beacon.position.set(pos.x, 0, pos.z);
  }

  function beginStep(step) {
    stepState = {};
    if (!step) return;
    if (step.kind === 'talk') {
      const npc = buildNpc(scene, step.pos.x, step.pos.z, step.npc.shirt, step.npc.name);
      npcs.push(npc);
      stepState.npc = npc;
    }
    if (step.kind === 'stealCar') {
      const car = createCar(scene, {
        x: PLACES.downtownLot.x, z: PLACES.downtownLot.z, heading: 0,
        colour: 0x1d1d1d, owner: 'collector', label: 'Mobil Darto',
      });
      ctx.registerCar(car);
      missionCars.push(car);
      stepState.car = car;
    }
    if (step.kind === 'fight') {
      for (const spawn of step.spawn) {
        ctx.combat.spawnEnemy(spawn.x, spawn.z, spawn.name, spawn.hp ?? 100);
      }
      stepState.total = step.spawn.length;
    }
    if (step.kind === 'driveTo' && missionIndex === 3 && stepIndex === 2) {
      ctx.police.setWanted(3, ctx.now());
      hud.message('Polisi mengejar! Lewati checkpoint!', 'bad');
    }
    placeBeacon(step.pos ?? null);
  }

  function advanceStep() {
    stepIndex += 1;
    const steps = stepsFor(missionIndex);
    if (stepIndex >= steps.length) {
      completeMission();
      return;
    }
    beginStep(currentStep());
    hud.setObjective(currentStep().text);
  }

  function completeMission() {
    active = false;
    beacon.visible = false;
    const reward = ECONOMY.missionReward[missionIndex];
    ctx.addCash(reward);
    ctx.stats.missionsDone += 1;
    audio.chime();
    if (missionIndex === 4) {
      finished = true;
      clearStepEntities();
      ctx.onStoryEnd();
      return;
    }
    hud.showMissionComplete(STORY[`m${missionIndex + 1}`].title, `+ $${reward}`, false);
    ctx.setScreen('complete');
    ctx.saveProgress(missionIndex + 1);
    clearStepEntities();
  }

  function fail(reason) {
    if (!active) return;
    active = false;
    failReason = reason;
    beacon.visible = false;
    audio.fail();
    clearStepEntities();
    hud.showMissionFailed(reason);
    ctx.setScreen('failed');
    ctx.onMissionFailed(reason);
  }

  return {
    get index() {
      return missionIndex;
    },
    get active() {
      return active;
    },
    get finished() {
      return finished;
    },
    get failReason() {
      return failReason;
    },
    get introText() {
      return STORY.intro;
    },
    storyFor(index) {
      return STORY[`m${index + 1}`];
    },
    /** The world position the beacon and minimap should point at, or null. */
    markerPos() {
      const step = currentStep();
      if (!step || !active) return null;
      if (step.kind === 'enterCar') return { x: ctx.garageCar().pos.x, z: ctx.garageCar().pos.z };
      if (step.kind === 'stealCar' && stepState.car) return { x: stepState.car.pos.x, z: stepState.car.pos.z };
      if (step.kind === 'deliverCar') return step.pos;
      return step.pos ?? null;
    },
    objectiveText() {
      if (!active) return finished ? 'Free roam — Solmar milikmu' : 'Pilih misi di menu (Misi 1 siap)';
      const step = currentStep();
      return step ? step.text : '';
    },
    start(index) {
      missionIndex = index;
      stepIndex = 0;
      active = true;
      failReason = null;
      dialog = null;
      clearStepEntities();
      ctx.police.reset();
      ctx.player.respawn(PLACES.garage.x + 6, PLACES.garage.z + 14);
      ctx.resetPlayerCar();
      hud.showMissionIntro(STORY[`m${index + 1}`].title, STORY[`m${index + 1}`].briefing);
      introUntil = ctx.now() + 4;
      beginStep(currentStep());
      hud.setObjective(currentStep().text);
      audio.click();
    },
    retry() {
      this.start(missionIndex);
    },
    startNext() {
      if (missionIndex + 1 < 5) this.start(missionIndex + 1);
    },
    hasNext() {
      return missionIndex + 1 < 5;
    },
    /** Advance a dialog line; returns true while a dialog is open. */
    dialogOpen() {
      return dialog !== null;
    },
    advanceDialog() {
      if (!dialog) return;
      dialog.line += 1;
      if (dialog.line >= dialog.lines.length) {
        const done = dialog.onDone;
        dialog = null;
        hud.hideDialog();
        if (done) done();
      } else {
        hud.showDialog(dialog.lines[dialog.line][0], dialog.lines[dialog.line][1]);
      }
    },
    update(dt, now, input) {
      diamond.rotation.y += dt * 1.4;
      diamond.position.y = 4 + Math.sin(now * 2) * 0.4;
      if (dialog) {
        if (input.wasPressed('KeyE') || input.clicked) this.advanceDialog();
        return;
      }
      if (!active) return;
      const step = currentStep();
      if (!step) return;
      // The player's effective position: the car when driving, the feet otherwise.
      const carNow = ctx.currentCar();
      const playerPos = carNow ? carNow.pos : ctx.player.pos;
      const distTo = (pos) => Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

      // Mission failure: the player was wasted or busted, or the mission car died.
      if (!ctx.player.alive) {
        fail('Kamu tumbang. Coba lagi dari awal misi.');
        return;
      }
      if (step.kind === 'driveTo' || step.kind === 'deliverCar') {
        const car = ctx.currentCar();
        if (car && car.destroyed) {
          fail('Mobilmu hancur. Coba lagi dari awal misi.');
          return;
        }
      }

      switch (step.kind) {
        case 'goto':
        case 'driveTo':
        case 'escape': {
          if (distTo(step.pos) < step.radius) {
            if (step.kind === 'escape' && ctx.police.wanted > 0) {
              hud.setObjective('Hilangkan wanted dulu — sembunyi sampai bintang hilang!');
              break;
            }
            advanceStep();
          }
          break;
        }
        case 'talk': {
          if (distTo(step.pos) < step.radius) {
            hud.setPrompt('Tekan E untuk bicara');
            if (input.wasPressed('KeyE')) {
              dialog = { lines: step.lines, line: 0, onDone: () => advanceStep() };
              hud.showDialog(dialog.lines[0][0], dialog.lines[0][1]);
            }
          }
          break;
        }
        case 'enterCar': {
          const car = ctx.garageCar();
          hud.setPrompt('Tekan E di dekat mobil bengkel');
          if (ctx.currentCar() === car) advanceStep();
          break;
        }
        case 'stealCar': {
          const car = stepState.car;
          if (!car) break;
          hud.setPrompt('Tekan E untuk mencuri mobil');
          if (ctx.currentCar() === car) {
            ctx.police.addWanted(WANTED.steal, now, 'Mencuri mobil');
            hud.message('Mobil dicuri! Polisi mengejarmu!', 'bad');
            advanceStep();
          }
          break;
        }
        case 'deliverCar': {
          const car = ctx.currentCar();
          if (car && distTo(step.pos) < step.radius && car.speed < 2) {
            advanceStep();
          }
          break;
        }
        case 'fight': {
          const remaining = ctx.combat.enemies.filter((e) => e.alive).length;
          hud.setObjective(`${step.text} (${stepState.total - remaining}/${stepState.total})`);
          if (remaining === 0) advanceStep();
          break;
        }
        case 'pickup': {
          if (distTo(step.pos) < step.radius) {
            hud.setPrompt(`Tekan E untuk mengambil ${step.item}`);
            if (input.wasPressed('KeyE')) {
              ctx.addItem(step.item);
              audio.pickup();
              hud.message(`${step.item} didapat!`, 'good');
              advanceStep();
            }
          }
          break;
        }
        default:
          break;
      }
      if (introUntil && now > introUntil) introUntil = 0;
    },
  };
}
