import { GRID_SIZE, DIRS, LEVELS, COLOR_MAP } from './config.js';
import { state, initInitialWorld } from './state.js';
import { saveGame, loadGame, clearGameSave } from './storage.js';
import { runSimulationTick } from './logic.js';
import { drawShape, drawDyeDrop, drawBuilding } from './renderer.js';
import { setupInput } from './input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const goalCanvas = document.getElementById('goalCanvas');
const goalCtx = goalCanvas.getContext('2d');

const levelBadge = document.getElementById('levelBadge');
const goalTitle = document.getElementById('goalTitle');
const goalProgressFill = document.getElementById('goalProgressFill');
const goalProgressText = document.getElementById('goalProgressText');
const scienceDisplay = document.getElementById('scienceDisplay');
const resetSaveBtn = document.getElementById('resetSaveBtn');

const upgBeltBtn = document.getElementById('upgBelt');
const upgMinerBtn = document.getElementById('upgMiner');
const beltLvlText = document.getElementById('beltLvl');
const minerLvlText = document.getElementById('minerLvl');
const beltCostText = document.getElementById('beltCost');
const minerCostText = document.getElementById('minerCost');
const toolButtons = document.querySelectorAll('.tool-btn');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

state.camera.x = canvas.width / 2;
state.camera.y = canvas.height / 2;

initInitialWorld();
loadGame(state);

function updateUI() {
  const current = LEVELS[state.currentLvlIndex];
  if (!current) return;

  levelBadge.innerText = `POZIOM ${current.lvl}`;
  goalTitle.innerText = current.title;
  goalProgressText.innerText = `${state.currentLvlProgress} / ${current.requiredCount}`;
  const pct = Math.min(100, (state.currentLvlProgress / current.requiredCount) * 100);
  goalProgressFill.style.width = `${pct}%`;

  goalCtx.clearRect(0, 0, 36, 36);
  drawShape(goalCtx, 18, 18, current.targetShape, 24);

  LEVELS.forEach((lvl, idx) => {
    if (idx < state.currentLvlIndex) {
      lvl.unlocks.forEach(t => {
        const btn = document.getElementById(`tool-${t}`);
        if (btn) {
          btn.disabled = false;
          btn.querySelector('.shortcut').innerText = btn.querySelector('.shortcut').innerText.replace(' 🔒', '');
        }
      });
    }
  });

  scienceDisplay.innerText = `${state.sciencePoints} ⚙`;
  const bCost = Math.round(25 * Math.pow(1.8, state.beltSpeedLvl - 1));
  beltCostText.innerText = `${bCost} ⚙`;
  beltLvlText.innerText = `(Poz. ${state.beltSpeedLvl})`;
  upgBeltBtn.disabled = state.sciencePoints < bCost;

  const mCost = Math.round(30 * Math.pow(1.8, state.minerSpeedLvl - 1));
  minerCostText.innerText = `${mCost} ⚙`;
  minerLvlText.innerText = `(Poz. ${state.minerSpeedLvl})`;
  upgMinerBtn.disabled = state.sciencePoints < mCost;
}

function selectTool(name) {
  const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
  if (btn && !btn.disabled) {
    state.currentTool = name;
    toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
  }
}

toolButtons.forEach(btn => {
  btn.addEventListener('click', () => selectTool(btn.dataset.tool));
});

upgBeltBtn.addEventListener('click', () => {
  const bCost = Math.round(25 * Math.pow(1.8, state.beltSpeedLvl - 1));
  if (state.sciencePoints >= bCost) {
    state.sciencePoints -= bCost;
    state.beltSpeedLvl++;
    state.beltSpeed += 1.0;
    updateUI();
    saveGame(state);
  }
});

upgMinerBtn.addEventListener('click', () => {
  const mCost = Math.round(30 * Math.pow(1.8, state.minerSpeedLvl - 1));
  if (state.sciencePoints >= mCost) {
    state.sciencePoints -= mCost;
    state.minerSpeedLvl++;
    state.minerInterval = Math.max(2, state.minerInterval - 1);
    updateUI();
    saveGame(state);
  }
});

resetSaveBtn.addEventListener('click', () => {
  if (confirm("Czy na pewno chcesz zresetować cały stan gry?")) {
    clearGameSave();
  }
});

const input = setupInput(canvas, selectTool);

setInterval(() => {
  runSimulationTick(updateUI, updateUI);
}, 100);

setInterval(() => saveGame(state), 5000);
window.addEventListener('beforeunload', () => saveGame(state));

