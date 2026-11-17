// SOLMAR STREETS — the HUD, the minimap and every screen.
// The HUD is DOM over the 3D canvas: cash and wanted stars, health and ammo, speed,
// the mission objective, contextual prompts, a message feed, a crosshair and a live
// 2D minimap drawn from the same city data as the 3D world. The screens — title,
// pause, mission intro/complete/failed, busted, wasted and the ending — are DOM too,
// so they stay crisp at any resolution and work without pointer lock.

export function createHud(document, callbacks) {
  const root = document.getElementById('hud');
  const $ = (id) => document.getElementById(id);

  const cashEl = $('cash');
  const starsEl = $('stars');
  const healthFill = $('health-fill');
  const healthText = $('health-text');
  const ammoEl = $('ammo');
  const speedEl = $('speed');
  const objectiveEl = $('objective');
  const promptEl = $('prompt');
  const feedEl = $('feed');
  const crosshairEl = $('crosshair');
  const hitmarkerEl = $('hitmarker');
  const minimap = $('minimap');
  const mapCtx = minimap.getContext('2d');
  const dialogEl = $('dialog');
  const dialogName = $('dialog-name');
  const dialogText = $('dialog-text');
  const bannerEl = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');

  let bannerUntil = 0;
  let promptUntil = 0;

  function show(id) {
    $(id).classList.remove('hidden');
  }
  function hide(id) {
    $(id).classList.add('hidden');
  }

  return {
    setCash(amount) {
      cashEl.textContent = `$${amount.toLocaleString('en-US')}`;
    },
    setWanted(level) {
      starsEl.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
      starsEl.classList.toggle('hot', level > 0);
    },
    setHealth(hp, max) {
      const ratio = Math.max(0, hp / max);
      healthFill.style.width = `${ratio * 100}%`;
      healthFill.classList.toggle('low', ratio < 0.35);
      healthText.textContent = `${Math.ceil(hp)} HP`;
    },
    setAmmo(ammo, magSize, reloading) {
      ammoEl.textContent = reloading ? 'RELOAD...' : `${ammo} / ${magSize}`;
    },
    setSpeed(kmh) {
      speedEl.textContent = `${Math.round(kmh)} km/h`;
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    setPrompt(text, seconds = 0.1) {
      promptEl.textContent = text;
      promptEl.classList.remove('hidden');
      promptUntil = performance.now() + seconds * 1000;
    },
    clearPrompt() {
      promptEl.classList.add('hidden');
    },
    message(text, kind = 'info') {
      const line = document.createElement('div');
      line.className = `feed-line ${kind}`;
      line.textContent = text;
      feedEl.prepend(line);
      while (feedEl.children.length > 4) feedEl.removeChild(feedEl.lastChild);
      window.setTimeout(() => line.classList.add('fade'), 4200);
    },
    showHitmarker() {
      hitmarkerEl.classList.remove('hidden');
      window.setTimeout(() => hitmarkerEl.classList.add('hidden'), 120);
    },
    showCrosshair(showIt) {
      crosshairEl.classList.toggle('hidden', !showIt);
    },
    showDialog(name, text) {
      dialogName.textContent = name;
      dialogText.textContent = text;
      dialogEl.classList.remove('hidden');
    },
    hideDialog() {
      dialogEl.classList.add('hidden');
    },
    showBanner(title, sub, seconds = 3.5) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub;
      bannerEl.classList.remove('hidden');
      bannerUntil = performance.now() + seconds * 1000;
    },
    hideBanner() {
      bannerEl.classList.add('hidden');
      bannerUntil = 0;
    },
    showMissionIntro(title, briefing) {
      this.showBanner(title, briefing, 5);
    },
    showMissionComplete(title, reward, isFinal) {
      $('complete-title').textContent = isFinal ? 'CERITA SELESAI' : 'MISI SELESAI';
      $('complete-text').textContent = `${title} — ${reward}`;
      $('next-mission').classList.toggle('hidden', isFinal);
      show('screen-complete');
    },
    showMissionFailed(reason) {
      $('fail-reason').textContent = reason;
      show('screen-failed');
    },
    showBusted() {
      show('screen-busted');
    },
    showWasted() {
      show('screen-wasted');
    },
    showEnding(stats) {
      $('ending-stats').textContent = stats;
      show('screen-ending');
    },
    hideScreens() {
      for (const id of ['screen-title', 'screen-pause', 'screen-complete', 'screen-failed', 'screen-busted', 'screen-wasted', 'screen-ending']) hide(id);
    },
    showScreen(id) {
      this.hideScreens();
      show(id);
    },
    /** The minimap: roads, buildings, sea, and live dots for the player, cars, cops and the objective. */
    drawMinimap(world) {
      const size = minimap.width;
      const scale = size / 540;
      const toMap = (x, z) => [(x + 270) * scale, (z + 270) * scale];
      mapCtx.clearRect(0, 0, size, size);
      mapCtx.fillStyle = '#20262b';
      mapCtx.fillRect(0, 0, size, size);
      // Sea and sand.
      mapCtx.fillStyle = '#2e7fa8';
      mapCtx.fillRect((216 + 270) * scale, 0, size - (216 + 270) * scale, size);
      mapCtx.fillStyle = '#e8d49a';
      mapCtx.fillRect((196 + 270) * scale, 0, 20 * scale, size);
      // Buildings as small blocks.
      mapCtx.fillStyle = '#5a564e';
      for (const box of world.city.colliders) {
        if (box.x1 - box.x0 > 40 || box.z1 - box.z0 > 40) continue;
        const [x, y] = toMap(box.x0, box.z0);
        mapCtx.fillRect(x, y, (box.x1 - box.x0) * scale, (box.z1 - box.z0) * scale);
      }
      // Roads.
      mapCtx.strokeStyle = '#8a8f96';
      mapCtx.lineWidth = 3;
      for (const line of world.roads) {
        const [x1, y1] = toMap(line, -260);
        const [x2, y2] = toMap(line, 260);
        mapCtx.beginPath();
        mapCtx.moveTo(x1, y1);
        mapCtx.lineTo(x2, y2);
        mapCtx.stroke();
        const [x3, y3] = toMap(-260, line);
        const [x4, y4] = toMap(260, line);
        mapCtx.beginPath();
        mapCtx.moveTo(x3, y3);
        mapCtx.lineTo(x4, y4);
        mapCtx.stroke();
      }
      const dot = (x, z, colour, radius) => {
        const [mx, my] = toMap(x, z);
        mapCtx.fillStyle = colour;
        mapCtx.beginPath();
        mapCtx.arc(mx, my, radius, 0, Math.PI * 2);
        mapCtx.fill();
      };
      // Objective beacon.
      const marker = world.markerPos();
      if (marker) {
        const [mx, my] = toMap(marker.x, marker.z);
        const pulse = 6 + Math.sin(performance.now() / 240) * 2;
        mapCtx.strokeStyle = '#ffd23e';
        mapCtx.lineWidth = 2;
        mapCtx.beginPath();
        mapCtx.arc(mx, my, pulse, 0, Math.PI * 2);
        mapCtx.stroke();
        dot(marker.x, marker.z, '#ffd23e', 3.5);
      }
      // Police in red, traffic in grey.
      for (const car of world.policeCars) dot(car.pos.x, car.pos.z, '#ff4444', 3);
      for (const car of world.trafficCars) dot(car.pos.x, car.pos.z, '#aaaaaa', 2);
      // Player arrow.
      const [px, py] = toMap(world.playerX, world.playerZ);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(world.playerHeading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6);
      mapCtx.lineTo(4.5, 5);
      mapCtx.lineTo(-4.5, 5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
      // North marker.
      mapCtx.fillStyle = '#ffffff';
      mapCtx.font = 'bold 11px sans-serif';
      mapCtx.fillText('N', size - 14, 14);
    },
    update() {
      const now = performance.now();
      if (bannerUntil && now > bannerUntil) {
        bannerEl.classList.add('hidden');
        bannerUntil = 0;
      }
      if (promptUntil && now > promptUntil) {
        promptEl.classList.add('hidden');
        promptUntil = 0;
      }
    },
    wireButtons() {
      $('btn-start').addEventListener('click', () => callbacks.onStart());
      $('btn-continue').addEventListener('click', () => callbacks.onContinue());
      $('btn-resume').addEventListener('click', () => callbacks.onResume());
      $('btn-restart').addEventListener('click', () => callbacks.onRestart());
      $('btn-quit-title').addEventListener('click', () => callbacks.onQuitToTitle());
      $('btn-next-mission').addEventListener('click', () => callbacks.onNextMission());
      $('btn-retry').addEventListener('click', () => callbacks.onRetry());
      $('btn-free-roam').addEventListener('click', () => callbacks.onFreeRoam());
      $('btn-busted-retry').addEventListener('click', () => callbacks.onRetry());
      $('btn-wasted-retry').addEventListener('click', () => callbacks.onRetry());
      $('btn-ending-roam').addEventListener('click', () => callbacks.onFreeRoam());
      $('btn-ending-title').addEventListener('click', () => callbacks.onQuitToTitle());
    },
  };
}
