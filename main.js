(function() {
  const { GRID_SIZE, DIRS, LEVELS, COLOR_MAP, POWER_RADIUS, state, initInitialWorld, saveGame, loadGame, clearGameSave, runSimulationTick, isFullShapeOfType, drawShape, drawDyeDrop, drawRock, drawBuilding, setupInput } = window.Factory;

  state.rocks = state.rocks || new Set(); state.patches = state.patches || new Map(); state.grid = state.grid || new Map();
  state.beltItems = state.beltItems || []; state.hubSize = state.hubSize || 2; state.rockDrillUnlocked = Boolean(state.rockDrillUnlocked);
  state.matter = state.matter || 200; state.matterPerMinute = state.matterPerMinute || 0; state.sciencePerMinute = state.sciencePerMinute || 0;
  
  const BUILDING_COSTS = { belt: 1, miner: 15, cutter: 30, rotator: 20, merger: 40, painter: 50, mixer: 60, synthesizer: 100, generator: 150, splitter: 10, tunnel_in: 25, tunnel_out: 25 };
  
  // Słownik zaktualizowanych podpowiedzi dla dolnego paska gry
  const TOOL_HINTS = {
    belt: "Kieruje przepływem. Możesz budować je seriami przeciągając wciśnięty przycisk.",
    miner: "Wydobywa surowce ze złoża.",
    cutter: "Zajmuje 2 pola. Przecina kształt i wypluwa 2 połówki na 2 osobne taśmociągi.",
    rotator: "Obraca kształt o 90° w prawo.",
    merger: "Zajmuje 2 pola. Wprowadź połówkę do lewego i prawego wejścia z tyłu. Z przodu wychodzi sklejony kształt.",
    painter: "Pomaluj kształt (wymaga 1 Kształtu i 1 Kropli Barwnika na taśmie).",
    mixer: "Łączy dwa barwniki podstawowe by stworzyć nowy.",
    synthesizer: "Tworzy wysokoenergetyczną Gwiazdę z 1 Pełnego Koła i 1 Pełnego Kwadratu.",
    generator: "Spal Gwiazdę, by podwoić prędkość kopalni w okolicy przez 15 sekund.",
    splitter: "Rozdziela 50/50 na wprost i na bok.",
    tunnel_in: "Omija do 5 pól pod ziemią.",
    tunnel_out: "Odbiera surowce z wejścia.",
    delete: "Rozbiera element (Zwrot 50% materiałów). Kruszy skały po zbadaniu."
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
  const uiContainer = document.getElementById('ui'); if (uiContainer) uiContainer.style.zIndex = '10';
  const toolbarContainer = document.getElementById('toolbar'); if (toolbarContainer) toolbarContainer.style.zIndex = '10';

  const levelBadge = document.getElementById('levelBadge'); const goalTitle = document.getElementById('goalTitle');
  const goalProgressFill = document.getElementById('goalProgressFill'); const goalProgressText = document.getElementById('goalProgressText');
  const scienceDisplay = document.getElementById('scienceDisplay'); const contextHint = document.getElementById('contextHint');

  if (scienceDisplay && !document.getElementById('matterDisplay')) {
    const matterDiv = document.createElement('div'); matterDiv.id = 'matterDisplay'; matterDiv.className = 'science-score';
    matterDiv.style.color = '#3fb950'; matterDiv.style.marginBottom = '2px'; matterDiv.innerHTML = `200 🧱 Materii`;
    scienceDisplay.parentNode.insertBefore(matterDiv, scienceDisplay);
  }
  const matterDisplay = document.getElementById('matterDisplay');
  const resetSaveBtn = document.getElementById('resetSaveBtn'); const newMapBtn = document.getElementById('newMapBtn');
  const helpBtn = document.getElementById('helpBtn'); const closeHelpBtn = document.getElementById('closeHelpBtn'); const tutorialModal = document.getElementById('tutorialModal');
  if (helpBtn) { helpBtn.style.position = 'fixed'; helpBtn.style.top = '16px'; helpBtn.style.right = '16px'; helpBtn.style.zIndex = '20'; }

  const upgBeltBtn = document.getElementById('upgBelt'); const upgMinerBtn = document.getElementById('upgMiner');
  const upgHubBtn = document.getElementById('upgHub'); const upgDrillBtn = document.getElementById('upgDrill');
  const beltLvlText = document.getElementById('beltLvl'); const minerLvlText = document.getElementById('minerLvl');
  const hubLvlText = document.getElementById('hubLvl'); const drillLvlText = document.getElementById('drillLvl');
  const beltCostText = document.getElementById('beltCost'); const minerCostText = document.getElementById('minerCost');
  const hubCostText = document.getElementById('hubCost'); const drillCostText = document.getElementById('drillCost');
  const toolButtons = document.querySelectorAll('.tool-btn');

  const UNLOCK_GUIDES = {
    cutter: { title: "✂️ Odblokowano: Przecinarka (2x1) oraz Rozdzielacz!", body: `
        <p style="margin-bottom:8px;">Maszyna zajmuje <b>2 kafelki</b>. Ostrze tnie napływające elementy pionowo na pół.</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Lewa i Prawa połówka wyjeżdżają od frontu maszyny po dwóch różnych taśmociągach.</li>
          <li><b>Koszty budowy</b>: każda budowla kosztuje 🧱 Materię wytwarzaną przez Rdzeń z dowożonych materiałów.</li>
        </ul>` },
    rotator: { title: "🔄 Odblokowano: Rotator!", body: `
        <p style="margin-bottom:8px;">Przecinarka tnie pionowo, ale jak zdobyć górną połówkę kwadratu?</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;"><li>Przepuść obciętą prawą połówkę przez Rotator, by obrócić ją w pozycję poziomą.</li></ul>` },
    merger: { title: "🧩 Odblokowano: Monter (2x1)!", body: `
        <p style="margin-bottom:8px;">Zajmuje 2 kafelki (jak Przecinarka), by pomieścić dwa wejścia.</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Wprowadź z tyłu z lewej strony pierwszy kształt, a z prawej drugi kształt.</li>
          <li>Złączony, hybrydowy kształt wyjedzie z przodu maszyny!</li>
        </ul>` },
    synthesizer: { title: "⚗️ Odblokowano: Syntezator Gwiazd!", body: `<p style="margin-bottom:8px;">Doprowadź pełne Koło i Kwadrat, by stworzyć Gwiazdę ⭐ (5 ⚙).</p>` },
    painter: { title: "🎨 Odblokowano: Lakiernię oraz Generator Prądu ⚡!", body: `<ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;"><li><b>Lakiernia:</b> Kształt i barwnik ze złoża.</li><li><b>Generator:</b> Nakarm Gwiazdą by podwoić prędkość kopalń.</li></ul>` },
    mixer: { title: "🧪 Odblokowano: Mieszalnik Barw oraz Tunele Podziemne!", body: `<ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;"><li>Mieszaj 2 barwniki w 1 nowy.</li><li>Tunele omijają pod ziemią do 5 przeszkód.</li></ul>` }
  };

  const stepBanner = document.createElement('div');
  stepBanner.style.cssText = `position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(22, 27, 34, 0.96); border: 2px solid #58a6ff; border-radius: 10px; padding: 10px 18px; color: #f0f6fc; font-size: 13px; max-width: 540px; box-shadow: 0 10px 28px rgba(0,0,0,0.65); z-index: 25; pointer-events: auto; display: none; line-height: 1.45;`;
  document.body.appendChild(stepBanner);

  const unlockPopup = document.createElement('div');
  unlockPopup.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.72); display: none; align-items: center; justify-content: center; z-index: 50;`;
  unlockPopup.innerHTML = `<div style="background:#161b22; border:2px solid #58a6ff; border-radius:12px; padding:22px 26px; max-width:480px; width:90%; box-shadow:0 16px 40px rgba(0,0,0,0.8); color:#f0f6fc;"><h3 id="unlockPopupTitle" style="color:#58a6ff; margin-bottom:12px; font-size:17px;"></h3><div id="unlockPopupBody" style="font-size:13px; margin-bottom:18px;"></div><button id="unlockPopupClose" style="background:#238636; border:1px solid #3fb950; color:#fff; font-weight:700; padding:8px 18px; border-radius:6px; cursor:pointer; width:100%;">Kontynuuj budowę</button></div>`;
  document.body.appendChild(unlockPopup); document.getElementById('unlockPopupClose').addEventListener('click', () => unlockPopup.style.display = 'none');

  const offlinePopup = document.createElement('div');
  offlinePopup.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 100;`;
  offlinePopup.innerHTML = `<div style="background:#161b22; border:2px solid #3fb950; border-radius:12px; padding:26px; max-width:420px; width:90%; box-shadow:0 16px 40px rgba(0,0,0,0.8); color:#f0f6fc; text-align:center;"><h3 style="color:#3fb950; margin-bottom:12px; font-size:18px;">🌙 Witaj ponownie!</h3><p style="font-size:13px; color:#c9d1d9; margin-bottom:20px;">Podczas Twojej nieobecności (<span id="offlineTimeStr">0h</span>) fabryka działała.</p><div style="display:flex; justify-content:space-around; margin-bottom:24px; background:#0d1117; padding:12px; border-radius:8px;"><div><div style="font-size:11px; color:#8b949e; text-transform:uppercase;">Materia</div><div style="color:#3fb950; font-weight:bold; font-size:20px;">+<span id="offlineMatterVal">0</span> 🧱</div></div><div><div style="font-size:11px; color:#8b949e; text-transform:uppercase;">Nauka</div><div style="color:#a371f7; font-weight:bold; font-size:20px;">+<span id="offlineScienceVal">0</span> ⚙</div></div></div><button id="offlinePopupClose" style="background:#238636; border:1px solid #3fb950; color:#fff; font-weight:700; padding:10px 20px; border-radius:6px; cursor:pointer; width:100%;">Zbierz</button></div>`;
  document.body.appendChild(offlinePopup); document.getElementById('offlinePopupClose').addEventListener('click', () => offlinePopup.style.display = 'none');

  function showUnlockGuide(toolKey) { const guide = UNLOCK_GUIDES[toolKey]; if (!guide) return; document.getElementById('unlockPopupTitle').innerHTML = guide.title; document.getElementById('unlockPopupBody').innerHTML = guide.body; unlockPopup.style.display = 'flex'; }
  function updateInteractiveTutorial() {
    if (state.currentLvlIndex > 0 || state.currentLvlProgress >= 5) { stepBanner.style.display = 'none'; return; }
    let hasMinerOnCircle = false; let beltCount = 0;
    state.grid.forEach(b => {
      if (b.type === 'miner') { const p = state.patches.get(`${b.x},${b.y}`); if (p && p.kind === 'shape' && p.subType === 'circle') hasMinerOnCircle = true; } 
      else if (b.type === 'belt') beltCount++;
    });
    stepBanner.style.display = 'block';
    if (!hasMinerOnCircle) stepBanner.innerHTML = `<div style="color:#58a6ff; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Krok 1 z 3: Wydobycie</div>Postaw Ekstraktor na kółku.`;
    else if (beltCount < 3) stepBanner.innerHTML = `<div style="color:#3fb950; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Krok 2 z 3: Szlak Produkcyjny</div>Połącz taśmą Ekstraktor z Rdzeniem bazy.`;
    else stepBanner.innerHTML = `<div style="color:#a371f7; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Krok 3 z 3: Dostawy</div>Dostarcz 15 Koł i zbieraj 🧱 Materię (zieloną energię nad punktami)!`;
  }
  function calculateOfflineProgress() {
    const now = Date.now(); const lastTime = state.lastSaveTime || now; const diffMinutes = Math.floor((now - lastTime) / 60000);
    if (diffMinutes > 3 && (state.matterPerMinute > 0 || state.sciencePerMinute > 0)) {
      const effective = Math.min(diffMinutes, 24 * 60);
      const m = effective * (state.matterPerMinute || 0); const s = effective * (state.sciencePerMinute || 0);
      state.matter += m; state.sciencePoints += s;
      document.getElementById('offlineTimeStr').innerText = `${Math.floor(effective/60)}h ${effective%60}m`;
      document.getElementById('offlineMatterVal').innerText = m; document.getElementById('offlineScienceVal').innerText = s;
      offlinePopup.style.display = 'flex';
    }
    state.lastSaveTime = now;
  }

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } window.addEventListener('resize', resize); resize();
  state.camera.x = canvas.width / 2; state.camera.y = canvas.height / 2;
  if (!loadGame()) initInitialWorld(); rebuildHub(); calculateOfflineProgress();
  if (helpBtn) helpBtn.addEventListener('click', () => tutorialModal.style.display = 'flex'); if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => tutorialModal.style.display = 'none');
  if (newMapBtn) newMapBtn.addEventListener('click', () => { if (confirm("Nowa mapa?")) { initInitialWorld(Math.floor(Math.random() * 1000000)); rebuildHub(); saveGame(); updateUI(); } });

  function canEnterMachine(nextCell, item) {
    if (!nextCell) return false; if (nextCell.type === 'belt' || nextCell.type === 'hub') return true;
    if (nextCell.type === 'cutter') return !item.isDye && !nextCell.storedShape;
    if (nextCell.type === 'rotator') return !item.isDye && !nextCell.storedShape;
    // Blokada wejść Montera - połówka czeka w wlocie
    if (nextCell.type === 'merger') return !item.isDye && !nextCell.storedLeft;
    if (nextCell.type === 'merger_sec') { const main = state.grid.get(nextCell.partnerKey); return main && !item.isDye && !main.storedRight; }
    if (nextCell.type === 'painter') { if (item.isDye) return !nextCell.storedDye; return !nextCell.storedShape; }
    if (nextCell.type === 'mixer') { if (!item.isDye) return false; const dyes = nextCell.storedDyes || []; if (dyes.length === 0) return true; if (dyes.length === 1 && dyes[0] !== item.dyeColor) return true; return false; }
    if (nextCell.type === 'synthesizer') { if (item.isDye) return false; if (isFullShapeOfType(item.shape, 'circle') && !nextCell.hasCircle) return true; if (isFullShapeOfType(item.shape, 'square') && !nextCell.hasSquare) return true; return false; }
    if (nextCell.type === 'generator') return isFullShapeOfType(item.shape, 'star') && (nextCell.fuelTimer || 0) < 100;
    if (nextCell.type === 'splitter') return !nextCell.storedItem;
    if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye;
    return false;
  }

  function updateUI() {
    const current = LEVELS[state.currentLvlIndex] || LEVELS[LEVELS.length - 1];
    levelBadge.innerText = `POZIOM ${current.lvl}`; goalTitle.innerText = current.title;
    goalProgressText.innerText = `${state.currentLvlProgress} / ${current.requiredCount}`;
    goalProgressFill.style.width = `${Math.min(100, (state.currentLvlProgress / current.requiredCount) * 100)}%`;
    goalCtx.clearRect(0, 0, 42, 42); drawShape(goalCtx, 21, 21, current.targetShape, 26);
    LEVELS.forEach((lvl, idx) => { if (idx < state.currentLvlIndex) { lvl.unlocks.forEach(t => { const btn = document.getElementById(`tool-${t}`); if (btn) { btn.disabled = false; const sc = btn.querySelector('.shortcut'); if (sc) sc.innerText = sc.innerText.replace(' 🔒', ''); } }); } });
    scienceDisplay.innerText = `${state.sciencePoints} ⚙`; if (matterDisplay) matterDisplay.innerText = `${Math.floor(state.matter)} 🧱 Materii`;
    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1)); beltCostText.innerText = `${bCost} ⚙`; beltLvlText.innerText = `(Poz. ${state.beltSpeedLvl})`; upgBeltBtn.disabled = state.sciencePoints < bCost;
    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1)); minerCostText.innerText = `${mCost} ⚙`; minerLvlText.innerText = `(Poz. ${state.minerSpeedLvl})`; upgMinerBtn.disabled = state.sciencePoints < mCost;
    if (state.hubSize >= 4) { hubLvlText.innerText = `(4x4 MAX)`; hubCostText.innerText = `MAX`; upgHubBtn.disabled = true; } else { const hCost = state.hubSize === 2 ? 50 : 120; hubLvlText.innerText = `(${state.hubSize}x${state.hubSize} -> ${state.hubSize + 1}x${state.hubSize + 1})`; hubCostText.innerText = `${hCost} ⚙`; upgHubBtn.disabled = state.sciencePoints < hCost; }
    if (state.rockDrillUnlocked) { drillLvlText.innerText = `(Aktywne)`; drillCostText.innerText = `OK`; upgDrillBtn.disabled = true; } else { drillLvlText.innerText = `(Zablok.)`; drillCostText.innerText = `40 ⚙`; upgDrillBtn.disabled = state.sciencePoints < 40; }
    updateInteractiveTutorial();
  }

  function selectTool(name) {
    const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
    if (btn && !btn.disabled) {
      state.currentTool = name;
      toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      
      const cost = BUILDING_COSTS[name] || 0;
      // Mocne wyeksponowanie kosztu materiałów przy zmianie narzędzia
      const costBadge = cost > 0 ? `<div style="display:inline-block; background:rgba(63, 185, 80, 0.2); border: 1px solid #3fb950; color:#3fb950; padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:8px;">KOSZT: ${cost} 🧱</div>` : '';
      
      if (TOOL_HINTS[name]) {
        contextHint.innerHTML = costBadge + TOOL_HINTS[name];
      }
    }
  }

  toolButtons.forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));

  upgBeltBtn.addEventListener('click', () => { const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1)); if (state.sciencePoints >= bCost) { state.sciencePoints -= bCost; state.beltSpeedLvl++; state.beltSpeed += 1.0; updateUI(); saveGame(); } });
  upgMinerBtn.addEventListener('click', () => { const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1)); if (state.sciencePoints >= mCost) { state.sciencePoints -= mCost; state.minerSpeedLvl++; state.minerInterval = Math.max(2, state.minerInterval - 1); updateUI(); saveGame(); } });
  upgHubBtn.addEventListener('click', () => { if (state.hubSize >= 4) return; const hCost = state.hubSize === 2 ? 50 : 120; if (state.sciencePoints >= hCost) { state.sciencePoints -= hCost; state.hubSize++; rebuildHub(); updateUI(); saveGame(); } });
  upgDrillBtn.addEventListener('click', () => { if (!state.rockDrillUnlocked && state.sciencePoints >= 40) { state.sciencePoints -= 40; state.rockDrillUnlocked = true; updateUI(); saveGame(); } });
  resetSaveBtn.addEventListener('click', () => { if (confirm("Zresetować zapis?")) clearGameSave(); });

  const input = setupInput(canvas, selectTool);

  let matterGainedThisMinute = 0; let scienceGainedThisMinute = 0;
  setInterval(() => { state.matterPerMinute = matterGainedThisMinute; state.sciencePerMinute = scienceGainedThisMinute; matterGainedThisMinute = 0; scienceGainedThisMinute = 0; }, 60000);

  setInterval(() => {
    runSimulationTick((m, s) => {
      if (m > 0) { state.matter += m; matterGainedThisMinute += m; } if (s > 0) { state.sciencePoints += s; scienceGainedThisMinute += s; }
      updateUI();
    }, (finishedLvl) => {
      updateUI(); saveGame();
      if (finishedLvl && Array.isArray(finishedLvl.unlocks) && finishedLvl.unlocks.length > 0) { const primaryUnlock = finishedLvl.unlocks.find(u => UNLOCK_GUIDES[u]) || finishedLvl.unlocks[0]; showUnlockGuide(primaryUnlock); }
    });
  }, 100);

  setInterval(() => saveGame(), 5000); window.addEventListener('beforeunload', () => saveGame());

  let lastTime = performance.now();
  function render(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now;
    for (let i = state.beltItems.length - 1; i >= 0; i--) {
      const item = state.beltItems[i]; item.progress += dt * state.beltSpeed;
      if (item.progress >= 1.0) {
        const cell = state.grid.get(`${item.curX},${item.curY}`);
        if (!cell) { state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'cutter' && !item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'rotator' && !item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        
        // Monter wejścia
        if (cell.type === 'merger' && !item.isDye && !cell.storedLeft) { cell.storedLeft = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'merger_sec' && !item.isDye) { const main = state.grid.get(cell.partnerKey); if (main && !main.storedRight) { main.storedRight = item.shape; state.beltItems.splice(i, 1); continue; } }
        
        if (cell.type === 'painter') { if (item.isDye && !cell.storedDye) { cell.storedDye = item.dyeColor; state.beltItems.splice(i, 1); continue; } else if (!item.isDye && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; } }
        if (cell.type === 'mixer' && item.isDye) { cell.storedDyes = cell.storedDyes || []; if (cell.storedDyes.length === 0 || (cell.storedDyes.length === 1 && cell.storedDyes[0] !== item.dyeColor)) { cell.storedDyes.push(item.dyeColor); state.beltItems.splice(i, 1); continue; } }
        if (cell.type === 'synthesizer' && !item.isDye) { if (isFullShapeOfType(item.shape, 'circle') && !cell.hasCircle) { cell.hasCircle = true; cell.circleColor = item.shape[0].color; state.beltItems.splice(i, 1); continue; } if (isFullShapeOfType(item.shape, 'square') && !cell.hasSquare) { cell.hasSquare = true; cell.squareColor = item.shape[0].color; state.beltItems.splice(i, 1); continue; } }
        if (cell.type === 'generator' && !item.isDye) { if (isFullShapeOfType(item.shape, 'star')) { cell.fuelTimer = 150; state.beltItems.splice(i, 1); continue; } }
        if (cell.type === 'splitter' && !cell.storedItem) { cell.storedItem = { isDye: item.isDye, dyeColor: item.dyeColor, shape: item.shape }; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye) { if (item.isDye) cell.storedDye = item.dyeColor; else cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }

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
          const px = x * GRID_SIZE, py = y * GRID_SIZE;
          ctx.fillStyle = '#151b26'; ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);
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
    state.grid.forEach(b => { if (b.type === 'generator' && (b.fuelTimer || 0) > 0) { ctx.fillStyle = 'rgba(250, 219, 20, 0.08)'; ctx.strokeStyle = 'rgba(250, 219, 20, 0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2, POWER_RADIUS * GRID_SIZE, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } });
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
    if (preview) {
      preview.forEach(node => { const afford = state.matter >= BUILDING_COSTS['belt']; ctx.strokeStyle = afford ? '' : '#f85149'; drawBuilding(ctx, node.x, node.y, 'belt', node.rot, afford ? 0.45 : 0.7); });
    } else if (input.getHoverTile) {
      const hover = input.getHoverTile();
      if (hover) {
        if (state.currentTool === 'delete') { ctx.strokeStyle = '#f85149'; ctx.lineWidth = 2; ctx.strokeRect(hover.x * GRID_SIZE + 2, hover.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4); } 
        else { const cost = BUILDING_COSTS[state.currentTool] || 0; const afford = state.matter >= cost; if (!afford) { ctx.fillStyle = 'rgba(248, 81, 73, 0.3)'; ctx.fillRect(hover.x * GRID_SIZE, hover.y * GRID_SIZE, GRID_SIZE, GRID_SIZE); } drawBuilding(ctx, hover.x, hover.y, state.currentTool, state.currentRotation, afford ? 0.42 : 0.2); }
      }
    }

    state.beltItems.forEach(item => {
      const cell = state.grid.get(`${item.curX},${item.curY}`);
      let px = item.curX * GRID_SIZE + GRID_SIZE / 2, py = item.curY * GRID_SIZE + GRID_SIZE / 2;
      if (cell && cell.type === 'belt') { const dir = DIRS[cell.rot] || DIRS[0]; px += dir.x * (item.progress - 0.5) * GRID_SIZE; py += dir.y * (item.progress - 0.5) * GRID_SIZE; }
      if (item.isDye) drawDyeDrop(ctx, px, py, item.dyeColor, GRID_SIZE * 0.4); else drawShape(ctx, px, py, item.shape, GRID_SIZE * 0.38);
    });

    ctx.restore(); requestAnimationFrame(render);
  }
  updateUI(); requestAnimationFrame(render);
})();