let lastTime = performance.now();
function render(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  for (let i = state.beltItems.length - 1; i >= 0; i--) {
    const item = state.beltItems[i];
    item.progress += dt * state.beltSpeed;

    if (item.progress >= 1.0) {
      const cell = state.grid.get(`${item.curX},${item.curY}`);

      if (cell && cell.type === 'cutter' && !item.isDye && !cell.storedShape) {
        cell.storedShape = item.shape;
        state.beltItems.splice(i, 1);
        continue;
      }
      if (cell && cell.type === 'rotator' && !item.isDye && !cell.storedShape) {
        cell.storedShape = item.shape;
        state.beltItems.splice(i, 1);
        continue;
      }
      if (cell && cell.type === 'merger' && !item.isDye) {
        cell.storedInputs = cell.storedInputs || [];
        if (cell.storedInputs.length < 2) {
          cell.storedInputs.push(item.shape);
          state.beltItems.splice(i, 1);
          continue;
        }
      }
      if (cell && cell.type === 'painter') {
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
      if (cell && cell.type === 'mixer' && item.isDye) {
        cell.storedDyes = cell.storedDyes || [];
        if (cell.storedDyes.length < 2) {
          cell.storedDyes.push(item.dyeColor);
          state.beltItems.splice(i, 1);
          continue;
        }
      }
      if (cell && cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye) {
        if (item.isDye) cell.storedDye = item.dyeColor;
        else cell.storedShape = item.shape;
        state.beltItems.splice(i, 1);
        continue;
      }

      if (cell && cell.type === 'belt') {
        const dir = DIRS[cell.rot];
        const nx = item.curX + dir.x;
        const ny = item.curY + dir.y;
        const nextCell = state.grid.get(`${nx},${ny}`);

        if (nextCell && (nextCell.type === 'belt' || nextCell.type === 'hub' ||
           (nextCell.type === 'cutter' && !item.isDye && !nextCell.storedShape) ||
           (nextCell.type === 'rotator' && !item.isDye && !nextCell.storedShape) ||
           (nextCell.type === 'merger' && !item.isDye && (!nextCell.storedInputs || nextCell.storedInputs.length < 2)) ||
           (nextCell.type === 'painter' && ((item.isDye && !nextCell.storedDye) || (!item.isDye && !nextCell.storedShape))) ||
           (nextCell.type === 'mixer' && item.isDye && (!nextCell.storedDyes || nextCell.storedDyes.length < 2)) ||
           (nextCell.type === 'tunnel_in' && !nextCell.storedShape && !nextCell.storedDye))) {
          item.curX = nx;
          item.curY = ny;
          item.progress = 0;
        } else {
          item.progress = 1.0;
        }
      }
    }
  }

  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(state.camera.x, state.camera.y);
  ctx.scale(state.camera.zoom, state.camera.zoom);

  const startCol = Math.floor((-state.camera.x / state.camera.zoom) / GRID_SIZE) - 1;
  const endCol = startCol + Math.ceil(canvas.width / state.camera.zoom / GRID_SIZE) + 2;
  const startRow = Math.floor((-state.camera.y / state.camera.zoom) / GRID_SIZE) - 1;
  const endRow = startRow + Math.ceil(canvas.height / state.camera.zoom / GRID_SIZE) + 2;

  // Złoża
  for (let x = startCol; x <= endCol; x++) {
    for (let y = startRow; y <= endRow; y++) {
      const patch = state.patches.get(`${x},${y}`);
      if (patch) {
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;
        ctx.fillStyle = '#171c26';
        ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);

        if (patch.kind === 'shape') {
          if (patch.color === 'circle') {
            ctx.fillStyle = 'rgba(127, 140, 141, 0.3)';
            ctx.beginPath();
            ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.32, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(127, 140, 141, 0.3)';
            const sz = GRID_SIZE * 0.55;
            ctx.fillRect(px + (GRID_SIZE - sz) / 2, py + (GRID_SIZE - sz) / 2, sz, sz);
          }
        } else if (patch.kind === 'dye') {
          ctx.fillStyle = COLOR_MAP[patch.color] || '#ff4d4f';
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }

  // Siatka
  ctx.strokeStyle = '#1a202c';
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

  // Tunele
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

  // Budynki
  state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0));

  const preview = input.getDragPreview();
  if (preview) {
    preview.forEach(node => drawBuilding(ctx, node.x, node.y, 'belt', node.rot, 0.4));
  }

  // Przedmioty na taśmach
  state.beltItems.forEach(item => {
    const cell = state.grid.get(`${item.curX},${item.curY}`);
    let px = item.curX * GRID_SIZE + GRID_SIZE / 2;
    let py = item.curY * GRID_SIZE + GRID_SIZE / 2;

    if (cell && cell.type === 'belt') {
      const dir = DIRS[cell.rot];
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