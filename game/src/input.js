// Keyboard + mouse input. Movement keys are read every frame; action keys
// (enter car, punch, pause, confirm) are edge-triggered and consumed once.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_RELOAD = 16;
export const ACTION_WEAPON = 32;
export const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  KeyE: ACTION_ENTER,
  Space: ACTION_PUNCH,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyR: ACTION_RELOAD,
  KeyQ: ACTION_WEAPON,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const down = new Set();
  let queued = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!event.repeat && KEY_ACTIONS[event.code]) queued |= KEY_ACTIONS[event.code];
    down.add(event.code);
  }
  function onKeyUp(event) { down.delete(event.code); }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() { mouse.down = false; }
  function onBlur() { down.clear(); mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function axis() {
    let x = 0; let y = 0;
    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
    if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
    return { x, y };
  }
  return {
    mouse,
    axis,
    running() { return down.has('ShiftLeft') || down.has('ShiftRight'); },
    takeActions() { const a = queued; queued = 0; return a; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
    isDown(code) { return down.has(code); },
  };
}
