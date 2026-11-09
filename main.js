(function() {
  const {
    GRID_SIZE, DIRS, LEVELS, COLOR_MAP, TOOL_HINTS, POWER_RADIUS,
    state, initInitialWorld, rebuildHub,
    saveGame, loadGame, clearGameSave,
    runSimulationTick, isFullShapeOfType,
    drawShape, drawDyeDrop, drawRock, drawBuilding,
    setupInput
  } = window.Factory;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const goalCanvas = document.getElementById('goalCanvas');
  const goalCtx = goalCanvas.getContext('2d');

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

  helpBtn.addEventListener('click', () => { tutorialModal.style.display = 'flex'; });
  closeHelpBtn.addEventListener('click', () => { tutorialModal.style.display = 'none'; });

  newMapBtn.addEventListener('click', () => {
    if (confirm("Wygenerować nową proceduralną mapę? Obecne budynki zostaną usunięte (poziom i badania zostaną zachowane).")) {
      initInitialWorld(Math.floor(Math.random() * 1000000));
      saveGame();
      updateUI();
    }
  });

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
      hubLvlText.innerText = `(${state.hubSize}x${state.hubSize} -> ${state.hubSize+1}x${state.hubSize+1})`;
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
      if (TOOL_HINTS[name]) {
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
    runSimulationTick(updateUI);
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
            cell.fuelTimer = 150; // 15 sekund (150 ticków po 100ms)
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
    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        if (state.rocks.has(`${x},${y}`)) {
          drawRock(ctx, x, y);
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
            ctx.moveTo(b.x * GRID_SIZE + GRID_SIZE/2, b.y * GRID_SIZE + GRID_SIZE/2);
            ctx.lineTo(tx * GRID_SIZE + GRID_SIZE/2, ty * GRID_SIZE + GRID_SIZE/2);
            ctx.stroke();
            ctx.setLineDash([]);
            break;
          }
        }
      }
    });

    // 6. Budynki
    state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0, b));

    // 7. Podgląd przeciągania
    const preview = input.getDragPreview();
    if (preview) {
      preview.forEach(node => drawBuilding(ctx, node.x, node.y, 'belt', node.rot, 0.45));
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