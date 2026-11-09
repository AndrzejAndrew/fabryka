(function() {
  const {
    GRID_SIZE, DIRS, LEVELS, COLOR_MAP, TOOL_HINTS, POWER_RADIUS,
    state, initInitialWorld, saveGame, loadGame, clearGameSave,
    runSimulationTick, isFullShapeOfType, drawShape, drawDyeDrop, drawRock, drawBuilding, setupInput
  } = window.Factory;

  state.rocks = state.rocks || new Set();
  state.patches = state.patches || new Map();
  state.grid = state.grid || new Map();
  state.beltItems = state.beltItems || [];
  state.hubSize = state.hubSize || 2;
  state.rockDrillUnlocked = Boolean(state.rockDrillUnlocked);

  // Dodajemy Materię (surowiec budowlany) i statystyki do kalkulacji Offline/Idle
  state.matter = state.matter || 200; // Startowe 200 materii
  state.matterPerMinute = state.matterPerMinute || 0;
  state.sciencePerMinute = state.sciencePerMinute || 0;
  
  // Słownik kosztów (w Materii) dla każdego budynku
  const BUILDING_COSTS = {
    belt: 1,
    miner: 15,
    cutter: 30,
    rotator: 20,
    merger: 40,
    painter: 50,
    mixer: 60,
    synthesizer: 100,
    generator: 150,
    splitter: 10,
    tunnel_in: 25,
    tunnel_out: 25
  };

  const rebuildHub = window.Factory.rebuildHub || function() {
    const size = state.hubSize || 2;
    for (const [k, cell] of state.grid.entries()) {
      if (cell.type === 'hub') state.grid.delete(k);
    }
    const startOffset = -Math.floor((size - 2) / 2);
    const endOffset = startOffset + size - 1;
    for (let x = startOffset; x <= endOffset; x++) {
      for (let y = startOffset; y <= endOffset; y++) {
        const key = `${x},${y}`;
        state.rocks.delete(key);
        state.patches.delete(key);
        state.grid.set(key, { type: 'hub', x, y, rot: 0 });
      }
    }
  };
  window.Factory.rebuildHub = rebuildHub;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const goalCanvas = document.getElementById('goalCanvas');
  const goalCtx = goalCanvas.getContext('2d');

  // NAPRAWA MAPY I SIATKI: Canvas pozostaje w tle naturalnie (bez z-index: -1).
  // Aby interfejs nie przepychał płótna, ustawiamy ui i toolbary na wyższy z-index.
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';

  const uiContainer = document.getElementById('ui');
  if (uiContainer) uiContainer.style.zIndex = '10';
  
  const toolbarContainer = document.getElementById('toolbar');
  if (toolbarContainer) toolbarContainer.style.zIndex = '10';

  const levelBadge = document.getElementById('levelBadge');
  const goalTitle = document.getElementById('goalTitle');
  const goalProgressFill = document.getElementById('goalProgressFill');
  const goalProgressText = document.getElementById('goalProgressText');
  const scienceDisplay = document.getElementById('scienceDisplay');
  const contextHint = document.getElementById('contextHint');

  // Tworzymy wyświetlacz Materii nad punktami nauki
  if (scienceDisplay && !document.getElementById('matterDisplay')) {
    const matterDiv = document.createElement('div');
    matterDiv.id = 'matterDisplay';
    matterDiv.className = 'science-score';
    matterDiv.style.color = '#3fb950';
    matterDiv.style.marginBottom = '2px';
    matterDiv.innerHTML = `200 🧱 Materii`;
    scienceDisplay.parentNode.insertBefore(matterDiv, scienceDisplay);
  }
  const matterDisplay = document.getElementById('matterDisplay');

  const resetSaveBtn = document.getElementById('resetSaveBtn');
  const newMapBtn = document.getElementById('newMapBtn');
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const tutorialModal = document.getElementById('tutorialModal');

  if (helpBtn) {
    helpBtn.style.position = 'fixed';
    helpBtn.style.top = '16px';
    helpBtn.style.right = '16px';
    helpBtn.style.zIndex = '20';
  }

  const upgBeltBtn = document.getElementById('upgBelt');
  const upgMinerBtn = document.getElementById('upgMiner');
  const upgHubBtn = document.getElementById('upgHub');
  const upgDrillBtn = document.getElementById('upgDrill');

  const beltLvlText = document.getElementById('beltLvl');
  const minerLvlText = document.getElementById('minerLvl');
  const hubLvlText = document.getElementById('hubLvl');
  const drillLvlText = document.getElementById('drillLvl');

  const beltCostText = document.getElementById('beltCost');
  const minerCostText = document.getElementById('minerCost');
  const hubCostText = document.getElementById('hubCost');
  const drillCostText = document.getElementById('drillCost');

  const toolButtons = document.querySelectorAll('.tool-btn');

  // --- OKNO PRODUKCJI OFFLINE (IDLE) ---
  const offlinePopup = document.createElement('div');
  offlinePopup.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    display: none; align-items: center; justify-content: center; z-index: 100;
  `;
  offlinePopup.innerHTML = `
    <div style="background:#161b22; border:2px solid #3fb950; border-radius:12px; padding:26px; max-width:420px; width:90%; box-shadow:0 16px 40px rgba(0,0,0,0.8); color:#f0f6fc; text-align:center;">
      <h3 style="color:#3fb950; margin-bottom:12px; font-size:18px;">🌙 Witaj ponownie, Inżynierze!</h3>
      <p style="font-size:13px; color:#c9d1d9; margin-bottom:20px;">Podczas Twojej nieobecności (<span id="offlineTimeStr">0h</span>) fabryka kontynuowała wydobycie na podstawie Twojej zoptymalizowanej przepustowości.</p>
      <div style="display:flex; justify-content:space-around; margin-bottom:24px; background:#0d1117; padding:12px; border-radius:8px;">
        <div>
          <div style="font-size:11px; color:#8b949e; text-transform:uppercase;">Wydobyto</div>
          <div style="color:#3fb950; font-weight:bold; font-size:20px;">+<span id="offlineMatterVal">0</span> 🧱</div>
        </div>
        <div>
          <div style="font-size:11px; color:#8b949e; text-transform:uppercase;">Zbadano</div>
          <div style="color:#a371f7; font-weight:bold; font-size:20px;">+<span id="offlineScienceVal">0</span> ⚙</div>
        </div>
      </div>
      <button id="offlinePopupClose" style="background:#238636; border:1px solid #3fb950; color:#fff; font-weight:700; padding:10px 20px; border-radius:6px; cursor:pointer; width:100%;">Zbierz Zasoby</button>
    </div>
  `;
  document.body.appendChild(offlinePopup);
  document.getElementById('offlinePopupClose').addEventListener('click', () => {
    offlinePopup.style.display = 'none';
  });

  // Mechanika Offline / AFK
  function calculateOfflineProgress() {
    const now = Date.now();
    const lastTime = state.lastSaveTime || now;
    const diffMs = now - lastTime;
    const diffMinutes = Math.floor(diffMs / 60000);

    // Aktywuj tylko jeśli gracz był offline dłużej niż 3 minuty
    if (diffMinutes > 3 && (state.matterPerMinute > 0 || state.sciencePerMinute > 0)) {
      // Maksymalnie 24 godziny produkcji offline w jednej sesji
      const effectiveMinutes = Math.min(diffMinutes, 24 * 60);
      
      const gainedMatter = effectiveMinutes * (state.matterPerMinute || 0);
      const gainedScience = effectiveMinutes * (state.sciencePerMinute || 0);

      state.matter += gainedMatter;
      state.sciencePoints += gainedScience;

      document.getElementById('offlineTimeStr').innerText = `${Math.floor(effectiveMinutes/60)}h ${effectiveMinutes%60}m`;
      document.getElementById('offlineMatterVal').innerText = gainedMatter;
      document.getElementById('offlineScienceVal').innerText = gainedScience;
      
      offlinePopup.style.display = 'flex';
    }
    state.lastSaveTime = now;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  state.camera.x = canvas.width / 2;
  state.camera.y = canvas.height / 2;

  if (!loadGame()) initInitialWorld();
  rebuildHub();
  calculateOfflineProgress();

  if (helpBtn && tutorialModal) helpBtn.addEventListener('click', () => { tutorialModal.style.display = 'flex'; });
  if (closeHelpBtn && tutorialModal) closeHelpBtn.addEventListener('click', () => { tutorialModal.style.display = 'none'; });

  if (newMapBtn) {
    newMapBtn.addEventListener('click', () => {
      if (confirm("Wygenerować nową mapę? Znikną budynki, poziom zostanie zachowany.")) {
        initInitialWorld(Math.floor(Math.random() * 1000000));
        rebuildHub();
        saveGame();
        updateUI();
      }
    });
  }

  function canEnterMachine(nextCell, item) {
    if (!nextCell) return false;
    if (nextCell.type === 'belt' || nextCell.type === 'hub') return true;
    if (nextCell.type === 'cutter') return !item.isDye && !nextCell.storedShape;
    if (nextCell.type === 'rotator') return !item.isDye && !nextCell.storedShape;
    if (nextCell.type === 'merger') {
      const inputs = nextCell.storedInputs || [];
      return !item.isDye && inputs.length < 2;
    }
    if (nextCell.type === 'painter') {
      if (item.isDye) return !nextCell.storedDye;
      return !nextCell.storedShape;
    }
    if (nextCell.type === 'mixer') {
      if (!item.isDye) return false;
      const dyes = nextCell.storedDyes || [];
      if (dyes.length === 0) return true;
      if (dyes.length === 1 && dyes[0] !== item.dyeColor) return true;
      return false;
    }
    if (nextCell.type === 'synthesizer') {
      if (item.isDye) return false;
      if (isFullShapeOfType(item.shape, 'circle') && !nextCell.hasCircle) return true;
      if (isFullShapeOfType(item.shape, 'square') && !nextCell.hasSquare) return true;
      return false;
    }
    if (nextCell.type === 'generator') return isFullShapeOfType(item.shape, 'star') && (nextCell.fuelTimer || 0) < 100;
    if (nextCell.type === 'splitter') return !nextCell.storedItem;
    if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye;
    return false;
  }

  function updateUI() {
    const current = LEVELS[state.currentLvlIndex] || LEVELS[LEVELS.length - 1];
    levelBadge.innerText = `POZIOM ${current.lvl}`;
    goalTitle.innerText = current.title;
    goalProgressText.innerText = `${state.currentLvlProgress} / ${current.requiredCount}`;
    const pct = Math.min(100, (state.currentLvlProgress / current.requiredCount) * 100);
    goalProgressFill.style.width = `${pct}%`;

    goalCtx.clearRect(0, 0, 42, 42);
    drawShape(goalCtx, 21, 21, current.targetShape, 26);

    LEVELS.forEach((lvl, idx) => {
      if (idx < state.currentLvlIndex) {
        lvl.unlocks.forEach(t => {
          const btn = document.getElementById(`tool-${t}`);
          if (btn) {
            btn.disabled = false;
            const sc = btn.querySelector('.shortcut');
            if (sc) sc.innerText = sc.innerText.replace(' 🔒', '');
          }
        });
      }
    });

    scienceDisplay.innerText = `${state.sciencePoints} ⚙`;
    if (matterDisplay) matterDisplay.innerText = `${Math.floor(state.matter)} 🧱 Materii`;

    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    beltCostText.innerText = `${bCost} ⚙`;
    beltLvlText.innerText = `(Poz. ${state.beltSpeedLvl})`;
    upgBeltBtn.disabled = state.sciencePoints < bCost;

    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    minerCostText.innerText = `${mCost} ⚙`;
    minerLvlText.innerText = `(Poz. ${state.minerSpeedLvl})`;
    upgMinerBtn.disabled = state.sciencePoints < mCost;

    if (state.hubSize >= 4) {
      hubLvlText.innerText = `(4x4 MAX)`;
      hubCostText.innerText = `MAX`;
      upgHubBtn.disabled = true;
    } else {
      const hCost = state.hubSize === 2 ? 50 : 120;
      hubLvlText.innerText = `(${state.hubSize}x${state.hubSize} -> ${state.hubSize + 1}x${state.hubSize + 1})`;
      hubCostText.innerText = `${hCost} ⚙`;
      upgHubBtn.disabled = state.sciencePoints < hCost;
    }

    if (state.rockDrillUnlocked) {
      drillLvlText.innerText = `(Aktywne)`;
      drillCostText.innerText = `OK`;
      upgDrillBtn.disabled = true;
    } else {
      drillLvlText.innerText = `(Zablok.)`;
      drillCostText.innerText = `40 ⚙`;
      upgDrillBtn.disabled = state.sciencePoints < 40;
    }
  }

  function selectTool(name) {
    const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
    if (btn && !btn.disabled) {
      state.currentTool = name;
      toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      
      const cost = BUILDING_COSTS[name];
      const costStr = cost ? ` <span style="color:#3fb950;">(Koszt: ${cost} 🧱)</span>` : "";
      
      if (name === 'cutter') contextHint.innerHTML = `<b>Przecinarka 2x1 [3]:</b>${costStr} Zajmuje 2 pola! Ostrze tnie pionowo. Użyj Rotatora, by pociąć połówkę na ćwiartki.`;
      else if (TOOL_HINTS[name]) contextHint.innerHTML = TOOL_HINTS[name].replace(':', `:${costStr}`);
    }
  }

  toolButtons.forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));

  // ... (Przyciski upgBeltBtn, upgMinerBtn, itp. bez zmian) ...
  upgBeltBtn.addEventListener('click', () => {
    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    if (state.sciencePoints >= bCost) {
      state.sciencePoints -= bCost; state.beltSpeedLvl++; state.beltSpeed += 1.0;
      updateUI(); saveGame();
    }
  });
  upgMinerBtn.addEventListener('click', () => {
    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    if (state.sciencePoints >= mCost) {
      state.sciencePoints -= mCost; state.minerSpeedLvl++; state.minerInterval = Math.max(2, state.minerInterval - 1);
      updateUI(); saveGame();
    }
  });
  upgHubBtn.addEventListener('click', () => {
    if (state.hubSize >= 4) return;
    const hCost = state.hubSize === 2 ? 50 : 120;
    if (state.sciencePoints >= hCost) {
      state.sciencePoints -= hCost; state.hubSize++; rebuildHub(); updateUI(); saveGame();
    }
  });
  upgDrillBtn.addEventListener('click', () => {
    if (!state.rockDrillUnlocked && state.sciencePoints >= 40) {
      state.sciencePoints -= 40; state.rockDrillUnlocked = true; updateUI(); saveGame();
    }
  });
  resetSaveBtn.addEventListener('click', () => { if (confirm("Zresetować zapis?")) clearGameSave(); });

  // Modyfikacja zdarzenia Input, aby budowanie pobierało Materię, a kasowanie oddawało 50%
  const originalApplyTool = window.Factory.applySingleToolCore; // z input.js
  
  const input = setupInput(canvas, selectTool);

  // Rejestrowanie przychodu z ostatniej minuty do AFK (1-minutowe okno kroczące)
  let matterGainedThisMinute = 0;
  let scienceGainedThisMinute = 0;
  setInterval(() => {
    state.matterPerMinute = matterGainedThisMinute;
    state.sciencePerMinute = scienceGainedThisMinute;
    matterGainedThisMinute = 0;
    scienceGainedThisMinute = 0;
  }, 60000);

  setInterval(() => {
    runSimulationTick((m, s) => {
      // Callback z simulation.js o zyskanej materii i nauce w tym ticku
      if (m > 0) { state.matter += m; matterGainedThisMinute += m; }
      if (s > 0) { state.sciencePoints += s; scienceGainedThisMinute += s; }
      updateUI();
    }, (finishedLvl) => {
      updateUI(); saveGame();
    });
  }, 100);

  setInterval(() => saveGame(), 5000);
  window.addEventListener('beforeunload', () => saveGame());

  let lastTime = performance.now();
  function render(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    for (let i = state.beltItems.length - 1; i >= 0; i--) {
      const item = state.beltItems[i];
      item.progress += dt * state.beltSpeed;

      if (item.progress >= 1.0) {
        const cell = state.grid.get(`${item.curX},${item.curY}`);
        if (!cell) { state.beltItems.splice(i, 1); continue; }

        if (cell.type === 'cutter' && !item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'rotator' && !item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'merger' && !item.isDye) {
          cell.storedInputs = cell.storedInputs || [];
          if (cell.storedInputs.length < 2) { cell.storedInputs.push(item.shape); state.beltItems.splice(i, 1); continue; }
        }
        if (cell.type === 'painter') {
          if (item.isDye && !cell.storedDye) { cell.storedDye = item.dyeColor; state.beltItems.splice(i, 1); continue; }
          else if (!item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        }
        if (cell.type === 'mixer' && item.isDye) {
          cell.storedDyes = cell.storedDyes || [];
          if (cell.storedDyes.length === 0 || (cell.storedDyes.length === 1 && cell.storedDyes[0] !== item.dyeColor)) {
            cell.storedDyes.push(item.dyeColor); state.beltItems.splice(i, 1); continue;
          }
        }
        if (cell.type === 'synthesizer' && !item.isDye) {
          if (isFullShapeOfType(item.shape, 'circle') && !cell.hasCircle) { cell.hasCircle = true; cell.circleColor = item.shape[0].color; state.beltItems.splice(i, 1); continue; }
          if (isFullShapeOfType(item.shape, 'square') && !cell.hasSquare) { cell.hasSquare = true; cell.squareColor = item.shape[0].color; state.beltItems.splice(i, 1); continue; }
        }
        if (cell.type === 'generator' && !item.isDye) {
          if (isFullShapeOfType(item.shape, 'star')) { cell.fuelTimer = 150; state.beltItems.splice(i, 1); continue; }
        }
        if (cell.type === 'splitter' && !cell.storedItem) {
          cell.storedItem = { isDye: item.isDye, dyeColor: item.dyeColor, shape: item.shape }; state.beltItems.splice(i, 1); continue;
        }
        if (cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye) {
          if (item.isDye) cell.storedDye = item.dyeColor; else cell.storedShape = item.shape;
          state.beltItems.splice(i, 1); continue;
        }

        if (cell.type === 'belt') {
          const dir = DIRS[cell.rot] || DIRS[0];
          const nx = item.curX + dir.x; const ny = item.curY + dir.y;
          const nextCell = state.grid.get(`${nx},${ny}`);
          const occupied = state.beltItems.some(o => o !== item && o.curX === nx && o.curY === ny);

          if (!occupied && canEnterMachine(nextCell, item)) { item.curX = nx; item.curY = ny; item.progress = 0; }
          else { item.progress = 1.0; }
        }
      }
    }

    ctx.fillStyle = '#0d1017'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(state.camera.x, state.camera.y); ctx.scale(state.camera.zoom, state.camera.zoom);

    const startCol = Math.floor((-state.camera.x / state.camera.zoom) / GRID_SIZE) - 1;
    const endCol = startCol + Math.ceil(canvas.width / state.camera.zoom / GRID_SIZE) + 2;
    const startRow = Math.floor((-state.camera.y / state.camera.zoom) / GRID_SIZE) - 1;
    const endRow = startRow + Math.ceil(canvas.height / state.camera.zoom / GRID_SIZE) + 2;

    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        const patch = state.patches.get(`${x},${y}`);
        if (patch) {
          const px = x * GRID_SIZE, py = y * GRID_SIZE;
          ctx.fillStyle = '#151b26'; ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);
          if (patch.kind === 'shape') {
            ctx.fillStyle = 'rgba(158, 167, 179, 0.35)';
            if (patch.subType === 'circle') { ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.32, 0, Math.PI * 2); ctx.fill(); }
            else { const sz = GRID_SIZE * 0.55; ctx.fillRect(px + (GRID_SIZE - sz) / 2, py + (GRID_SIZE - sz) / 2, sz, sz); }
          } else if (patch.kind === 'dye') {
            ctx.fillStyle = COLOR_MAP[patch.subType] || '#ff4d4f'; ctx.globalAlpha = 0.45;
            ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;
          }
        }
      }
    }

    ctx.strokeStyle = '#19202b'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) { ctx.moveTo(x * GRID_SIZE, startRow * GRID_SIZE); ctx.lineTo(x * GRID_SIZE, endRow * GRID_SIZE); }
    for (let y = startRow; y <= endRow; y++) { ctx.moveTo(startCol * GRID_SIZE, y * GRID_SIZE); ctx.lineTo(endCol * GRID_SIZE, y * GRID_SIZE); }
    ctx.stroke();

    if (state.rocks) {
      for (let x = startCol; x <= endCol; x++) {
        for (let y = startRow; y <= endRow; y++) {
          if (state.rocks.has(`${x},${y}`)) drawRock(ctx, x, y);
        }
      }
    }

    state.grid.forEach(b => {
      if (b.type === 'generator' && (b.fuelTimer || 0) > 0) {
        ctx.fillStyle = 'rgba(250, 219, 20, 0.08)'; ctx.strokeStyle = 'rgba(250, 219, 20, 0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2, POWER_RADIUS * GRID_SIZE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    });

    state.grid.forEach(b => {
      if (b.type === 'tunnel_in') {
        const dir = DIRS[b.rot];
        for (let dist = 1; dist <= 5; dist++) {
          const tx = b.x + dir.x * dist, ty = b.y + dir.y * dist;
          const target = state.grid.get(`${tx},${ty}`);
          if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
            ctx.strokeStyle = '#bf94ff'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2); ctx.lineTo(tx * GRID_SIZE + GRID_SIZE / 2, ty * GRID_SIZE + GRID_SIZE / 2); ctx.stroke(); ctx.setLineDash([]);
            break;
          }
        }
      }
    });

    state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0, b));

    const preview = input.getDragPreview();
    if (preview) {
      preview.forEach(node => {
        // Zabarw podgląd na czerwono, jeśli nie stać nas na taśmociąg
        const afford = state.matter >= BUILDING_COSTS['belt'];
        ctx.strokeStyle = afford ? '' : '#f85149';
        drawBuilding(ctx, node.x, node.y, 'belt', node.rot, afford ? 0.45 : 0.7);
      });
    } else if (input.getHoverTile) {
      const hover = input.getHoverTile();
      if (hover) {
        if (state.currentTool === 'delete') {
          ctx.strokeStyle = '#f85149'; ctx.lineWidth = 2; ctx.strokeRect(hover.x * GRID_SIZE + 2, hover.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        } else {
          const cost = BUILDING_COSTS[state.currentTool] || 0;
          const afford = state.matter >= cost;
          
          if (!afford) {
            ctx.fillStyle = 'rgba(248, 81, 73, 0.3)';
            ctx.fillRect(hover.x * GRID_SIZE, hover.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
          }
          drawBuilding(ctx, hover.x, hover.y, state.currentTool, state.currentRotation, afford ? 0.42 : 0.2);
        }
      }
    }

    state.beltItems.forEach(item => {
      const cell = state.grid.get(`${item.curX},${item.curY}`);
      let px = item.curX * GRID_SIZE + GRID_SIZE / 2, py = item.curY * GRID_SIZE + GRID_SIZE / 2;
      if (cell && cell.type === 'belt') {
        const dir = DIRS[cell.rot] || DIRS[0];
        px += dir.x * (item.progress - 0.5) * GRID_SIZE; py += dir.y * (item.progress - 0.5) * GRID_SIZE;
      }
      if (item.isDye) drawDyeDrop(ctx, px, py, item.dyeColor, GRID_SIZE * 0.4);
      else drawShape(ctx, px, py, item.shape, GRID_SIZE * 0.38);
    });

    ctx.restore();
    requestAnimationFrame(render);
  }

  updateUI();
  requestAnimationFrame(render);
})();