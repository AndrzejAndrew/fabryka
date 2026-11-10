window.Factory = window.Factory || {};

// Zwraca tablicę dodatkowych kafelków zajmowanych przez maszynę (1 kafel dla 2x1, 8 kafli dla 3x3)
window.Factory.getExtraTiles = function(type, gx, gy, rot) {
  const dualTileMachines = ['cutter', 'merger', 'painter', 'mixer', 'synthesizer', 'splitter', 'foundry'];
  if (dualTileMachines.includes(type)) {
    const { DIRS } = window.Factory;
    const rightDir = DIRS[(rot + 1) % 4];
    return [{ x: gx + rightDir.x, y: gy + rightDir.y }];
  }
  if (type === 'ark_shipyard') {
    const tiles = [];
    for (let dx = 0; dx < 3; dx++) {
      for (let dy = 0; dy < 3; dy++) {
        if (dx === 0 && dy === 0) continue;
        tiles.push({ x: gx + dx, y: gy + dy });
      }
    }
    return tiles;
  }
  return [];
};

// Zachowanie kompatybilności ze starszym wywołaniem
window.Factory.getSecondaryTile = function(type, gx, gy, rot) {
  const extra = window.Factory.getExtraTiles(type, gx, gy, rot);
  return extra.length === 1 ? extra[0] : null;
};

