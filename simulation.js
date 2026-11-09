window.Factory = window.Factory || {};

function rotateShapeRight(shape) {
  return [shape[3], shape[0], shape[1], shape[2]];
}

function combineShapes(a, b) {
  const res = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    res[i] = a[i] || b[i] || null;
  }
  return res;
}

function shapesEqual(a, b) {
  if (!a || !b) return false;
  for (let i = 0; i < 4; i++) {
    const qa = a[i];
    const qb = b[i];
    if (!qa && !qb) continue;
    if (!qa || !qb) return false;
    if (qa.type !== qb.type || qa.color !== qb.color) return false;
  }
  return true;
}

window.Factory.isFullShapeOfType = function(shape, type) {
  if (!Array.isArray(shape)) return false;
  return shape.every(q => q && q.type === type);
};

window.Factory.runSimulationTick = function(onUIUpdate, onLevelUp) {
  const { state, DIRS, LEVELS, COLOR_MIXES, POWER_RADIUS, makeQuad } = window.Factory;

  // KROK 0: Aktualizacja Generatorów Prądu i sieci zasilania
  const activeGenerators = [];
  state.grid.forEach(b => {
    b.isPowered = false;
    if (b.type === 'generator') {
      if ((b.fuelTimer || 0) > 0) {
        b.fuelTimer--;
        activeGenerators.push(b);
      }
    }
  });

  state.grid.forEach(b => {
    for (const gen of activeGenerators) {
      const dist = Math.hypot(b.x - gen.x, b.y - gen.y);
      if (dist <= POWER_RADIUS) {
        b.isPowered = true;
        break;
      }
    }
  });

  state.grid.forEach(b => {
    // 1. Ekstraktor (Miner) - działa 2x szybciej pod prądem
    if (b.type === 'miner') {
      const patch = state.patches.get(`${b.x},${b.y}`);
      if (!patch) return;

      b.timer = (b.timer || 0) + (b.isPowered ? 2 : 1);
      if (b.timer >= state.minerInterval) {
        b.timer = 0;
        const dir = DIRS[b.rot];
        const tx = b.x + dir.x;
        const ty = b.y + dir.y;
        const target = state.grid.get(`${tx},${ty}`);

        if (target) {
          const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);
          if (!occ) {
            if (patch.kind === 'shape') {
              const q = makeQuad(patch.subType, 'uncolored');
              state.beltItems.push({
                curX: tx,
                curY: ty,
                isDye: false,
                shape: [{ ...q }, { ...q }, { ...q }, { ...q }],
                progress: 0
              });
            } else if (patch.kind === 'dye') {
              state.beltItems.push({
                curX: tx,
                curY: ty,
                isDye: true,
                dyeColor: patch.subType,
                progress: 0
              });
            }
          }
        }
      }
    }

    // 2. Przecinarka 2x1 (Cutter) - zajmuje 2 pola i wypluwa połówki równolegle na 2 taśmociągi z przodu
    if (b.type === 'cutter' && b.storedShape) {
      const fwd = DIRS[b.rot];
      const right = DIRS[(b.rot + 1) % 4];

      // Drugie pole przecinarki (po prawej stronie względem obrotu)
      const secX = b.x + right.x;
      const secY = b.y + right.y;

      // Wyjście 1 (z pola głównego na wprost -> Lewa połówka)
      const outMainX = b.x + fwd.x;
      const outMainY = b.y + fwd.y;

      // Wyjście 2 (z drugiego pola przecinarki na wprost -> Prawa połówka)
      const outSecX = secX + fwd.x;
      const outSecY = secY + fwd.y;

      const mainTarget = state.grid.get(`${outMainX},${outMainY}`);
      const secTarget = state.grid.get(`${outSecX},${outSecY}`);

      const mainBlocked = state.beltItems.some(i => i.curX === outMainX && i.curY === outMainY);
      const secBlocked = state.beltItems.some(i => i.curX === outSecX && i.curY === outSecY);

      const src = b.storedShape;
      const halfLeft = [null, null, src[2], src[3]];
      const halfRight = [src[0], src[1], null, null];

      const hasLeft = Boolean(halfLeft[2] || halfLeft[3]);
      const hasRight = Boolean(halfRight[0] || halfRight[1]);

      // Jeśli oba taśmociągi wyjściowe są podłączone, czekamy aż oba będą wolne
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

    // 3. Rotator
    if (b.type === 'rotator' && b.storedShape) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x;
      const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);

      if (target && !occ) {
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: rotateShapeRight(b.storedShape), progress: 0 });
        b.storedShape = null;
      }
    }

    // 4. Monter (Merger)
    if (b.type === 'merger' && b.storedInputs && b.storedInputs.length >= 2) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x;
      const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);

      if (target && !occ) {
        const merged = combineShapes(b.storedInputs[0], b.storedInputs[1]);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: merged, progress: 0 });
        b.storedInputs = [];
      }
    }

    // 5. Lakiernia (Painter)
    if (b.type === 'painter' && b.storedShape && b.storedDye) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x;
      const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);

      if (target && !occ) {
        const painted = b.storedShape.map(quad => quad ? { type: quad.type, color: b.storedDye } : null);
        state.beltItems.push({ curX: tx, curY: ty, isDye: false, shape: painted, progress: 0 });
        b.storedShape = null;
        b.storedDye = null;
      }
    }

    // 6. Mieszalnik Barw (Mixer)
    if (b.type === 'mixer' && b.storedDyes && b.storedDyes.length >= 2) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x;
      const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);

      if (target && !occ) {
        const d1 = b.storedDyes[0];
        const d2 = b.storedDyes[1];
        const newColor = COLOR_MIXES[`${d1}+${d2}`] || d1;

        state.beltItems.push({ curX: tx, curY: ty, isDye: true, dyeColor: newColor, progress: 0 });
        b.storedDyes = [];
      }
    }

    // 7. Syntezator (Koło + Kwadrat = Gwiazda)
    if (b.type === 'synthesizer' && b.hasCircle && b.hasSquare) {
      const fwd = DIRS[b.rot];
      const tx = b.x + fwd.x;
      const ty = b.y + fwd.y;
      const target = state.grid.get(`${tx},${ty}`);
      const occ = state.beltItems.some(i => i.curX === tx && i.curY === ty);

      if (target && !occ) {
        const starColor = b.circleColor !== 'uncolored' ? b.circleColor : (b.squareColor || 'uncolored');
        const q = makeQuad('star', starColor);
        state.beltItems.push({
          curX: tx,
          curY: ty,
          isDye: false,
          shape: [{ ...q }, { ...q }, { ...q }, { ...q }],
          progress: 0
        });
        b.hasCircle = false;
        b.hasSquare = false;
      }
    }

    // 8. Rozdzielacz (Splitter): naprzemiennie prosto i w prawo
    if (b.type === 'splitter' && b.storedItem) {
      const fwd = DIRS[b.rot];
      const right = DIRS[(b.rot + 1) % 4];

      const targets = [
        { x: b.x + fwd.x, y: b.y + fwd.y },
        { x: b.x + right.x, y: b.y + right.y }
      ];

      b.splitToggle = (b.splitToggle || 0) % 2;
      const firstIdx = b.splitToggle;
      const secondIdx = 1 - firstIdx;

      for (const idx of [firstIdx, secondIdx]) {
        const tPos = targets[idx];
        const tCell = state.grid.get(`${tPos.x},${tPos.y}`);
        const occ = state.beltItems.some(i => i.curX === tPos.x && i.curY === tPos.y);
        if (tCell && !occ) {
          state.beltItems.push({
            curX: tPos.x,
            curY: tPos.y,
            isDye: b.storedItem.isDye,
            dyeColor: b.storedItem.dyeColor,
            shape: b.storedItem.shape,
            progress: 0
          });
          b.storedItem = null;
          b.splitToggle = 1 - idx;
          break;
        }
      }
    }

    // 9. Tunele
    if (b.type === 'tunnel_in' && (b.storedShape || b.storedDye)) {
      const dir = DIRS[b.rot];
      for (let dist = 1; dist <= 5; dist++) {
        const tx = b.x + dir.x * dist;
        const ty = b.y + dir.y * dist;
        const target = state.grid.get(`${tx},${ty}`);
        if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
          const outDir = DIRS[target.rot];
          const destX = target.x + outDir.x;
          const destY = target.y + outDir.y;
          const destCell = state.grid.get(`${destX},${destY}`);
          const blocked = state.beltItems.some(i => i.curX === destX && i.curY === destY);

          if (destCell && !blocked) {
            if (b.storedShape) {
              state.beltItems.push({ curX: destX, curY: destY, isDye: false, shape: b.storedShape, progress: 0 });
              b.storedShape = null;
            } else {
              state.beltItems.push({ curX: destX, curY: destY, isDye: true, dyeColor: b.storedDye, progress: 0 });
              b.storedDye = null;
            }
          }
          break;
        }
      }
    }
  });

