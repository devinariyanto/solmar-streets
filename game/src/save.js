// SOLMAR STREETS — saving.
// Progress lives in localStorage: the highest mission unlocked, cash, collected
// items and lifetime stats. Nothing leaves the machine; a fresh browser starts
// fresh, and a broken save is ignored rather than crashing the game.

const SAVE_KEY = 'solmar-streets-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      mission: Number.isInteger(data.mission) ? Math.max(0, Math.min(4, data.mission)) : 0,
      cash: Number.isFinite(data.cash) ? Math.max(0, Math.floor(data.cash)) : 250,
      items: Array.isArray(data.items) ? data.items.filter((item) => typeof item === 'string') : [],
      stats: {
        missionsDone: Number(data.stats?.missionsDone) || 0,
        carsStolen: Number(data.stats?.carsStolen) || 0,
        shotsFired: Number(data.stats?.shotsFired) || 0,
        enemiesDown: Number(data.stats?.enemiesDown) || 0,
        busted: Number(data.stats?.busted) || 0,
        wasted: Number(data.stats?.wasted) || 0,
        playSeconds: Number(data.stats?.playSeconds) || 0,
      },
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: state.mission,
      cash: state.cash,
      items: state.items,
      stats: state.stats,
    }));
  } catch {
    // Storage full or blocked: the game keeps running without a save.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: the game keeps running.
  }
}
