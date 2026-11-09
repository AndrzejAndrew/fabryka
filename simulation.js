window.Factory = window.Factory || {};

function rotateShapeRight(shape) { return [shape[3], shape[0], shape[1], shape[2]]; }
function combineShapes(a, b) { const res = [null, null, null, null]; for (let i = 0; i < 4; i++) { res[i] = a[i] || b[i] || null; } return res; }
function shapesEqual(a, b) { if (!a || !b) return false; for (let i = 0; i < 4; i++) { const qa = a[i]; const qb = b[i]; if (!qa && !qb) continue; if (!qa || !qb) return false; if (qa.type !== qb.type || qa.color !== qb.color) return false; } return true; }

window.Factory.isFullShapeOfType = function(shape, type) { if (!Array.isArray(shape)) return false; return shape.every(q => q && q.type === type); };

window.Factory.runSimulationTick = function(onUIUpdate, onLevelUp) {
  const { state, DIRS, LEVELS, COLOR_MIXES, POWER_RADIUS, makeQuad } = window.Factory;

  const activeGenerators = [];
  state.grid.forEach(b => {
    b.isPowered = false;
    if (b.type === 'generator') { if ((b.fuelTimer || 0) > 0) { b.fuelTimer--; activeGenerators.push(b); } }
  });

  state.grid.forEach(b => {
    for (const gen of activeGenerators) {
      if (Math.hypot(b.x - gen.x, b.y - gen.y) <= POWER_RADIUS) { b.isPowered = true; break; }
    }
  });

  state.grid.forEach(b => {
    if (b.type === 'miner') {
      const patch = state.patches.get(`${b.x},${b.y}`);
      if (!patch) return;
      
      const prestigeMult = 1 + (state.quantumCores || 0) * 0.25;
      
      b.timer = (b.timer || 0) + ((b.isPowered ? 2 : 1) * prestigeMult);
      if (b.timer >= state.minerInterval) {
        b.timer = 0;
        const dir = DIRS[b.rot];
        const tx = b.x + dir.x; const ty = b.y + dir.y;
        const target = state.grid.get(`${tx},${ty}`);
        if (target) {
          const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
          if (!occ) {
            if (patch.kind === 'shape') {
              const q = makeQuad(patch.subType, 'uncolored');
              state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: [{ ...q }, { ...q }, { ...q }, { ...q }], progress: 0 });
            } else if (patch.kind === 'dye') {
              state.beltItems.push({ curX: tx, curY: ty, isDye: true, dyeColor: patch.subType, progress: 0 });
            }
          }
        }
      }
    }

    if (b.type === 'cutter' && b.storedShape) {
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const secX = b.x + right.x; const secY = b.y + right.y;
      const outMainX = b.x + fwd.x; const outMainY = b.y + fwd.y;
      const outSecX = secX + fwd.x; const outSecY = secY + fwd.y;

      const mainTarget = state.grid.get(`${outMainX},${outMainY}`);
      const secTarget = state.grid.get(`${outSecX},${outSecY}`);
      const mainBlocked = state.beltItems.some(i => i.curX === outMainX && i.curY === outMainY);
      const secBlocked = state.beltItems.some(i => i.curX === outSecX && i.curY === outSecY);

      const src = b.storedShape;
      const halfLeft = [null, null, src[2], src[3]];
      const halfRight = [src[0], src[1], null, null];
      const hasLeft = Boolean(halfLeft[2] || halfLeft[3]);
      const hasRight = Boolean(halfRight[0] || halfRight[1]);

      if (mainTarget && secTarget && !mainBlocked && !secBlocked) {
        if (hasLeft) state.beltItems.push({ curX: outMainX, curY: outMainY, isDye: false, shape: halfLeft, progress: 0 });
        if (hasRight) state.beltItems.push({ curX: outSecX, curY: outSecY, isDye: false, shape: halfRight, progress: 0 });
        b.storedShape = null;
      } else if (mainTarget && !secTarget && !mainBlocked) {
        if (hasLeft) state.beltItems.push({ curX: outMainX, curY: outMainY, isDye: false, shape: halfLeft, progress: 0 });
        b.storedShape = null;
      } else if (secTarget && !mainTarget && !secBlocked) {
        if (hasRight) state.beltItems.push({ curX: outSecX, curY: outSecY, isDye: false, shape: halfRight, progress: 0 });
        b.storedShape = null;
      }
    }

    if (b.type === 'rotator' && b.storedShape) {
      const fwd = DIRS[b.rot]; const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: rotateShapeRight(b.storedShape), progress: 0 });
        b.storedShape = null;
      }
    }

    // Monter 2x1 (Łączy storedLeft z głównego kafelka i storedRight z prawego kafelka)
    if (b.type === 'merger' && b.storedLeft && b.storedRight) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const merged = combineShapes(b.storedLeft, b.storedRight);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: merged, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // Lakiernia 2x1 (Lewe wejście to kształt, prawe to barwnik)
    if (b.type === 'painter' && b.storedLeft && b.storedRight) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const painted = b.storedLeft.map(quad => quad ? { type: quad.type, color: b.storedRight } : null);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: painted, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // Mieszalnik 2x1 (Lewe wejście to barwnik, prawe to barwnik)
    if (b.type === 'mixer' && b.storedLeft && b.storedRight) {
      const fwd = DIRS[b.rot]; 
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const newColor = COLOR_MIXES[`${b.storedLeft}+${b.storedRight}`] || b.storedLeft;
        state.beltItems.push({ curX: tx, curY: ty, isDye: true, dyeColor: newColor, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // Syntezator 2x1 (Lewe wejście to Koło, Prawe to Kwadrat)
    if (b.type === 'synthesizer' && b.storedLeft && b.storedRight) {
      const fwd = DIRS[b.rot]; 
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const circleColor = b.storedLeft[0] ? b.storedLeft[0].color : 'uncolored';
        const squareColor = b.storedRight[0] ? b.storedRight[0].color : 'uncolored';
        const starColor = circleColor !== 'uncolored' ? circleColor : (squareColor !== 'uncolored' ? squareColor : 'uncolored');
        
        const q = makeQuad('star', starColor);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: [{ ...q }, { ...q }, { ...q }, { ...q }], progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // Splitter (Rozdzielacz) 2x1 - jedno wejście z tyłu, wyjście główne do przodu i pomocnicze do przodu
    if (b.type === 'splitter' && b.storedItem) {
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const mainOut = { x: b.x + fwd.x, y: b.y + fwd.y };
      const secOut = { x: b.x + right.x + fwd.x, y: b.y + right.y + fwd.y }; // Do przodu z prawego kafelka
      
      b.splitToggle = (b.splitToggle || 0) % 2;
      const targets = [mainOut, secOut];
      const firstIdx = b.splitToggle; const secondIdx = 1 - firstIdx;
      
      for (const idx of [firstIdx, secondIdx]) {
        const tPos = targets[idx]; const tCell = state.grid.get(`${tPos.x},${tPos.y}`);
        const occ = state.beltItems.some(i => i.curX === tPos.x && i.curY === tPos.y);
        if (tCell && !occ) {
          state.beltItems.push({ curX: tPos.x, curY: tPos.y, isDye: b.storedItem.isDye, dyeColor: b.storedItem.dyeColor, shape: b.storedItem.shape, progress: 0 });
          b.storedItem = null; b.splitToggle = 1 - idx; break;
        }
      }
    }

    if (b.type === 'tunnel_in' && (b.storedShape || b.storedDye)) {
      const dir = DIRS[b.rot];
      for (let dist = 1; dist <= 5; dist++) {
        const tx = b.x + dir.x * dist; const ty = b.y + dir.y * dist;
        const target = state.grid.get(`${tx},${ty}`);
        if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
          const outDir = DIRS[target.rot]; const destX = target.x + outDir.x; const destY = target.y + outDir.y;
          const destCell = state.grid.get(`${destX},${destY}`);
          const blocked = state.beltItems.some(i => i.curX === destX && i.curY === destY);
          if (destCell && !blocked) {
            if (b.storedShape) { state.beltItems.push({ curX: destX, curY: destY, isDye: false, shape: b.storedShape, progress: 0 }); b.storedShape = null; } 
            else { state.beltItems.push({ curX: destX, curY: destY, isDye: true, dyeColor: b.storedDye, progress: 0 }); b.storedDye = null; }
          }
          break;
        }
      }
    }
  });

  let changed = false;
  let gainedMatterTick = 0; let gainedScienceTick = 0;
  
  const prestigeMult = 1 + (state.quantumCores || 0) * 0.25;

  for (let i = state.beltItems.length - 1; i >= 0; i--) {
    const item = state.beltItems[i];
    const cell = state.grid.get(`${item.curX},${item.curY}`);

    if (cell && cell.type === 'hub') {
      const hasStar = !item.isDye && Array.isArray(item.shape) && item.shape.some(q => q && q.type === 'star');
      const sPoints = Math.floor((hasStar ? 5 : 1) * prestigeMult); 
      const mPoints = Math.floor((hasStar ? 10 : 2) * prestigeMult);
      
      gainedScienceTick += sPoints; gainedMatterTick += mPoints; changed = true;

      if (!item.isDye) {
        const curLevel = LEVELS[state.currentLvlIndex];
        if (curLevel && shapesEqual(item.shape, curLevel.targetShape)) {
          state.currentLvlProgress++;
          if (state.currentLvlProgress >= curLevel.requiredCount) {
            const finishedLevel = curLevel;
            if (state.currentLvlIndex < LEVELS.length - 1) {
              state.currentLvlIndex++; state.currentLvlProgress = 0;
              if (onLevelUp) onLevelUp(finishedLevel, LEVELS[state.currentLvlIndex]);
            }
          }
        }
      }
      state.beltItems.splice(i, 1);
    }
  }
  if (changed && onUIUpdate) { onUIUpdate(gainedMatterTick, gainedScienceTick); }
};