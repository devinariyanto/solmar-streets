// SOLMAR STREETS — keyboard and mouse input.
// One place owns every key and mouse button the game reads, so the player, the car, the
// combat and the menus all agree on what "pressed" means. Edge-triggered presses (E, R,
// Space, Escape) are consumed once per frame by whoever reads them first.

const GAME_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'KeyE', 'KeyR', 'KeyF', 'KeyM', 'KeyP',
  'ShiftLeft', 'ShiftRight', 'Space', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
];

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  function isGameKey(code) {
    return GAME_KEYS.includes(code);
  }

  window.addEventListener('keydown', (event) => {
    if (!isGameKey(event.code)) return;
    if (event.code === 'Space') event.preventDefault();
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouseDown = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (locked) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });

  return {
    /** True while the key is held. */
    isDown(code) {
      return down.has(code);
    },
    /** True only on the frame the key went down. Consumes the press. */
    wasPressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** True while the left mouse button is held. */
    get mouseHeld() {
      return mouseDown;
    },
    /** True only on the frame the left button went down. Consumes the click. */
    get clicked() {
      if (!mouseClicked) return false;
      mouseClicked = false;
      return true;
    },
    /** Mouse movement since the last frame, in pixels. */
    takeMouseDelta() {
      const delta = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return delta;
    },
    /** Ask the browser to lock the pointer to the canvas (for aiming). */
    requestLock() {
      if (!locked) canvas.requestPointerLock?.();
    },
    /** Release pointer lock. */
    releaseLock() {
      if (locked) document.exitPointerLock?.();
    },
    get pointerLocked() {
      return locked;
    },
    /** Clear per-frame edge state. Call once at the end of every frame. */
    endFrame() {
      pressed.clear();
      mouseClicked = false;
      mouseDX = 0;
      mouseDY = 0;
    },
  };
}