// Rdzeń Bazy (Hub): Gwiazdy dają 5 ⚙ i 10 🧱, zwykłe elementy 1 ⚙ i 2 🧱
  let changed = false;
  let gainedMatterTick = 0;
  let gainedScienceTick = 0;
  
  for (let i = state.beltItems.length - 1; i >= 0; i--) {
    const item = state.beltItems[i];
    const cell = state.grid.get(`${item.curX},${item.curY}`);

    if (cell && cell.type === 'hub') {
      const hasStar = !item.isDye && Array.isArray(item.shape) && item.shape.some(q => q && q.type === 'star');
      const sPoints = hasStar ? 5 : 1;
      const mPoints = hasStar ? 10 : 2; // Każdy dowieziony surowiec to Materia zdatna do budowy!
      
      gainedScienceTick += sPoints;
      gainedMatterTick += mPoints;
      changed = true;

      if (!item.isDye) {
        const curLevel = LEVELS[state.currentLvlIndex];
        if (curLevel && shapesEqual(item.shape, curLevel.targetShape)) {
          state.currentLvlProgress++;
          if (state.currentLvlProgress >= curLevel.requiredCount) {
            const finishedLevel = curLevel;
            if (state.currentLvlIndex < LEVELS.length - 1) {
              state.currentLvlIndex++;
              state.currentLvlProgress = 0;
              if (onLevelUp) onLevelUp(finishedLevel, LEVELS[state.currentLvlIndex]);
            }
          }
        }
      }
      state.beltItems.splice(i, 1);
    }
  }

  if (changed && onUIUpdate) {
    onUIUpdate(gainedMatterTick, gainedScienceTick); // Zwracamy uzysk, żeby main.js mógł podbić wynik
  }
};