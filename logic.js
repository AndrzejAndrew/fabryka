import { DIRS, LEVELS, COLOR_MIXES, makeQuad } from './config.js';
import { state } from './state.js';

function rotateShapeRight(shape) {
  return [shape[3], shape[0], shape[1], shape[2]];
}

function combineShapes(a, b) {
  const res = [null, null, null, null];
  for (let i = 0; i < 4; i++) res[i] = a[i] || b[i] || null;
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

export function runSimulationTick(onLevelChange, onScienceChange) {
  state.grid.forEach(b => {
    // 1. Kopalnie: kształty lub barwniki
    if (b.type === 'miner') {
      const patch = state.patches.get(`${b.x},${b.y}`);
      if (!patch) return;

      b.timer = (b.timer || 0) + 1;
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
              state.beltItems.push({
                curX: tx,
                curY: ty,
                isDye: false,
                shape: [makeQuad(patch.color), makeQuad(patch.color), makeQuad(patch.color), makeQuad(patch.color)],
                progress: 0
              });
            } else if (patch.kind === 'dye') {
              state.beltItems.push({
                curX: tx,
                curY: ty,
                isDye: true,
                dyeColor: patch.color,
                progress: 0
              });
            }
          }
        }
      }
    }

    // 2. Krajalnica (Cutter)
    if (b.type === 'cutter' && b.storedShape) {
      const fwd = DIRS[b.rot];
      const left = DIRS[(b.rot + 3) % 4];
      const outLeftX = b.x + fwd.x + left.x;
      const outLeftY = b.y + fwd.y + left.y;
      const outRightX = b.x + fwd.x;
      const outRightY = b.y + fwd.y;

      const leftCell = state.grid.get(`${outLeftX},${outLeftY}`);
      const rightCell = state.grid.get(`${outRightX},${outRightY}`);
      const leftBlocked = state.beltItems.some(i => i.curX === outLeftX && i.curY === outLeftY);
      const rightBlocked = state.beltItems.some(i => i.curX === outRightX && i.curY === outRightY);

      if (leftCell && rightCell && !leftBlocked && !rightBlocked) {
        const src = b.storedShape;
        state.beltItems.push({ curX: outLeftX, curY: outLeftY, isDye: false, shape: [null, null, src[2], src[3]], progress: 0 });
        state.beltItems.push({ curX: outRightX, curY: outRightY, isDye: false, shape: [src[0], src[1], null, null], progress: 0 });
        b.storedShape = null;
      }
    }

    // 3. Obracarka (Rotator)
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

    // 4. Łączarka (Merger)
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

    // 5. Malarz (Painter)
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
        const comboKey = `${d1}+${d2}`;
        const newColor = COLOR_MIXES[comboKey] || d1;

        state.beltItems.push({ curX: tx, curY: ty, isDye: true, dyeColor: newColor, progress: 0 });
        b.storedDyes = [];
      }
    }

    // 7. Tunele
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

  // Hub: dostawy
  for (let i = state.beltItems.length - 1; i >= 0; i--) {
    const item = state.beltItems[i];
    const cell = state.grid.get(`${item.curX},${item.curY}`);

    if (cell && cell.type === 'hub') {
      state.sciencePoints += 1;
      onScienceChange();

      if (!item.isDye) {
        const curLevel = LEVELS[state.currentLvlIndex];
        if (curLevel && shapesEqual(item.shape, curLevel.targetShape)) {
          state.currentLvlProgress++;
          if (state.currentLvlProgress >= curLevel.requiredCount) {
            state.currentLvlIndex++;
            state.currentLvlProgress = 0;
            onLevelChange();
          }
        }
      }
      state.beltItems.splice(i, 1);
    }
  }
}