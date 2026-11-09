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

  // Gwarancja, że canvas i przycisk pomocy nie przesuwają układu strony
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';

  const levelBadge = document.getElementById('levelBadge');
  const goalTitle = document.getElementById('goalTitle');
  const goalProgressFill = document.getElementById('goalProgressFill');
  const goalProgressText = document.getElementById('goalProgressText');
  const scienceDisplay = document.getElementById('scienceDisplay');
  const contextHint = document.getElementById('contextHint');

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

  // --- SYSTEM SAMOUCZKA KROK PO KROKU I OKIENEK ODBLOKOWAŃ ---
  const UNLOCK_GUIDES = {
    cutter: {
      title: "✂️ Odblokowano: Przecinarka (2x1) oraz Rozdzielacz!",
      body: `
        <p style="margin-bottom:8px;"><b>Przecinarka zajmuje 2 sąsiednie pola!</b> Możesz ją obracać klawiszem <kbd>R</kbd>.</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Doprowadź kształt do <b>głównego pola (ze strzałką wlotową)</b>.</li>
          <li>Maszyna rozcina kształt na pół i wyrzuca <b>dwie połówki równolegle do przodu</b>:
            <br>🔴 <b>Z pierwszego pola:</b> wychodzi Lewa połówka (na pierwszy taśmociąg).
            <br>🔵 <b>Z drugiego pola obok:</b> wychodzi Prawa połówka (na drugi taśmociąg).</li>
          <li><b>Rozdzielacz [0]:</b> rozdziela dowolny strumień naprzemiennie 50/50 (prosto i w prawo).</li>
        </ul>`
    },
    rotator: {
      title: "🔄 Odblokowano: Rotator!",
      body: `
        <p style="margin-bottom:8px;">W Poziomie 3 potrzebujesz <b>Górnych połówek kwadratów</b>, a Przecinarka tnie kształty pionowo (na lewą i prawą połówkę).</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Postaw <b>Przecinarkę [3]</b>, aby uzyskać połówkę kwadratu.</li>
          <li>Skieruj taśmociąg z połówką do <b>Rotatora [4]</b> – obróci on połówkę o 90° w prawo, zamieniając pionową połówkę w poziomą!</li>
        </ul>`
    },
    merger: {
      title: "🧩 Odblokowano: Monter!",
      body: `
        <p style="margin-bottom:8px;"><b>Monter [5]</b> pozwala łączyć dwa różne fragmenty w jeden złożony kształt (Hybrydę).</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Doprowadź do Montera <b>Prawą połówkę kwadratu</b> (jednym taśmociągiem) oraz <b>Lewą połówkę koła</b> (drugim taśmociągiem z boku lub z tyłu).</li>
          <li>Monter sklei je i wypuści gotową Hybrydę przodem!</li>
        </ul>`
    },
    synthesizer: {
      title: "⚗️ Odblokowano: Syntezator Gwiazd!",
      body: `
        <p style="margin-bottom:8px;"><b>Syntezator [8]</b> tworzy surowiec wyższego rzędu – <b>Gwiazdę ⭐</b>.</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li>Doprowadź do Syntezatora <b>1x Pełne Koło</b> oraz <b>1x Pełny Kwadrat</b>.</li>
          <li>Każda dostarczona do Bazy Gwiazda daje aż <b>5 ⚙ punktów nauki</b>!</li>
        </ul>`
    },
    painter: {
      title: "🎨 Odblokowano: Lakiernię oraz Generator Prądu ⚡!",
      body: `
        <p style="margin-bottom:8px;">Twoja fabryka wchodzi w erę kolorów i elektryfikacji!</p>
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li><b>Lakiernia [6]:</b> Postaw Ekstraktor na kolorowym złożu barwnika (np. czerwonym). Doprowadź do Lakierni kształt oraz kroplę barwnika, aby pomalować element!</li>
          <li><b>Generator Prądu [9]:</b> Podaj mu <b>Gwiazdę ⭐</b>. Przez 15 sekund wytworzy pole energetyczne (promień 5 kratek), w którym <b>Ekstraktory wydobywają 2x szybciej</b>!</li>
        </ul>`
    },
    mixer: {
      title: "🧪 Odblokowano: Mieszalnik Barw oraz Tunele Podziemne!",
      body: `
        <ul style="margin-left:18px; line-height:1.6; color:#c9d1d9;">
          <li><b>Mieszalnik [7]:</b> Doprowadź 2 różne barwniki podstawowe (np. Czerwony + Zielony = <b>Żółty</b>, Czerwony + Niebieski = <b>Fioletowy</b>).</li>
          <li><b>Tunele [Q / E]:</b> Pozwalają przesyłać surowce pod ziemią (do 5 kratek) pod innymi taśmociągami i skałami!</li>
        </ul>`
    }
  };

  // Tworzenie paska samouczka krok-po-kroku na górze ekranu
  const stepBanner = document.createElement('div');
  stepBanner.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    background: rgba(22, 27, 34, 0.96); border: 2px solid #58a6ff; border-radius: 10px;
    padding: 10px 18px; color: #f0f6fc; font-size: 13px; max-width: 540px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.65); z-index: 25; pointer-events: auto;
    display: none; line-height: 1.45;
  `;
  document.body.appendChild(stepBanner);

  // Tworzenie wyskakującego okienka przy odblokowaniu nowej maszyny
  const unlockPopup = document.createElement('div');
  unlockPopup.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.72);
    display: none; align-items: center; justify-content: center; z-index: 50;
  `;
  unlockPopup.innerHTML = `
    <div style="background:#161b22; border:2px solid #58a6ff; border-radius:12px; padding:22px 26px; max-width:480px; width:90%; box-shadow:0 16px 40px rgba(0,0,0,0.8); color:#f0f6fc;">
      <h3 id="unlockPopupTitle" style="color:#58a6ff; margin-bottom:12px; font-size:17px;"></h3>
      <div id="unlockPopupBody" style="font-size:13px; margin-bottom:18px;"></div>
      <button id="unlockPopupClose" style="background:#238636; border:1px solid #3fb950; color:#fff; font-weight:700; padding:8px 18px; border-radius:6px; cursor:pointer; width:100%;">Zrozumiano! Kontynuuj budowę</button>
    </div>
  `;
  document.body.appendChild(unlockPopup);
  document.getElementById('unlockPopupClose').addEventListener('click', () => {
    unlockPopup.style.display = 'none';
  });

  function showUnlockGuide(toolKey) {
    const guide = UNLOCK_GUIDES[toolKey];
    if (!guide) return;
    document.getElementById('unlockPopupTitle').innerHTML = guide.title;
    document.getElementById('unlockPopupBody').innerHTML = guide.body;
    unlockPopup.style.display = 'flex';
  }

  function updateInteractiveTutorial() {
    if (state.currentLvlIndex > 0 || state.currentLvlProgress >= 5) {
      stepBanner.style.display = 'none';
      return;
    }

    let hasMinerOnCircle = false;
    let beltCount = 0;

    state.grid.forEach(b => {
      if (b.type === 'miner') {
        const p = state.patches.get(`${b.x},${b.y}`);
        if (p && p.kind === 'shape' && p.subType === 'circle') {
          hasMinerOnCircle = true;
        }
      } else if (b.type === 'belt') {
        beltCount++;
      }
    });

    stepBanner.style.display = 'block';
    if (!hasMinerOnCircle) {
      stepBanner.innerHTML = `
        <div style="color:#58a6ff; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Samouczek — Krok 1 z 3: Pierwsze Wydobycie</div>
        Wybierz <b>Ekstraktor [klawisz 2]</b> na dolnym pasku, najedź na <b>szare złoże Kół</b> i kliknij LPM, aby postawić kopalnię (klawisz <kbd>R</kbd> obraca wylot w stronę bazy).
      `;
    } else if (beltCount < 3) {
      stepBanner.innerHTML = `
        <div style="color:#3fb950; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Samouczek — Krok 2 z 3: Pierwszy Szlak Produkcyjny</div>
        Świetnie! Teraz wybierz <b>Przenośnik [klawisz 1]</b>, kliknij LPM tuż przed wylotem Ekstraktora i <b>przeciągnij taśmociąg</b> aż do fioletowego Rdzenia (2x2) na środku mapy!
      `;
    } else {
      stepBanner.innerHTML = `
        <div style="color:#a371f7; font-weight:700; font-size:11px; text-transform:uppercase; margin-bottom:3px;">Samouczek — Krok 3 z 3: Automatyzacja i Rozbudowa</div>
        Koła jadą do Rdzenia! Postaw więcej Ekstraktorów, aby szybciej dostarczyć <b>15 Pełnych Kół</b> i odblokować dwupolową <b>Przecinarkę (2x1)</b>.
      `;
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  state.camera.x = canvas.width / 2;
  state.camera.y = canvas.height / 2;

  if (!loadGame()) {
    initInitialWorld();
  }
  rebuildHub();

  if (helpBtn && tutorialModal) {
    helpBtn.addEventListener('click', () => { tutorialModal.style.display = 'flex'; });
  }
  if (closeHelpBtn && tutorialModal) {
    closeHelpBtn.addEventListener('click', () => { tutorialModal.style.display = 'none'; });
  }

  if (newMapBtn) {
    newMapBtn.addEventListener('click', () => {
      if (confirm("Wygenerować nową proceduralną mapę? Obecne budynki zostaną usunięte (poziom i badania zostaną zachowane).")) {
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
    // Przecinarka 2x1 przyjmuje kształty na swoim głównym polu
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
    if (nextCell.type === 'generator') {
      if (item.isDye) return false;
      return isFullShapeOfType(item.shape, 'star') && (nextCell.fuelTimer || 0) < 100;
    }
    if (nextCell.type === 'splitter') {
      return !nextCell.storedItem;
    }
    if (nextCell.type === 'tunnel_in') {
      return !nextCell.storedShape && !nextCell.storedDye;
    }
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

    updateInteractiveTutorial();
  }

  function selectTool(name) {
    const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
    if (btn && !btn.disabled) {
      state.currentTool = name;
      toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      if (name === 'cutter') {
        contextHint.innerHTML = "<b>Przecinarka 2x1 [3]:</b> Zajmuje 2 pola! Wlot na 1. polu, z przodu wychodzą równolegle 2 połówki na 2 osobne taśmociągi.";
      } else if (TOOL_HINTS[name]) {
        contextHint.innerHTML = TOOL_HINTS[name];
      }
    }
  }

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  upgBeltBtn.addEventListener('click', () => {
    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    if (state.sciencePoints >= bCost) {
      state.sciencePoints -= bCost;
      state.beltSpeedLvl++;
      state.beltSpeed += 1.0;
      updateUI();
      saveGame();
    }
  });

  upgMinerBtn.addEventListener('click', () => {
    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    if (state.sciencePoints >= mCost) {
      state.sciencePoints -= mCost;
      state.minerSpeedLvl++;
      state.minerInterval = Math.max(2, state.minerInterval - 1);
      updateUI();
      saveGame();
    }
  });

  upgHubBtn.addEventListener('click', () => {
    if (state.hubSize >= 4) return;
    const hCost = state.hubSize === 2 ? 50 : 120;
    if (state.sciencePoints >= hCost) {
      state.sciencePoints -= hCost;
      state.hubSize++;
      rebuildHub();
      updateUI();
      saveGame();
    }
  });

  upgDrillBtn.addEventListener('click', () => {
    if (!state.rockDrillUnlocked && state.sciencePoints >= 40) {
      state.sciencePoints -= 40;
      state.rockDrillUnlocked = true;
      updateUI();
      saveGame();
    }
  });

  resetSaveBtn.addEventListener('click', () => {
    if (confirm("Czy na pewno chcesz zresetować cały zapis gry?")) {
      clearGameSave();
    }
  });

  const input = setupInput(canvas, selectTool);

  setInterval(() => {
    runSimulationTick(updateUI, (finishedLvl) => {
      updateUI();
      saveGame();
      if (finishedLvl && Array.isArray(finishedLvl.unlocks) && finishedLvl.unlocks.length > 0) {
        // Wyświetl okienko instruktażowe dla nowo odblokowanej maszyny
        const primaryUnlock = finishedLvl.unlocks.find(u => UNLOCK_GUIDES[u]) || finishedLvl.unlocks[0];
        showUnlockGuide(primaryUnlock);
      }
    });
    updateInteractiveTutorial();
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
        if (!cell) {
          state.beltItems.splice(i, 1);
          continue;
        }

        if (cell.type === 'cutter' && !item.isDye && !cell.storedShape) {
          cell.storedShape = item.shape;
          state.beltItems.splice(i, 1);
          continue;
        }
        if (cell.type === 'rotator' && !item.isDye && !cell.storedShape) {
          cell.storedShape = item.shape;
          state.beltItems.splice(i, 1);
          continue;
        }
        if (cell.type === 'merger' && !item.isDye) {
          cell.storedInputs = cell.storedInputs || [];
          if (cell.storedInputs.length < 2) {
            cell.storedInputs.push(item.shape);
            state.beltItems.splice(i, 1);
            continue;
          }
        }
        if (cell.type === 'painter') {
          if (item.isDye && !cell.storedDye) {
            cell.storedDye = item.dyeColor;
            state.beltItems.splice(i, 1);
            continue;
          } else if (!item.isDye && !cell.storedShape) {
            cell.storedShape = item.shape;
            state.beltItems.splice(i, 1);
            continue;
          }
        }
        if (cell.type === 'mixer' && item.isDye) {
          cell.storedDyes = cell.storedDyes || [];
          if (cell.storedDyes.length === 0 || (cell.storedDyes.length === 1 && cell.storedDyes[0] !== item.dyeColor)) {
            cell.storedDyes.push(item.dyeColor);
            state.beltItems.splice(i, 1);
            continue;
          }
        }
        if (cell.type === 'synthesizer' && !item.isDye) {
          if (isFullShapeOfType(item.shape, 'circle') && !cell.hasCircle) {
            cell.hasCircle = true;
            cell.circleColor = item.shape[0].color;
            state.beltItems.splice(i, 1);
            continue;
          }
          if (isFullShapeOfType(item.shape, 'square') && !cell.hasSquare) {
            cell.hasSquare = true;
            cell.squareColor = item.shape[0].color;
            state.beltItems.splice(i, 1);
            continue;
          }
        }
        if (cell.type === 'generator' && !item.isDye) {
          if (isFullShapeOfType(item.shape, 'star')) {
            cell.fuelTimer = 150;
            state.beltItems.splice(i, 1);
            continue;
          }
        }
        if (cell.type === 'splitter' && !cell.storedItem) {
          cell.storedItem = { isDye: item.isDye, dyeColor: item.dyeColor, shape: item.shape };
          state.beltItems.splice(i, 1);
          continue;
        }
        if (cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye) {
          if (item.isDye) cell.storedDye = item.dyeColor;
          else cell.storedShape = item.shape;
          state.beltItems.splice(i, 1);
          continue;
        }

        if (cell.type === 'belt') {
          const dir = DIRS[cell.rot] || DIRS[0];
          const nx = item.curX + dir.x;
          const ny = item.curY + dir.y;
          const nextCell = state.grid.get(`${nx},${ny}`);
          const occupied = state.beltItems.some(other => other !== item && other.curX === nx && other.curY === ny);

          if (!occupied && canEnterMachine(nextCell, item)) {
            item.curX = nx;
            item.curY = ny;
            item.progress = 0;
          } else {
            item.progress = 1.0;
          }
        }
      }
    }

    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(state.camera.x, state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    const startCol = Math.floor((-state.camera.x / state.camera.zoom) / GRID_SIZE) - 1;
    const endCol = startCol + Math.ceil(canvas.width / state.camera.zoom / GRID_SIZE) + 2;
    const startRow = Math.floor((-state.camera.y / state.camera.zoom) / GRID_SIZE) - 1;
    const endRow = startRow + Math.ceil(canvas.height / state.camera.zoom / GRID_SIZE) + 2;

    // 1. Złoża surowców i barwników RGB
    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        const key = `${x},${y}`;
        const patch = state.patches.get(key);
        if (patch) {
          const px = x * GRID_SIZE;
          const py = y * GRID_SIZE;
          ctx.fillStyle = '#151b26';
          ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);

          if (patch.kind === 'shape') {
            ctx.fillStyle = 'rgba(158, 167, 179, 0.35)';
            if (patch.subType === 'circle') {
              ctx.beginPath();
              ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.32, 0, Math.PI * 2);
              ctx.fill();
            } else {
              const sz = GRID_SIZE * 0.55;
              ctx.fillRect(px + (GRID_SIZE - sz) / 2, py + (GRID_SIZE - sz) / 2, sz, sz);
            }
          } else if (patch.kind === 'dye') {
            ctx.fillStyle = COLOR_MAP[patch.subType] || '#ff4d4f';
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }
      }
    }

    // 2. Siatka
    ctx.strokeStyle = '#19202b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) {
      ctx.moveTo(x * GRID_SIZE, startRow * GRID_SIZE);
      ctx.lineTo(x * GRID_SIZE, endRow * GRID_SIZE);
    }
    for (let y = startRow; y <= endRow; y++) {
      ctx.moveTo(startCol * GRID_SIZE, y * GRID_SIZE);
      ctx.lineTo(endCol * GRID_SIZE, y * GRID_SIZE);
    }
    ctx.stroke();

    // 3. Skały
    if (state.rocks) {
      for (let x = startCol; x <= endCol; x++) {
        for (let y = startRow; y <= endRow; y++) {
          if (state.rocks.has(`${x},${y}`)) {
            drawRock(ctx, x, y);
          }
        }
      }
    }

    // 4. Strefy zasilania wokół aktywnych Generatorów Prądu
    state.grid.forEach(b => {
      if (b.type === 'generator' && (b.fuelTimer || 0) > 0) {
        const cx = b.x * GRID_SIZE + GRID_SIZE / 2;
        const cy = b.y * GRID_SIZE + GRID_SIZE / 2;
        const rad = POWER_RADIUS * GRID_SIZE;

        ctx.fillStyle = 'rgba(250, 219, 20, 0.08)';
        ctx.strokeStyle = 'rgba(250, 219, 20, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // 5. Linie podziemne tuneli
    state.grid.forEach(b => {
      if (b.type === 'tunnel_in') {
        const dir = DIRS[b.rot];
        for (let dist = 1; dist <= 5; dist++) {
          const tx = b.x + dir.x * dist;
          const ty = b.y + dir.y * dist;
          const target = state.grid.get(`${tx},${ty}`);
          if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
            ctx.strokeStyle = '#bf94ff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2);
            ctx.lineTo(tx * GRID_SIZE + GRID_SIZE / 2, ty * GRID_SIZE + GRID_SIZE / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            break;
          }
        }
      }
    });

    // 6. Budynki
    state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0, b));

    // 7. Podgląd przeciągania taśmociągu lub podgląd "ducha" budynku pod kursorem
    const preview = input.getDragPreview();
    if (preview) {
      preview.forEach(node => drawBuilding(ctx, node.x, node.y, 'belt', node.rot, 0.45));
    } else if (input.getHoverTile) {
      const hover = input.getHoverTile();
      if (hover) {
        if (state.currentTool === 'delete') {
          ctx.strokeStyle = '#f85149';
          ctx.lineWidth = 2;
          ctx.strokeRect(hover.x * GRID_SIZE + 2, hover.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        } else {
          drawBuilding(ctx, hover.x, hover.y, state.currentTool, state.currentRotation, 0.42);
        }
      }
    }

    // 8. Przedmioty na taśmach
    state.beltItems.forEach(item => {
      const cell = state.grid.get(`${item.curX},${item.curY}`);
      let px = item.curX * GRID_SIZE + GRID_SIZE / 2;
      let py = item.curY * GRID_SIZE + GRID_SIZE / 2;

      if (cell && cell.type === 'belt') {
        const dir = DIRS[cell.rot] || DIRS[0];
        px += dir.x * (item.progress - 0.5) * GRID_SIZE;
        py += dir.y * (item.progress - 0.5) * GRID_SIZE;
      }

      if (item.isDye) {
        drawDyeDrop(ctx, px, py, item.dyeColor, GRID_SIZE * 0.4);
      } else {
        drawShape(ctx, px, py, item.shape, GRID_SIZE * 0.38);
      }
    });

    ctx.restore();
    requestAnimationFrame(render);
  }

  updateUI();
  requestAnimationFrame(render);
})();