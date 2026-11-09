window.Factory = window.Factory || {};

// Pomocnik zwracający drugi kafelek dla budynków 2-polowych (Przecinarka 2x1 rozszerza się w prawo względem obrotu)
window.Factory.getSecondaryTile = function(type, gx, gy, rot) {
  if (type !== 'cutter') return null;
  const { DIRS } = window.Factory;
  const rightDir = DIRS[(rot + 1) % 4];
  return {
    x: gx + rightDir.x,
    y: gy + rightDir.y
  };
};

window.Factory.setupInput = function(canvas, onToolSelect) {
  const { state, GRID_SIZE, getSecondaryTile } = window.Factory;

  // Zabezpieczenie kolekcji i zmiennych
  state.rocks = state.rocks || new Set();
  state.grid = state.grid || new Map();
  state.patches = state.patches || new Map();
  state.beltItems = state.beltItems || [];
  state.matter = state.matter || 200;

  // Koszty globalne w Materii
  const COSTS = {
    belt: 1, miner: 15, cutter: 30, rotator: 20, merger: 40, 
    painter: 50, mixer: 60, synthesizer: 100, generator: 150, 
    splitter: 10, tunnel_in: 25, tunnel_out: 25
  };

  let isMouseDown = false;
  let isRightMouseDown = false;
  let lastPos = { x: 0, y: 0 };
  let hoverGrid = null;
  let dragStart = null;
  let dragEnd = null;

  // Przeliczanie pozycji ekranu na pozycję w świecie z uwzględnieniem offsetu Canvasu
  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || canvas.width);
    const scaleY = canvas.height / (rect.height || canvas.height);

    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top) * scaleY;

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

  // Bezpieczne usuwanie budynku (usuwa także powiązaną drugą połówkę budynku 2x1)
  function removeBuildingAt(gx, gy) {
    const key = `${gx},${gy}`;
    const existing = state.grid.get(key);
    if (!existing || existing.type === 'hub') return;

    // Jeżeli budynek zajmuje 2 kafelki, usuń też ten drugi
    if (existing.partnerKey) {
      const [px, py] = existing.partnerKey.split(',').map(Number);
      state.grid.delete(existing.partnerKey);
      state.beltItems = state.beltItems.filter(i => i.curX !== px || i.curY !== py);
    }

    state.grid.delete(key);
    state.beltItems = state.beltItems.filter(i => i.curX !== gx || i.curY !== gy);
  }

  function applySingleTool(gx, gy) {
    const key = `${gx},${gy}`;

    if (state.currentTool === 'delete') {
      // Usuwanie / Rozbiórka
      const cell = state.grid.get(key);
      if (cell && cell.type !== 'hub' && cell.type !== 'cutter_sec') {
         // Zwrot 50% kosztów przy usunięciu budynku
         state.matter += Math.floor((COSTS[cell.type] || 0) / 2);
      }

      if (state.rocks && state.rocks.has(key)) {
        if (state.rockDrillUnlocked) {
          state.rocks.delete(key);
        }
        return;
      }
      removeBuildingAt(gx, gy);
      return;
    }

    // Blokada budowania, jeśli nie stać nas na dany budynek
    const cost = COSTS[state.currentTool] || 0;
    if (state.matter < cost) return;

    // Sprawdzenie pierwszego pola pod kątem kolizji ze skałami i Hubem
    if (state.rocks && state.rocks.has(key)) return;
    const existing = state.grid.get(key);
    if (existing && existing.type === 'hub') return;

    // Specjalna obsługa Przecinarki 2x1 (zajmującej 2 kafelki)
    const secTile = getSecondaryTile(state.currentTool, gx, gy, state.currentRotation);
    if (secTile) {
      const secKey = `${secTile.x},${secTile.y}`;
      if (state.rocks && state.rocks.has(secKey)) return;
      const existingSec = state.grid.get(secKey);
      if (existingSec && existingSec.type === 'hub') return;

      // Usunięcie starych struktur z obu kratek
      removeBuildingAt(gx, gy);
      removeBuildingAt(secTile.x, secTile.y);

      state.matter -= cost; // Pobranie opłaty
      
      state.grid.set(key, {
        type: 'cutter',
        x: gx,
        y: gy,
        rot: state.currentRotation,
        partnerKey: secKey,
        timer: 0,
        storedShape: null
      });
      state.grid.set(secKey, {
        type: 'cutter_sec',
        x: secTile.x,
        y: secTile.y,
        rot: state.currentRotation,
        partnerKey: key,
        mainX: gx,
        mainY: gy
      });
      return;
    }

    // Standardowe budynki 1x1
    removeBuildingAt(gx, gy);
    state.matter -= cost; // Pobranie opłaty

    state.grid.set(key, {
      type: state.currentTool,
      x: gx,
      y: gy,
      rot: state.currentRotation,
      timer: 0,
      fuelTimer: 0,
      storedShape: null,
      storedDye: null,
      storedInputs: [],
      storedDyes: []
    });
  }

  window.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    lastPos = { x: e.clientX, y: e.clientY };
    const w = screenToWorld(e.clientX, e.clientY);
    const g = worldToGrid(w.x, w.y);
    hoverGrid = g;

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
    hoverGrid = g;

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
        const beltCost = COSTS['belt'];
        
        path.forEach(node => {
          const key = `${node.x},${node.y}`;
          if (state.rocks && state.rocks.has(key)) return;
          const existing = state.grid.get(key);
          
          if (!existing || existing.type !== 'hub') {
            // Sprawdzenie, czy stać nas na kolejny kawałek taśmociągu
            if (state.matter >= beltCost) {
              removeBuildingAt(node.x, node.y);
              state.matter -= beltCost; // Opłata za 1 kafelek taśmociągu
              state.grid.set(key, { type: 'belt', x: node.x, y: node.y, rot: node.rot });
            }
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
    const newZoom = Math.max(0.25, Math.min(2.8, state.camera.zoom * factor));

    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / (rect.width || canvas.width));
    const sy = (e.clientY - rect.top) * (canvas.height / (rect.height || canvas.height));

    state.camera.x = sx - mouseW.x * newZoom;
    state.camera.y = sy - mouseW.y * newZoom;
    state.camera.zoom = newZoom;
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'r') state.currentRotation = (state.currentRotation + 1) % 4;
    else if (k === '1') onToolSelect('belt');
    else if (k === '2') onToolSelect('miner');
    else if (k === '3') onToolSelect('cutter');
    else if (k === '4') onToolSelect('rotator');
    else if (k === '5') onToolSelect('merger');
    else if (k === '6') onToolSelect('painter');
    else if (k === '7') onToolSelect('mixer');
    else if (k === '8') onToolSelect('synthesizer');
    else if (k === '9') onToolSelect('generator');
    else if (k === '0') onToolSelect('splitter');
    else if (k === 'q') onToolSelect('tunnel_in');
    else if (k === 'e') onToolSelect('tunnel_out');
    else if (k === 'x' || e.key === 'Delete' || e.key === 'Backspace') onToolSelect('delete');
  });

  return {
    getDragPreview: () => (isMouseDown && state.currentTool === 'belt' && dragStart && dragEnd)
      ? calculateBeltPath(dragStart, dragEnd)
      : null,
    getHoverTile: () => hoverGrid
  };
};