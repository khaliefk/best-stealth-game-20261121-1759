// Lantern Heist: keyboard and mouse. WASD or arrows to move, Shift to sneak, Q or a click to
// toss a coin toward the mouse, P or Escape to pause, Enter or a click to confirm, M to mute.
// The input layer only records what is held and what was just pressed; the world decides what
// any of it means.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_TOSS = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, clicked: false };

  function keyName(event) {
    // Lowercase everything: 'Enter' and 'ArrowLeft' must match the lowercase names the
    // game checks, and single letters come through lowercase already.
    return event.key.toLowerCase();
  }

  function onKeyDown(event) {
    const key = keyName(event);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    if (key === 'q') actions |= ACTION_TOSS;
    if (key === 'm') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(keyName(event));
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
    if (event.button === 0) actions |= ACTION_TOSS;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** -1, 0 or 1 on each axis, from the keys held down right now. */
    direction() {
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const up = keys.has('w') || keys.has('arrowup');
      const down = keys.has('s') || keys.has('arrowdown');
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    sneaking() {
      return keys.has('shift');
    },
    mouse() {
      return mouse;
    },
    /** The actions pressed since the last read, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      mouse.clicked = false;
      return taken;
    },
  };
}
