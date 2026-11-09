window.Factory = window.Factory || {};

const SAVE_KEY = 'schematic_factory_save_v4';
const LEGACY_SAVE_KEY = 'schematic_factory_save_v3';
const DUAL_MACHINES = ['cutter', 'merger', 'painter', 'mixer', 'synthesizer', 'splitter'];

window.Factory.saveGame = function() {
  const { state } = window.Factory;
  try {
    const serializedGrid = Array.from(state.grid.entries())
      .filter(([, b]) => b.type !== 'hub' && !b.type.endsWith('_sec'))
      .map(([key, b]) => ({
        key,
        type: b.type,
        x: b.x,
        y: b.y,
        rot: b.rot || 0,
        fuelTimer: b.fuelTimer || 0,
        storedWaste: b.storedWaste || 0
      }));
    const serializedPatches = Array.from(state.patches.entries()).map(([key, p]) => ({ key, kind: p.kind, subType: p.subType }));
    const serializedRocks = Array.from(state.rocks.values());
    state.lastSaveTime = Date.now();

    const data = {
      version: 4, mapSeed: state.mapSeed, lastSaveTime: state.lastSaveTime,
      sciencePoints: state.sciencePoints, matter: state.matter,
      beltSpeedLvl: state.beltSpeedLvl, minerSpeedLvl: state.minerSpeedLvl,
      hubSize: state.hubSize || 2, rockDrillUnlocked: !!state.rockDrillUnlocked,
      currentLvlIndex: state.currentLvlIndex, currentLvlProgress: state.currentLvlProgress,
      prestigeCount: state.prestigeCount || 0, quantumCores: state.quantumCores || 0,
      matterPerMinute: state.matterPerMinute || 0, sciencePerMinute: state.sciencePerMinute || 0,
      patches: serializedPatches, rocks: serializedRocks, grid: serializedGrid
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) { console.warn("Błąd zapisu gry:", err); }
};

window.Factory.loadGame = function() {
  const { state, LEVELS, DIRS, initInitialWorld, rebuildHub } = window.Factory;
  try {
    let raw = localStorage.getItem(SAVE_KEY); let isLegacy = false;
    if (!raw) { raw = localStorage.getItem(LEGACY_SAVE_KEY); isLegacy = true; }
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || (data.version !== 4 && data.version !== 3)) return false;

    state.sciencePoints = Number(data.sciencePoints) || 0;
    state.matter = Number(data.matter) || 200;
    state.beltSpeedLvl = Number(data.beltSpeedLvl) || 1;
    state.minerSpeedLvl = Number(data.minerSpeedLvl) || 1;
    state.hubSize = Number(data.hubSize) || 2;
    state.rockDrillUnlocked = Boolean(data.rockDrillUnlocked);
    state.currentLvlIndex = Math.min(Number(data.currentLvlIndex) || 0, LEVELS.length - 1);
    state.currentLvlProgress = Number(data.currentLvlProgress) || 0;
    state.beltSpeed = 2.5 + (state.beltSpeedLvl - 1) * 1.0;
    state.minerInterval = Math.max(2, 5 - (state.minerSpeedLvl - 1));
    state.mapSeed = Number(data.mapSeed) || 123456;
    state.lastSaveTime = Number(data.lastSaveTime) || Date.now();
    state.prestigeCount = Number(data.prestigeCount) || 0;
    state.quantumCores = Number(data.quantumCores) || 0;
    state.matterPerMinute = Number(data.matterPerMinute) || 0;
    state.sciencePerMinute = Number(data.sciencePerMinute) || 0;

    if (isLegacy || !Array.isArray(data.patches) || data.patches.length === 0) {
      initInitialWorld(state.mapSeed);
    } else {
      state.patches.clear(); data.patches.forEach(p => state.patches.set(p.key, { kind: p.kind, subType: p.subType }));
      state.rocks.clear(); if (Array.isArray(data.rocks)) data.rocks.forEach(rKey => state.rocks.add(rKey));
    }

    state.grid.clear(); state.beltItems = [];
    if (Array.isArray(data.grid)) {
      data.grid.forEach(b => {
        if (b.type === 'hub' || b.type.endsWith('_sec')) return;
        state.rocks.delete(b.key);

        if (DUAL_MACHINES.includes(b.type)) {
          const rot = b.rot || 0; const right = DIRS[(rot + 1) % 4];
          const secX = b.x + right.x; const secY = b.y + right.y;
          const secKey = `${secX},${secY}`;
          state.rocks.delete(secKey);

          state.grid.set(b.key, {
            type: b.type, x: b.x, y: b.y, rot, partnerKey: secKey,
            timer: 0, storedShape: null, storedLeft: null, storedRight: null, storedItem: null
          });
          state.grid.set(secKey, {
            type: b.type + '_sec', x: secX, y: secY, rot, partnerKey: b.key, mainX: b.x, mainY: b.y
          });
        } else {
          state.grid.set(b.key, {
            type: b.type, x: b.x, y: b.y, rot: b.rot || 0,
            timer: 0, fuelTimer: Number(b.fuelTimer) || 0,
            storedWaste: Number(b.storedWaste) || 0,
            storedShape: null, storedDye: null, hasWasteStored: false
          });
        }
      });
    }
    rebuildHub();
    return true;
  } catch (err) { console.warn("Błąd wczytywania zapisu, start od nowa:", err); return false; }
};

window.Factory.clearGameSave = function() { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); window.location.reload(); };