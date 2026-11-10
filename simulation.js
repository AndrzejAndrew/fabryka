window.Factory = window.Factory || {};

function rotateShapeRight(shape) {
  return [shape[3], shape[0], shape[1], shape[2]];
}

function rotateShape180(shape) {
  return [shape[2], shape[3], shape[0], shape[1]];
}

function combineShapes(a, b) {
  if (!a) return b;
  if (!b) return a;

  const isFullA = a[0] && a[1] && a[2] && a[3];
  const isFullB = b[0] && b[1] && b[2] && b[3];

  if (isFullA && isFullB) {
    return [b[0], b[1], a[2], a[3]];
  }

  let hasOverlap = false;
  for (let i = 0; i < 4; i++) {
    if (a[i] && b[i]) { hasOverlap = true; break; }
  }

  if (!hasOverlap) {
    return [a[0] || b[0] || null, a[1] || b[1] || null, a[2] || b[2] || null, a[3] || b[3] || null];
  }

  const b180 = rotateShape180(b);
  let overlap180 = false;
  for (let i = 0; i < 4; i++) {
    if (a[i] && b180[i]) overlap180 = true;
  }
  if (!overlap180) {
    return [a[0] || b180[0] || null, a[1] || b180[1] || null, a[2] || b180[2] || null, a[3] || b180[3] || null];
  }

  const b90 = rotateShapeRight(b);
  return [
    a[0] || b90[0] || b[0] || null,
    a[1] || b90[1] || b[1] || null,
    a[2] || b90[2] || b[2] || null,
    a[3] || b90[3] || b[3] || null
  ];
}

function exactShapesEqual(a, b) {
  if (!a || !b) return false;
  for (let i = 0; i < 4; i++) {
    const qa = a[i]; const qb = b[i];
    if (!qa && !qb) continue;
    if (!qa || !qb) return false;
    if (qa.type !== qb.type || qa.color !== qb.color) return false;
  }
  return true;
}

function shapesEqual(a, b) {
  if (exactShapesEqual(a, b)) return true;
  const isFullTarget = b && b[0] && b[1] && b[2] && b[3];
  if (isFullTarget && exactShapesEqual(rotateShape180(a), b)) return true;
  return false;
}

window.Factory.isFullShapeOfType = function(shape, type) {
  if (!Array.isArray(shape)) return false;
  return shape.every(q => q && q.type === type);
};

