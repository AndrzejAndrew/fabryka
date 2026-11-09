(function() {
  const { GRID_SIZE, DIRS, LEVELS, COLOR_MAP, POWER_RADIUS, state, initInitialWorld, saveGame, loadGame, clearGameSave, runSimulationTick, isFullShapeOfType, drawShape, drawDyeDrop, drawWaste, drawRock, drawBuilding, setupInput } = window.Factory;

  state.rocks = state.rocks || new Set(); state.patches = state.patches || new Map(); state.grid = state.grid || new Map();
  state.beltItems = state.beltItems || []; state.hubSize = state.hubSize || 2; state.rockDrillUnlocked = Boolean(state.rockDrillUnlocked);
  state.matter = state.matter || 200; state.matterPerMinute = state.matterPerMinute || 0; state.sciencePerMinute = state.sciencePerMinute || 0;
  state.prestigeCount = state.prestigeCount || 0; state.quantumCores = state.quantumCores || 0;
  
  const BUILDING_COSTS = { belt: 1, miner: 15, cutter: 30, rotator: 20, merger: 40, painter: 50, mixer: 60, synthesizer: 100, generator: 150, splitter: 10, tunnel_in: 25, tunnel_out: 25, incinerator: 80, landfill: 20 };
  
  const TOOL_HINTS = {
    belt: "Kieruje przepływem. Przeciągnij LPM by budować linię.",
    miner: "Wydobywa surowce ze złoża.",
    cutter: "Zajmuje 2 pola. Ostrze tnie napływający z dołu kształt na dwie połowy.",
    rotator: "Obraca kształt o 90° w prawo.",
    merger: "Zajmuje 2 pola. Doprowadź połówkę do LEWEGO i PRAWEGO wejścia. Wychodzi złączona.",
    painter: "Zajmuje 2 pola. Lewe: Kształt. Prawe: Barwnik.",
    mixer: "Zajmuje 2 pola. Lewe: Barwnik 1. Prawe: Barwnik 2.",
    synthesizer: "Zajmuje 2 pola. Lewe: Koło. Prawe: Kwadrat.",
    generator: "Spal Gwiazdę, by zasilić okoliczne kopalnie (2x prędkość).",
    splitter: "Rozdziela surowce 50/50 na wprost i w bok.",
    tunnel_in: "Omija rurą do 5 przeszkód.",
    tunnel_out: "Odbiera surowce z wejścia.",
    delete: "Zwraca 50% materii. Kruszy skały.",
    incinerator: "Spalarnia: Niszczy Żużel (Odpad) i generuje z niego prąd na 15 sekund!",
    landfill: "Wysypisko: Magazynuje do 100 sztuk Żużla."
  };

  const rebuildHub = window.Factory.rebuildHub || function() {
    const size = state.hubSize || 2;
    for (const [k, cell] of state.grid.entries()) { if (cell.type === 'hub') state.grid.delete(k); }
    const startOffset = -Math.floor((size - 2) / 2); const endOffset = startOffset + size - 1;
    for (let x = startOffset; x <= endOffset; x++) {
      for (let y = startOffset; y <= endOffset; y++) {
        const key = `${x},${y}`; state.rocks.delete(key); state.patches.delete(key); state.grid.set(key, { type: 'hub', x, y, rot: 0 });
      }
    }
  };
  window.Factory.rebuildHub = rebuildHub;

  const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
  const goalCanvas = document.getElementById('goalCanvas'); const goalCtx = goalCanvas.getContext('2d');
  canvas.style.position = 'fixed'; canvas.style.top = '0'; canvas.style.left = '0';

  const levelBadge = document.getElementById('levelBadge'); const goalTitle = document.getElementById('goalTitle');
  const goalProgressFill = document.getElementById('goalProgressFill'); const goalProgressText = document.getElementById('goalProgressText');
  const scienceDisplay = document.getElementById('scienceDisplay'); const contextHint = document.getElementById('contextHint');

  if (scienceDisplay && !document.getElementById('matterDisplay')) {
    const matterDiv = document.createElement('div'); matterDiv.id = 'matterDisplay'; matterDiv.className = 'science-score';
    matterDiv.style.color = '#3fb950'; matterDiv.style.marginBottom = '2px';
    scienceDisplay.parentNode.insertBefore(matterDiv, scienceDisplay);
  }
  const matterDisplay = document.getElementById('matterDisplay');
  
  if (scienceDisplay && !document.getElementById('prestigeDisplay')) {
    const prestigeDiv = document.createElement('div'); prestigeDiv.id = 'prestigeDisplay'; 
    prestigeDiv.style.color = '#58a6ff'; prestigeDiv.style.fontSize = '14px'; prestigeDiv.style.fontWeight = 'bold'; prestigeDiv.style.marginBottom = '6px';
    prestigeDiv.style.display = 'none';
    scienceDisplay.parentNode.insertBefore(prestigeDiv, matterDisplay);
  }
  const prestigeDisplay = document.getElementById('prestigeDisplay');

  const upgBeltBtn = document.getElementById('upgBelt'); const upgMinerBtn = document.getElementById('upgMiner');
  const upgHubBtn = document.getElementById('upgHub'); const upgDrillBtn = document.getElementById('upgDrill');
  const beltLvlText = document.getElementById('beltLvl'); const minerLvlText = document.getElementById('minerLvl');
  const hubLvlText = document.getElementById('hubLvl'); const drillLvlText = document.getElementById('drillLvl');
  const beltCostText = document.getElementById('beltCost'); const minerCostText = document.getElementById('minerCost');
  const hubCostText = document.getElementById('hubCost'); const drillCostText = document.getElementById('drillCost');
  const toolButtons = document.querySelectorAll('.tool-btn');
  const newMapBtn = document.getElementById('newMapBtn');

  upgBeltBtn.addEventListener('click', () => {
    const cost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    if (state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.beltSpeedLvl++;
      state.beltSpeed = 2.5 + (state.beltSpeedLvl - 1) * 1.0;
      updateUI(); saveGame();
    }
  });

  upgMinerBtn.addEventListener('click', () => {
    const cost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    if (state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.minerSpeedLvl++;
      state.minerInterval = Math.max(2, 5 - (state.minerSpeedLvl - 1));
      updateUI(); saveGame();
    }
  });

  upgHubBtn.addEventListener('click', () => {
    const cost = state.hubSize === 2 ? 50 : 120;
    if (state.hubSize < 4 && state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.hubSize++;
      rebuildHub(); updateUI(); saveGame();
    }
  });

  upgDrillBtn.addEventListener('click', () => {
    if (!state.rockDrillUnlocked && state.sciencePoints >= 40) {
      state.sciencePoints -= 40; state.rockDrillUnlocked = true;
      updateUI(); saveGame();
    }
  });

  const resetSaveBtn = document.getElementById('resetSaveBtn');
  if (resetSaveBtn) resetSaveBtn.addEventListener('click', () => { if (confirm("⚠️ UWAGA! Czy na pewno chcesz skasować cały zapis gry i zacząć od zera?")) clearGameSave(); });

  const prestigeActionBtn = document.createElement('button');
  prestigeActionBtn.className = 'upgrade-btn'; prestigeActionBtn.style.borderColor = '#a371f7'; prestigeActionBtn.style.color = '#a371f7'; prestigeActionBtn.style.display = 'none';
  prestigeActionBtn.innerHTML = `<span>🌌 Skok Międzyplanetarny</span><span>Gotowe!</span>`;
  document.querySelector('.upgrade-list').prepend(prestigeActionBtn);
  
  prestigeActionBtn.addEventListener('click', () => {
    if (confirm("UWAGA! Wykonanie Skoku zniszczy obecną fabrykę i mapę. Zdobędziesz +1 Rdzeń Kwantowy (+25% prędkości). Lecimy?")) {
      state.quantumCores++; state.prestigeCount++;
      state.matter = 200; state.currentLvlIndex = 0; state.currentLvlProgress = 0;
      state.beltItems = []; state.grid.clear();
      initInitialWorld(Math.floor(Math.random() * 1000000)); rebuildHub();
      saveGame(); updateUI();
    }
  });

  function calculateOfflineProgress() {
    const now = Date.now(); const lastTime = state.lastSaveTime || now; const diffMinutes = Math.floor((now - lastTime) / 60000);
    if (diffMinutes > 3 && (state.matterPerMinute > 0 || state.sciencePerMinute > 0)) {
      const effective = Math.min(diffMinutes, 24 * 60);
      state.matter += effective * (state.matterPerMinute || 0); state.sciencePoints += effective * (state.sciencePerMinute || 0);
    }
    state.lastSaveTime = now;
  }

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } window.addEventListener('resize', resize); resize();
  state.camera.x = canvas.width / 2; state.camera.y = canvas.height / 2;
  if (!loadGame()) initInitialWorld(); rebuildHub(); calculateOfflineProgress();
  if (newMapBtn) newMapBtn.addEventListener('click', () => { if (confirm("Nowa mapa? Znikną budynki, technologia zostaje.")) { initInitialWorld(Math.floor(Math.random() * 1000000)); rebuildHub(); saveGame(); updateUI(); } });

  function canEnterMachine(nextCell, item) {
    if (!nextCell) return false; if (nextCell.type === 'belt' || nextCell.type === 'hub') return true;
    
    // Zabezpieczenie: Odpady mogą wjechać TYLKO do Spalarni, Wysypiska i Tunelu. Reszta je blokuje.
    if (item.isWaste) {
      if (nextCell.type === 'incinerator') return true;
      if (nextCell.type === 'landfill') return (nextCell.storedWaste || 0) < 100;
      if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye && !nextCell.hasWasteStored;
      return false; 
    }

    if (nextCell.type === 'cutter') return !item.isDye && !nextCell.storedShape;
    if (nextCell.type === 'rotator') return !item.isDye && !nextCell.storedShape;
    
    if (['merger_sec', 'painter_sec', 'mixer_sec', 'synthesizer_sec'].includes(nextCell.type)) {
      const main = state.grid.get(nextCell.partnerKey);
      if (!main) return false;
      if (nextCell.type === 'merger_sec') return !item.isDye && !main.storedRight;
      if (nextCell.type === 'painter_sec') return item.isDye && !main.storedRight;
      if (nextCell.type === 'mixer_sec') return item.isDye && !main.storedRight;
      if (nextCell.type === 'synthesizer_sec') return !item.isDye && isFullShapeOfType(item.shape, 'square') && !main.storedRight;
      return false;
    }
    
    if (['merger', 'painter', 'mixer', 'synthesizer'].includes(nextCell.type)) {
      if (nextCell.type === 'merger') return !item.isDye && !nextCell.storedLeft;
      if (nextCell.type === 'painter') return !item.isDye && !nextCell.storedLeft;
      if (nextCell.type === 'mixer') return item.isDye && !nextCell.storedLeft;
      if (nextCell.type === 'synthesizer') return !item.isDye && isFullShapeOfType(item.shape, 'circle') && !nextCell.storedLeft;
      return false;
    }

    if (nextCell.type === 'generator') return isFullShapeOfType(item.shape, 'star') && (nextCell.fuelTimer || 0) < 100;
    if (nextCell.type === 'splitter') return !nextCell.storedItem;
    if (nextCell.type === 'splitter_sec') return false; 
    
    if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye && !nextCell.hasWasteStored;
    return false;
  }

  function updateUI() {
    const isMaxLevel = state.currentLvlIndex >= LEVELS.length - 1;
    const current = LEVELS[state.currentLvlIndex] || LEVELS[LEVELS.length - 1];
    
    levelBadge.innerText = `POZIOM ${current.lvl}`; goalTitle.innerText = current.title;
    goalProgressText.innerText = `${state.currentLvlProgress} / ${current.requiredCount}`;
    goalProgressFill.style.width = `${Math.min(100, (state.currentLvlProgress / current.requiredCount) * 100)}%`;
    goalCtx.clearRect(0, 0, 42, 42); drawShape(goalCtx, 21, 21, current.targetShape, 26);
    
    LEVELS.forEach((lvl, idx) => { if (idx < state.currentLvlIndex) { lvl.unlocks.forEach(t => { const btn = document.getElementById(`tool-${t}`); if (btn) { btn.disabled = false; const sc = btn.querySelector('.shortcut'); if (sc) sc.innerText = sc.innerText.replace(' 🔒', ''); } }); } });
    
    scienceDisplay.innerText = `${state.sciencePoints} ⚙`; if (matterDisplay) matterDisplay.innerText = `${Math.floor(state.matter)} 🧱 Materii`;
    
    if (state.quantumCores > 0) {
      prestigeDisplay.style.display = 'block';
      prestigeDisplay.innerText = `🌌 Rdzenie Kwantowe: ${state.quantumCores} (+${state.quantumCores * 25}% Zysków)`;
    }

    if (isMaxLevel && state.currentLvlProgress >= current.requiredCount) { prestigeActionBtn.style.display = 'flex'; } 
    else { prestigeActionBtn.style.display = 'none'; }

    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1)); beltCostText.innerText = `${bCost} ⚙`; beltLvlText.innerText = `(Poz. ${state.beltSpeedLvl})`; upgBeltBtn.disabled = state.sciencePoints < bCost;
    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1)); minerCostText.innerText = `${mCost} ⚙`; minerLvlText.innerText = `(Poz. ${state.minerSpeedLvl})`; upgMinerBtn.disabled = state.sciencePoints < mCost;
    if (state.hubSize >= 4) { hubLvlText.innerText = `(4x4 MAX)`; hubCostText.innerText = `MAX`; upgHubBtn.disabled = true; } else { const hCost = state.hubSize === 2 ? 50 : 120; hubLvlText.innerText = `(${state.hubSize}x${state.hubSize} -> ${state.hubSize + 1}x${state.hubSize + 1})`; hubCostText.innerText = `${hCost} ⚙`; upgHubBtn.disabled = state.sciencePoints < hCost; }
    if (state.rockDrillUnlocked) { drillLvlText.innerText = `(Aktywne)`; drillCostText.innerText = `OK`; upgDrillBtn.disabled = true; } else { drillLvlText.innerText = `(Zablok.)`; drillCostText.innerText = `40 ⚙`; upgDrillBtn.disabled = state.sciencePoints < 40; }
  }

  function selectTool(name) {
    const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
    if (btn && !btn.disabled) {
      state.currentTool = name; toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      const cost = BUILDING_COSTS[name] || 0;
      const costBadge = cost > 0 ? `<div style="display:inline-block; background:rgba(63, 185, 80, 0.2); border: 1px solid #3fb950; color:#3fb950; padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:8px;">KOSZT: ${cost} 🧱</div>` : '';
      if (TOOL_HINTS[name]) contextHint.innerHTML = costBadge + TOOL_HINTS[name];
    }
  }

  toolButtons.forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));
  const input = setupInput(canvas, selectTool);

  let matterGainedThisMinute = 0; let scienceGainedThisMinute = 0;
  setInterval(() => { state.matterPerMinute = matterGainedThisMinute; state.sciencePerMinute = scienceGainedThisMinute; matterGainedThisMinute = 0; scienceGainedThisMinute = 0; }, 60000);

  setInterval(() => {
    runSimulationTick((m, s) => {
      if (m > 0) { state.matter += m; matterGainedThisMinute += m; } if (s > 0) { state.sciencePoints += s; scienceGainedThisMinute += s; }
      updateUI();
    }, (finishedLvl) => { updateUI(); saveGame(); });
  }, 100);

  let lastTime = performance.now();
  function render(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now;
    for (let i = state.beltItems.length - 1; i >= 0; i--) {
      const item = state.beltItems[i]; item.progress += dt * state.beltSpeed;
      if (item.progress >= 1.0) {
        const cell = state.grid.get(`${item.curX},${item.curY}`);
        if (!cell) { state.beltItems.splice(i, 1); continue; }
        
        // --- BUDYNKI UTYLIZACJI (SPALARNIA I WYSYPISKO) ---
        if (cell.type === 'incinerator' && item.isWaste) {
          cell.fuelTimer = 150; // Spalarnia generuje prąd z żużla
          state.beltItems.splice(i, 1); continue;
        }
        if (cell.type === 'landfill' && item.isWaste) {
          cell.storedWaste = (cell.storedWaste || 0) + 1;
          state.beltItems.splice(i, 1); continue;
        }

        if (cell.type === 'cutter' && !item.isDye && !item.isWaste && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'rotator' && !item.isDye && !item.isWaste && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        
        if (['merger', 'painter', 'mixer', 'synthesizer'].includes(cell.type)) {
          if (!cell.storedLeft && !item.isWaste) {
            if (cell.type === 'mixer' && item.isDye) cell.storedLeft = item.dyeColor;
            else if (cell.type === 'painter' && !item.isDye) cell.storedLeft = item.shape;
            else if (cell.type === 'synthesizer' && !item.isDye && isFullShapeOfType(item.shape, 'circle')) cell.storedLeft = item.shape;
            else if (cell.type === 'merger' && !item.isDye) cell.storedLeft = item.shape;
            else continue; 
            state.beltItems.splice(i, 1); continue;
          }
        }
        
        if (['merger_sec', 'painter_sec', 'mixer_sec', 'synthesizer_sec'].includes(cell.type)) {
          const main = state.grid.get(cell.partnerKey);
          if (main && !main.storedRight && !item.isWaste) {
            const baseType = main.type;
            if (baseType === 'mixer' && item.isDye) main.storedRight = item.dyeColor;
            else if (baseType === 'painter' && item.isDye) main.storedRight = item.dyeColor; 
            else if (baseType === 'synthesizer' && !item.isDye && isFullShapeOfType(item.shape, 'square')) main.storedRight = item.shape;
            else if (baseType === 'merger' && !item.isDye) main.storedRight = item.shape;
            else continue; 
            state.beltItems.splice(i, 1); continue;
          }
        }

        if (cell.type === 'generator' && !item.isDye && !item.isWaste) { if (isFullShapeOfType(item.shape, 'star')) { cell.fuelTimer = 150; state.beltItems.splice(i, 1); continue; } }
        if (cell.type === 'splitter' && !cell.storedItem) { cell.storedItem = { isDye: item.isDye, isWaste: item.isWaste, dyeColor: item.dyeColor, shape: item.shape }; state.beltItems.splice(i, 1); continue; }
        
        if (cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye && !cell.hasWasteStored) { 
          if (item.isWaste) cell.hasWasteStored = true;
          else if (item.isDye) cell.storedDye = item.dyeColor; 
          else cell.storedShape = item.shape; 
          state.beltItems.splice(i, 1); continue; 
        }

        if (cell.type === 'belt') {
          const dir = DIRS[cell.rot] || DIRS[0]; const nx = item.curX + dir.x; const ny = item.curY + dir.y;
          const nextCell = state.grid.get(`${nx},${ny}`);
          const occupied = state.beltItems.some(o => o !== item && o.curX === nx && o.curY === ny);
          if (!occupied && canEnterMachine(nextCell, item)) { item.curX = nx; item.curY = ny; item.progress = 0; } else { item.progress = 1.0; }
        }
      }
    }

    ctx.fillStyle = '#0d1017'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(state.camera.x, state.camera.y); ctx.scale(state.camera.zoom, state.camera.zoom);
    const startCol = Math.floor((-state.camera.x / state.camera.zoom) / GRID_SIZE) - 1; const endCol = startCol + Math.ceil(canvas.width / state.camera.zoom / GRID_SIZE) + 2;
    const startRow = Math.floor((-state.camera.y / state.camera.zoom) / GRID_SIZE) - 1; const endRow = startRow + Math.ceil(canvas.height / state.camera.zoom / GRID_SIZE) + 2;

    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        const patch = state.patches.get(`${x},${y}`);
        if (patch) {
          const px = x * GRID_SIZE, py = y * GRID_SIZE; ctx.fillStyle = '#151b26'; ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);
          if (patch.kind === 'shape') { ctx.fillStyle = 'rgba(158, 167, 179, 0.35)'; if (patch.subType === 'circle') { ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.32, 0, Math.PI * 2); ctx.fill(); } else { const sz = GRID_SIZE * 0.55; ctx.fillRect(px + (GRID_SIZE - sz) / 2, py + (GRID_SIZE - sz) / 2, sz, sz); } } 
          else if (patch.kind === 'dye') { ctx.fillStyle = COLOR_MAP[patch.subType] || '#ff4d4f'; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
        }
      }
    }

    ctx.strokeStyle = '#19202b'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) { ctx.moveTo(x * GRID_SIZE, startRow * GRID_SIZE); ctx.lineTo(x * GRID_SIZE, endRow * GRID_SIZE); }
    for (let y = startRow; y <= endRow; y++) { ctx.moveTo(startCol * GRID_SIZE, y * GRID_SIZE); ctx.lineTo(endCol * GRID_SIZE, y * GRID_SIZE); }
    ctx.stroke();

    if (state.rocks) { for (let x = startCol; x <= endCol; x++) { for (let y = startRow; y <= endRow; y++) { if (state.rocks.has(`${x},${y}`)) drawRock(ctx, x, y); } } }
    state.grid.forEach(b => { 
      if ((b.type === 'generator' || b.type === 'incinerator') && (b.fuelTimer || 0) > 0) { 
        ctx.fillStyle = 'rgba(250, 219, 20, 0.08)'; ctx.strokeStyle = 'rgba(250, 219, 20, 0.45)'; ctx.lineWidth = 2; 
        ctx.beginPath(); ctx.arc(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2, POWER_RADIUS * GRID_SIZE, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); 
      } 
    });
    state.grid.forEach(b => {
      if (b.type === 'tunnel_in') {
        const dir = DIRS[b.rot];
        for (let dist = 1; dist <= 5; dist++) {
          const tx = b.x + dir.x * dist, ty = b.y + dir.y * dist; const target = state.grid.get(`${tx},${ty}`);
          if (target && target.type === 'tunnel_out' && target.rot === b.rot) { ctx.strokeStyle = '#bf94ff'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2); ctx.lineTo(tx * GRID_SIZE + GRID_SIZE / 2, ty * GRID_SIZE + GRID_SIZE / 2); ctx.stroke(); ctx.setLineDash([]); break; }
        }
      }
    });

    state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0, b));

    const preview = input.getDragPreview();
    if (preview) { preview.forEach(node => { const afford = state.matter >= BUILDING_COSTS['belt']; ctx.strokeStyle = afford ? '' : '#f85149'; drawBuilding(ctx, node.x, node.y, 'belt', node.rot, afford ? 0.45 : 0.7); });
    } else if (input.getHoverTile) {
      const hover = input.getHoverTile();
      if (hover) {
        if (state.currentTool === 'delete') { ctx.strokeStyle = '#f85149'; ctx.lineWidth = 2; ctx.strokeRect(hover.x * GRID_SIZE + 2, hover.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4); } 
        else { const cost = BUILDING_COSTS[state.currentTool] || 0; const afford = state.matter >= cost; if (!afford) { ctx.fillStyle = 'rgba(248, 81, 73, 0.3)'; ctx.fillRect(hover.x * GRID_SIZE, hover.y * GRID_SIZE, GRID_SIZE, GRID_SIZE); } drawBuilding(ctx, hover.x, hover.y, state.currentTool, state.currentRotation, afford ? 0.42 : 0.2); }
      }
    }

    state.beltItems.forEach(item => {
      const cell = state.grid.get(`${item.curX},${item.curY}`); let px = item.curX * GRID_SIZE + GRID_SIZE / 2, py = item.curY * GRID_SIZE + GRID_SIZE / 2;
      if (cell && cell.type === 'belt') { const dir = DIRS[cell.rot] || DIRS[0]; px += dir.x * (item.progress - 0.5) * GRID_SIZE; py += dir.y * (item.progress - 0.5) * GRID_SIZE; }
      
      // Rysowanie przedmiotu na taśmie (Zależnie czy to Żużel, Kolor czy Kształt)
      if (item.isWaste) drawWaste(ctx, px, py, GRID_SIZE * 0.4);
      else if (item.isDye) drawDyeDrop(ctx, px, py, item.dyeColor, GRID_SIZE * 0.4); 
      else drawShape(ctx, px, py, item.shape, GRID_SIZE * 0.38);
    });

    ctx.restore(); requestAnimationFrame(render);
  }
  updateUI(); requestAnimationFrame(render);
})();