window.Factory.setupInput = function(canvas, onToolSelect) {
  const { state, GRID_SIZE, getExtraTiles } = window.Factory;

  state.rocks = state.rocks || new Set();
  state.grid = state.grid || new Map();
  state.patches = state.patches || new Map();
  state.beltItems = state.beltItems || [];
  state.matter = state.matter || 200;
  state.alloyPlates = state.alloyPlates || 0;

  const COSTS = {
    belt: 1, miner: 15, cutter: 30, rotator: 20, merger: 40,
    painter: 50, mixer: 60, synthesizer: 100, generator: 150,
    splitter: 10, tunnel_in: 25, tunnel_out: 25,
    incinerator: 80, landfill: 20,
    foundry: 120, ark_shipyard: 500
  };

  let isMouseDown = false; let isRightMouseDown = false;
  let lastPos = { x: 0, y: 0 }; let hoverGrid = null;
  let dragStart = null; let dragEnd = null;

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
    return { x: Math.floor(wx / GRID_SIZE), y: Math.floor(wy / GRID_SIZE) };
  }

  function calculateBeltPath(start, end) {
    const path = []; let currX = start.x; let currY = start.y;
    const stepX = end.x >= start.x ? 1 : -1;
    while (currX !== end.x) { const nextX = currX + stepX; path.push({ x: currX, y: currY, rot: stepX > 0 ? 1 : 3 }); currX = nextX; }
    const stepY = end.y >= start.y ? 1 : -1;
    while (currY !== end.y) { const nextY = currY + stepY; path.push({ x: currX, y: currY, rot: stepY > 0 ? 2 : 0 }); currY = nextY; }
    const lastRot = path.length > 0 ? path[path.length - 1].rot : state.currentRotation;
    path.push({ x: end.x, y: end.y, rot: lastRot });
    return path;
  }

  function removeBuildingAt(gx, gy) {
    const key = `${gx},${gy}`;
    const existing = state.grid.get(key);
    if (!existing || existing.type === 'hub') return;

    // Jeśli kliknięto w segment pomocniczy (_sec), znajdź główny kafelek
    const mainKey = existing.type.endsWith('_sec') ? existing.partnerKey : key;
    const mainCell = state.grid.get(mainKey) || existing;

    // Usuń wszystkie powiązane kafelki (dla 2x1 oraz 3x3)
    if (Array.isArray(mainCell.partnerKeys)) {
      mainCell.partnerKeys.forEach(pk => {
        const [px, py] = pk.split(',').map(Number);
        state.grid.delete(pk);
        state.beltItems = state.beltItems.filter(i => i.curX !== px || i.curY !== py);
      });
    } else if (mainCell.partnerKey) {
      const [px, py] = mainCell.partnerKey.split(',').map(Number);
      state.grid.delete(mainCell.partnerKey);
      state.beltItems = state.beltItems.filter(i => i.curX !== px || i.curY !== py);
    }

    const [mx, my] = mainKey.split(',').map(Number);
    state.grid.delete(mainKey);
    state.beltItems = state.beltItems.filter(i => i.curX !== mx || i.curY !== my);
  }

  function applySingleTool(gx, gy) {
    const key = `${gx},${gy}`;
    if (state.currentTool === 'delete') {
      const cell = state.grid.get(key);
      if (cell && cell.type === 'landfill' && (cell.storedWaste || 0) > 0) {
        const hintEl = document.getElementById('contextHint');
        if (hintEl) {
          hintEl.innerHTML = `<span style="color:#f85149; font-weight:bold;">⚠️ Nie można usunąć Wysypiska!</span> W środku zalega <b>${cell.storedWaste}/100 ☣️ Żużla</b>. Wyprowadź go taśmociągiem z przodu Wysypiska do Spalarni!`;
        }
        return;
      }

      if (cell && cell.type !== 'hub') {
        const baseType = cell.type.endsWith('_sec') ? cell.type.replace('_sec', '') : cell.type;
        state.matter += Math.floor((COSTS[baseType] || 0) / 2);
      }
      if (state.rocks && state.rocks.has(key)) {
        if (state.rockDrillUnlocked) state.rocks.delete(key);
        return;
      }
      removeBuildingAt(gx, gy);
      return;
    }

    const cost = COSTS[state.currentTool] || 0;
    if (state.matter < cost) return;

    // Stocznia Arki 3x3 wymaga dodatkowo 20 Prefabrykatów z Kuźni!
    if (state.currentTool === 'ark_shipyard' && (state.alloyPlates || 0) < 20) {
      const hintEl = document.getElementById('contextHint');
      if (hintEl) {
        hintEl.innerHTML = `<span style="color:#f85149; font-weight:bold;">⚠️ Brak Prefabrykatów!</span> Stocznia Arki 3x3 wymaga <b>500 🧱 Materii</b> oraz <b>20 🔩 Prefabrykatów</b> (masz: ${state.alloyPlates || 0}/20). Wyprodukuj je w <b>Kuźni [F]</b>!`;
      }
      return;
    }

    if (state.rocks && state.rocks.has(key)) return;
    const existing = state.grid.get(key);
    if (existing && existing.type === 'hub') return;

    const extraTiles = getExtraTiles(state.currentTool, gx, gy, state.currentRotation);
    if (extraTiles.length > 0) {
      for (const t of extraTiles) {
        const tk = `${t.x},${t.y}`;
        if (state.rocks && state.rocks.has(tk)) return;
        const ex = state.grid.get(tk);
        if (ex && ex.type === 'hub') return;
      }

      removeBuildingAt(gx, gy);
      extraTiles.forEach(t => removeBuildingAt(t.x, t.y));

      state.matter -= cost;
      if (state.currentTool === 'ark_shipyard') state.alloyPlates -= 20;

      const partnerKeys = extraTiles.map(t => `${t.x},${t.y}`);
      state.grid.set(key, {
        type: state.currentTool,
        x: gx, y: gy, rot: state.currentRotation,
        partnerKey: partnerKeys[0],
        partnerKeys: partnerKeys,
        timer: 0, storedShape: null, storedLeft: null, storedRight: null
      });

      extraTiles.forEach(t => {
        const tk = `${t.x},${t.y}`;
        state.grid.set(tk, {
          type: state.currentTool + '_sec',
          x: t.x, y: t.y, rot: state.currentRotation,
          partnerKey: key, mainX: gx, mainY: gy
        });
      });
      return;
    }

    removeBuildingAt(gx, gy);
    state.matter -= cost;
    state.grid.set(key, {
      type: state.currentTool, x: gx, y: gy, rot: state.currentRotation,
      timer: 0, fuelTimer: 0, storedShape: null, storedDye: null, storedInputs: [], storedDyes: []
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
      if (state.currentTool === 'belt') { dragStart = g; dragEnd = g; } else { applySingleTool(g.x, g.y); }
    } else if (e.button === 1 || e.button === 2) { isRightMouseDown = true; }
  });

  canvas.addEventListener('mousemove', (e) => {
    const dx = e.clientX - lastPos.x; const dy = e.clientY - lastPos.y;
    lastPos = { x: e.clientX, y: e.clientY };
    if (isRightMouseDown) { state.camera.x += dx; state.camera.y += dy; return; }
    const w = screenToWorld(e.clientX, e.clientY);
    const g = worldToGrid(w.x, w.y);
    hoverGrid = g;
    if (isMouseDown) {
      if (state.currentTool === 'belt') dragEnd = g; else applySingleTool(g.x, g.y);
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
            if (state.matter >= beltCost) {
              removeBuildingAt(node.x, node.y);
              state.matter -= beltCost;
              state.grid.set(key, { type: 'belt', x: node.x, y: node.y, rot: node.rot });
            }
          }
        });
      }
      dragStart = null; dragEnd = null;
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
    else if (k === '1') onToolSelect('belt'); else if (k === '2') onToolSelect('miner');
    else if (k === '3') onToolSelect('cutter'); else if (k === '4') onToolSelect('rotator');
    else if (k === '5') onToolSelect('merger'); else if (k === '6') onToolSelect('painter');
    else if (k === '7') onToolSelect('mixer'); else if (k === '8') onToolSelect('synthesizer');
    else if (k === '9') onToolSelect('generator'); else if (k === '0') onToolSelect('splitter');
    else if (k === 'q') onToolSelect('tunnel_in'); else if (k === 'e') onToolSelect('tunnel_out');
    else if (k === 'x' || e.key === 'Delete' || e.key === 'Backspace') onToolSelect('delete');
    else if (k === 'c') onToolSelect('incinerator');
    else if (k === 'v') onToolSelect('landfill');
    else if (k === 'f') onToolSelect('foundry');
    else if (k === 'g') onToolSelect('ark_shipyard');
  });

  return {
    getDragPreview: () => (isMouseDown && state.currentTool === 'belt' && dragStart && dragEnd) ? calculateBeltPath(dragStart, dragEnd) : null,
    getHoverTile: () => hoverGrid
  };
};