window.Factory.runSimulationTick = function(onUIUpdate, onLevelUp) {
  const { state, DIRS, LEVELS, COLOR_MIXES, POWER_RADIUS, makeQuad } = window.Factory;

  // --- KROK 1: SIEĆ ENERGETYCZNA ---
  const activeGenerators = [];
  state.grid.forEach(b => {
    b.isPowered = false;
    if (b.type === 'generator' || b.type === 'incinerator') {
      if ((b.fuelTimer || 0) > 0) {
        b.fuelTimer--;
        activeGenerators.push(b);
      }
    }
  });

  state.grid.forEach(b => {
    for (const gen of activeGenerators) {
      if (Math.hypot(b.x - gen.x, b.y - gen.y) <= POWER_RADIUS) {
        b.isPowered = true;
        break;
      }
    }
  });

  // Przekazywanie prądu pomiędzy segmentami maszyn 2x1 oraz Stoczni 3x3
  state.grid.forEach(b => {
    if (Array.isArray(b.partnerKeys)) {
      const anyPowered = b.isPowered || b.partnerKeys.some(pk => {
        const p = state.grid.get(pk);
        return p && p.isPowered;
      });
      if (anyPowered) {
        b.isPowered = true;
        b.partnerKeys.forEach(pk => {
          const p = state.grid.get(pk);
          if (p) p.isPowered = true;
        });
      }
    } else if (b.partnerKey) {
      const partner = state.grid.get(b.partnerKey);
      if (partner && partner.isPowered) b.isPowered = true;
    }
  });

  const powerRequiredForHeavy = state.currentLvlIndex >= 5;
  let changed = false;

  // --- KROK 2: LOGIKA MASZYN ---
  state.grid.forEach(b => {
    // 1. Ekstraktor
    if (b.type === 'miner') {
      const patch = state.patches.get(`${b.x},${b.y}`);
      if (!patch) return;

      const prestigeMult = 1 + (state.quantumCores || 0) * 0.25;
      b.timer = (b.timer || 0) + ((b.isPowered ? 2.5 : 1) * prestigeMult);

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
              state.beltItems.push({ curX: tx, curY: ty, isDye: false, isWaste: false, shape: [{ ...q }, { ...q }, { ...q }, { ...q }], progress: 0 });
            } else if (patch.kind === 'dye') {
              state.beltItems.push({ curX: tx, curY: ty, isDye: true, isWaste: false, dyeColor: patch.subType, progress: 0 });
            }
          }
        }
      }
    }

    // 2. WYSYPISKO (Landfill)
    if (b.type === 'landfill' && (b.storedWaste || 0) > 0) {
      const fwd = DIRS[b.rot || 0];
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      if (target && (target.type === 'belt' || target.type === 'incinerator')) {
        const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
        if (!occ) {
          b.storedWaste--;
          state.beltItems.push({ curX: tx, curY: ty, isDye: false, isWaste: true, shape: null, progress: 0 });
        }
      }
    }

    // 3. Przecinarka 2x1
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
        if (hasLeft) state.beltItems.push({ curX: outMainX, curY: outMainY, isDye: false, isWaste: false, shape: halfLeft, progress: 0 });
        if (hasRight) state.beltItems.push({ curX: outSecX, curY: outSecY, isDye: false, isWaste: false, shape: halfRight, progress: 0 });
        b.storedShape = null;
      } else if (mainTarget && !secTarget && !mainBlocked) {
        if (hasLeft) state.beltItems.push({ curX: outMainX, curY: outMainY, isDye: false, isWaste: false, shape: halfLeft, progress: 0 });
        b.storedShape = null;
      } else if (secTarget && !mainTarget && !secBlocked) {
        if (hasRight) state.beltItems.push({ curX: outSecX, curY: outSecY, isDye: false, isWaste: false, shape: halfRight, progress: 0 });
        b.storedShape = null;
      }
    }

    // 4. Rotator
    if (b.type === 'rotator' && b.storedShape) {
      const fwd = DIRS[b.rot]; const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, isWaste: false, shape: rotateShapeRight(b.storedShape), progress: 0 });
        b.storedShape = null;
      }
    }

    // 5. Monter 2x1
    if (b.type === 'merger' && b.storedLeft && b.storedRight) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const merged = combineShapes(b.storedLeft, b.storedRight);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, isWaste: false, shape: merged, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // 6. Lakiernia 2x1
    if (b.type === 'painter' && b.storedLeft && b.storedRight) {
      if (!b.isPowered) return;
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const outMain = { x: b.x + fwd.x, y: b.y + fwd.y };
      const outSec = { x: b.x + right.x + fwd.x, y: b.y + right.y + fwd.y };

      const targetMain = state.grid.get(`${outMain.x},${outMain.y}`);
      const targetSec = state.grid.get(`${outSec.x},${outSec.y}`);
      const occMain = state.beltItems.some(i => i.curX === outMain.x && i.curY === outMain.y);
      const occSec = state.beltItems.some(i => i.curX === outSec.x && i.curY === outSec.y);

      if (targetMain && targetSec && !occMain && !occSec) {
        const painted = b.storedLeft.map(quad => quad ? { type: quad.type, color: b.storedRight } : null);
        state.beltItems.push({ curX: outMain.x, curY: outMain.y, isDye: false, isWaste: false, shape: painted, progress: 0 });
        state.beltItems.push({ curX: outSec.x, curY: outSec.y, isDye: false, isWaste: true, shape: null, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // 7. Mieszalnik 2x1
    if (b.type === 'mixer' && b.storedLeft && b.storedRight) {
      if (!b.isPowered) return;
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x; const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
      if (target && !occ) {
        const newColor = COLOR_MIXES[`${b.storedLeft}+${b.storedRight}`] || b.storedLeft;
        state.beltItems.push({ curX: tx, curY: ty, isDye: true, isWaste: false, dyeColor: newColor, progress: 0 });
        b.storedLeft = null; b.storedRight = null;
      }
    }

    // 8. Syntezator 2x1
    if (b.type === 'synthesizer' && b.storedLeft && b.storedRight) {
      if (powerRequiredForHeavy && !b.isPowered) return;
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const outMain = { x: b.x + fwd.x, y: b.y + fwd.y };
      const outSec = { x: b.x + right.x + fwd.x, y: b.y + right.y + fwd.y };

      const targetMain = state.grid.get(`${outMain.x},${outMain.y}`);
      const targetSec = state.grid.get(`${outSec.x},${outSec.y}`);
      const occMain = state.beltItems.some(i => i.curX === outMain.x && i.curY === outMain.y);
      const occSec = state.beltItems.some(i => i.curX === outSec.x && i.curY === outSec.y);

      if (targetMain && targetSec && !occMain && !occSec) {
        const circleColor = b.storedLeft[0] ? b.storedLeft[0].color : 'uncolored';
        const squareColor = b.storedRight[0] ? b.storedRight[0].color : 'uncolored';
        const starColor = circleColor !== 'uncolored' ? circleColor : (squareColor !== 'uncolored' ? squareColor : 'uncolored');

        const q = makeQuad('star', starColor);
        state.beltItems.push({ curX: outMain.x, curY: outMain.y, isDye: false, isWaste: false, shape: [{ ...q }, { ...q }, { ...q }, { ...q }], progress: 0 });
        state.beltItems.push({ curX: outSec.x, curY: outSec.y, isDye: false, isWaste: true, shape: null, progress: 0 });

        b.storedLeft = null; b.storedRight = null;
      }
    }

    // 9. NOWOŚĆ: KUŹNIA PREFABRYKATÓW 2x1 (Foundry)
    // Lewy wlot: Gwiazda ⭐ | Prawy wlot: dowolny Kształt -> Produkuje +1 🔩 Prefabrykat do zasobów i wyrzuca Żużel prawym torem!
    if (b.type === 'foundry' && b.storedLeft && b.storedRight) {
      if (!b.isPowered) return; // Kuźnia wymaga zasilania prądem!
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const outSec = { x: b.x + right.x + fwd.x, y: b.y + right.y + fwd.y };
      const targetSec = state.grid.get(`${outSec.x},${outSec.y}`);
      const occSec = state.beltItems.some(i => i.curX === outSec.x && i.curY === outSec.y);

      // Wymaga drożnego odbioru Żużla z prawego wylotu!
      if (targetSec && !occSec) {
        const prestigeMult = 1 + (state.quantumCores || 0) * 0.25;
        state.alloyPlates = (state.alloyPlates || 0) + Math.max(1, Math.round(1 * prestigeMult));
        state.beltItems.push({ curX: outSec.x, curY: outSec.y, isDye: false, isWaste: true, shape: null, progress: 0 });
        b.storedLeft = null;
        b.storedRight = null;
        changed = true;
      }
    }

    // 10. Rozdzielacz 2x1
    if (b.type === 'splitter' && b.storedItem) {
      const fwd = DIRS[b.rot]; const right = DIRS[(b.rot + 1) % 4];
      const mainOut = { x: b.x + fwd.x, y: b.y + fwd.y };
      const secOut = { x: b.x + right.x + fwd.x, y: b.y + right.y + fwd.y };

      b.splitToggle = (b.splitToggle || 0) % 2;
      const targets = [mainOut, secOut];
      const firstIdx = b.splitToggle; const secondIdx = 1 - firstIdx;

      for (const idx of [firstIdx, secondIdx]) {
        const tPos = targets[idx]; const tCell = state.grid.get(`${tPos.x},${tPos.y}`);
        const occ = state.beltItems.some(i => i.curX === tPos.x && i.curY === tPos.y);
        if (tCell && !occ) {
          state.beltItems.push({ curX: tPos.x, curY: tPos.y, isDye: b.storedItem.isDye, isWaste: b.storedItem.isWaste, dyeColor: b.storedItem.dyeColor, shape: b.storedItem.shape, progress: 0 });
          b.storedItem = null; b.splitToggle = 1 - idx; break;
        }
      }
    }

    // 11. Tunele
    if (b.type === 'tunnel_in' && (b.storedShape || b.storedDye || b.hasWasteStored)) {
      const dir = DIRS[b.rot];
      for (let dist = 1; dist <= 5; dist++) {
        const tx = b.x + dir.x * dist; const ty = b.y + dir.y * dist;
        const target = state.grid.get(`${tx},${ty}`);
        if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
          const outDir = DIRS[target.rot]; const destX = target.x + outDir.x; const destY = target.y + outDir.y;
          const destCell = state.grid.get(`${destX},${destY}`);
          const blocked = state.beltItems.some(i => i.curX === destX && i.curY === destY);
          if (destCell && !blocked) {
            if (b.hasWasteStored) {
              state.beltItems.push({ curX: destX, curY: destY, isDye: false, isWaste: true, shape: null, progress: 0 }); b.hasWasteStored = false;
            } else if (b.storedShape) {
              state.beltItems.push({ curX: destX, curY: destY, isDye: false, isWaste: false, shape: b.storedShape, progress: 0 }); b.storedShape = null;
            } else {
              state.beltItems.push({ curX: destX, curY: destY, isDye: true, isWaste: false, dyeColor: b.storedDye, progress: 0 }); b.storedDye = null;
            }
          }
          break;
        }
      }
    }
  });

  // --- KROK 3: HUB ORAZ STOCZNIA ARKI 3x3 ---
  let gainedMatterTick = 0; let gainedScienceTick = 0;
  const prestigeMult = 1 + (state.quantumCores || 0) * 0.25;

  for (let i = state.beltItems.length - 1; i >= 0; i--) {
    const item = state.beltItems[i];
    const cell = state.grid.get(`${item.curX},${item.curY}`);
    if (!cell) continue;

    // A) STOCZNIA ARKI 3x3 (Przyjmuje docelowe Rdzenie Gwiezdne na Poziomie 8!)
    if (cell.type === 'ark_shipyard' || cell.type === 'ark_shipyard_sec') {
      const mainArk = cell.type === 'ark_shipyard' ? cell : state.grid.get(cell.partnerKey);
      if (!mainArk || !mainArk.isPowered || item.isWaste || item.isDye) continue;

      const curLevel = LEVELS[state.currentLvlIndex];
      if (curLevel && shapesEqual(item.shape, curLevel.targetShape)) {
        state.currentLvlProgress++;
        gainedScienceTick += Math.floor(15 * prestigeMult);
        changed = true;
      }
      state.beltItems.splice(i, 1);
      continue;
    }

    // B) GŁÓWNY HUB (Poziomy 1-7 zaliczane w Hubie; na Poziomie 8 Hub daje tylko Materię/Naukę, a budowa Arki idzie w Stoczni 3x3!)
    if (cell.type === 'hub') {
      if (item.isWaste) continue;

      const hasStar = !item.isDye && Array.isArray(item.shape) && item.shape.some(q => q && q.type === 'star');
      const sPoints = Math.floor((hasStar ? 5 : 1) * prestigeMult);
      const mPoints = Math.floor((hasStar ? 10 : 2) * prestigeMult);

      gainedScienceTick += sPoints; gainedMatterTick += mPoints; changed = true;

      if (!item.isDye && state.currentLvlIndex < LEVELS.length - 1) {
        const curLevel = LEVELS[state.currentLvlIndex];
        if (curLevel && shapesEqual(item.shape, curLevel.targetShape)) {
          state.currentLvlProgress++;
          if (state.currentLvlProgress >= curLevel.requiredCount) {
            const finishedLevel = curLevel;
            state.currentLvlIndex++; state.currentLvlProgress = 0;
            if (onLevelUp) onLevelUp(finishedLevel, LEVELS[state.currentLvlIndex]);
          }
        }
      }
      state.beltItems.splice(i, 1);
    }
  }
  if (changed && onUIUpdate) { onUIUpdate(gainedMatterTick, gainedScienceTick); }
};