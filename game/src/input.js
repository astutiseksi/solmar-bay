// input.js — keyboard + mouse state, edge-triggered "pressed" keys, and a
// tiny helper to bind canvas clicks to world coordinates.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    anyKey: false,
  };
  const code = (e) => e.code;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left; input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });

  input.down = (...codes) => codes.some((c) => input.keys.has(c));
  input.hit = (...codes) => codes.some((c) => input.pressed.has(c));
  input.endFrame = () => { input.pressed.clear(); input.mouseClicked = false; input.anyKey = false; };
  return input;
}
