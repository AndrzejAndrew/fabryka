import { GRID_SIZE } from './config.js';
import { state } from './state.js';

export function setupInput(canvas, onToolSelect) {
  let isMouseDown = false;
  let isRightMouseDown = false;
  let lastPos = { x: 0, y: 0 };
  let dragStart = null;
  let dragEnd = null;

  function screenToWorld(sx, sy) {
    return {
      x: (sx - state.camera.x) / state.camera.zoom,
      y: (sy - state.camera.y) / state.camera.zoom
    };
  }
  function worldToGrid(wx, wy) {
    return {
      x: Math.floor(wx / GRID_SIZE),
      y: Math.floor(wy / GRID_SIZE)
    };
  }

  function calculateBeltPath(start, end) {
    const path = [];
    let currX = start.x;
    let currY = start.y;
    const stepX = end.x >= start.x ? 1 : -1;
    while (currX !== end.x) {
      const nextX = currX + stepX;
      path.push({ x: currX, y: currY, rot: stepX > 0 ? 1 : 3 });
      currX = nextX;
    }
    const stepY = end.y >= start.y ? 1 : -1;
    while (currY !== end.y) {
      const nextY = currY + stepY;
      path.push({ x: currX, y: currY, rot: stepY > 0 ? 2 : 0 });
      currY = nextY;
    }
    const lastRot = path.length > 0 ? path[path.length - 1].rot : state.currentRotation;
    path.push({ x: end.x, y: end.y, rot: lastRot });
    return path;
  }

  function applySingleTool(gx, gy) {
    const key = `${gx},${gy}`;
    if (state.currentTool === 'delete') {
      state.grid.delete(key);
      state.beltItems = state.beltItems.filter(i => i.curX !== gx || i.curY !== gy);
    } else {
      const existing = state.grid.get(key);
      if (existing && existing.type === 'hub') return;
      state.grid.set(key, {
        type: state.currentTool,
        x: gx,
        y: gy,
        rot: state.currentRotation,
        timer: 0,
        storedShape: null,
        storedDye: null,
        storedInputs: [],
        storedDyes: []
      });
    }
  }

  window.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    lastPos = { x: e.clientX, y: e.clientY };
    const w = screenToWorld(e.clientX, e.clientY);
    const g = worldToGrid(w.x, w.y);

    if (e.button === 0) {
      isMouseDown = true;
      if (state.currentTool === 'belt') {
        dragStart = g;
        dragEnd = g;
      } else {
        applySingleTool(g.x, g.y);
      }
    } else if (e.button === 1 || e.button === 2) {
      isRightMouseDown = true;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    lastPos = { x: e.clientX, y: e.clientY };

    if (isRightMouseDown) {
      state.camera.x += dx;
      state.camera.y += dy;
      return;
    }

    const w = screenToWorld(e.clientX, e.clientY);
    const g = worldToGrid(w.x, w.y);

    if (isMouseDown) {
      if (state.currentTool === 'belt') dragEnd = g;
      else applySingleTool(g.x, g.y);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0 && isMouseDown) {
      isMouseDown = false;
      if (state.currentTool === 'belt' && dragStart && dragEnd) {
        const path = calculateBeltPath(dragStart, dragEnd);
        path.forEach(node => {
          const key = `${node.x},${node.y}`;
          const existing = state.grid.get(key);
          if (!existing || existing.type !== 'hub') {
            state.grid.set(key, { type: 'belt', x: node.x, y: node.y, rot: node.rot });
          }
        });
      }
      dragStart = null;
      dragEnd = null;
    }
    if (e.button === 1 || e.button === 2) isRightMouseDown = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const mouseW = screenToWorld(e.clientX, e.clientY);
    const newZoom = Math.max(0.2, Math.min(3.0, state.camera.zoom * factor));
    state.camera.x = e.clientX - mouseW.x * newZoom;
    state.camera.y = e.clientY - mouseW.y * newZoom;
    state.camera.zoom = newZoom;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') state.currentRotation = (state.currentRotation + 1) % 4;
    else if (e.key === '1') onToolSelect('belt');
    else if (e.key === '2') onToolSelect('miner');
    else if (e.key === '3') onToolSelect('cutter');
    else if (e.key === '4') onToolSelect('rotator');
    else if (e.key === '5') onToolSelect('merger');
    else if (e.key === '6') onToolSelect('painter');
    else if (e.key === '7') onToolSelect('mixer');
    else if (e.key === '8') onToolSelect('tunnel_in');
    else if (e.key === '9') onToolSelect('tunnel_out');
    else if (e.key === '0') onToolSelect('delete');
  });

  return {
    getDragPreview: () => (isMouseDown && state.currentTool === 'belt' && dragStart && dragEnd)
      ? calculateBeltPath(dragStart, dragEnd)
      : null
  };
}