window.Factory = window.Factory || {};

const SAVE_KEY = 'schematic_factory_save_v4';
const LEGACY_SAVE_KEY = 'schematic_factory_save_v3';

window.Factory.saveGame = function() {
  const { state } = window.Factory;
  try {
    // Zapisujemy budynki poza samym Hubem (Hub jest odtwarzany przez rebuildHub na podstawie hubSize)
    const serializedGrid = Array.from(state.grid.entries())
      .filter(([, b]) => b.type !== 'hub')
      .map(([key, b]) => ({
        key,
        type: b.type,
        x: b.x,
        y: b.y,
        rot: b.rot || 0,
        fuelTimer: b.fuelTimer || 0
      }));

    // Zapisujemy wygenerowane złoża
    const serializedPatches = Array.from(state.patches.entries()).map(([key, p]) => ({
      key,
      kind: p.kind,
      subType: p.subType
    }));

    // Zapisujemy skały (jako tablicę kluczy "x,y")
    const serializedRocks = Array.from(state.rocks.values());

    state.lastSaveTime = Date.now();

    const data = {
      version: 4,
      mapSeed: state.mapSeed,
      lastSaveTime: state.lastSaveTime,
      sciencePoints: state.sciencePoints,
      beltSpeedLvl: state.beltSpeedLvl,
      minerSpeedLvl: state.minerSpeedLvl,
      hubSize: state.hubSize || 2,
      rockDrillUnlocked: !!state.rockDrillUnlocked,
      currentLvlIndex: state.currentLvlIndex,
      currentLvlProgress: state.currentLvlProgress,
      patches: serializedPatches,
      rocks: serializedRocks,
      grid: serializedGrid
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Błąd zapisu gry:", err);
  }
};

window.Factory.loadGame = function() {
  const { state, LEVELS, initInitialWorld, rebuildHub } = window.Factory;
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    let isLegacy = false;

    // Wsteczna kompatybilność z zapisem v3
    if (!raw) {
      raw = localStorage.getItem(LEGACY_SAVE_KEY);
      isLegacy = true;
    }
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (!data || (data.version !== 4 && data.version !== 3)) return false;

    state.sciencePoints = Number(data.sciencePoints) || 0;
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

    // Jeśli wczytujemy stary zapis v3 (bez zapisanych złóż i skał), najpierw wygeneruj świat bazowy
    if (isLegacy || !Array.isArray(data.patches) || data.patches.length === 0) {
      initInitialWorld(state.mapSeed);
    } else {
      state.patches.clear();
      data.patches.forEach(p => {
        state.patches.set(p.key, { kind: p.kind, subType: p.subType });
      });

      state.rocks.clear();
      if (Array.isArray(data.rocks)) {
        data.rocks.forEach(rKey => state.rocks.add(rKey));
      }
    }

    // Wczytaj budynki gracza
    state.grid.clear();
    state.beltItems = [];

    if (Array.isArray(data.grid)) {
      data.grid.forEach(b => {
        if (b.type === 'hub') return; // Hub odtworzymy za chwilę przez rebuildHub()
        state.rocks.delete(b.key);    // Upewnij się, że pod budynkiem ze starego zapisu nie ma skały
        state.grid.set(b.key, {
          type: b.type,
          x: b.x,
          y: b.y,
          rot: b.rot || 0,
          timer: 0,
          fuelTimer: Number(b.fuelTimer) || 0,
          storedShape: null,
          storedDye: null,
          storedInputs: [],
          storedDyes: []
        });
      });
    }

    // Odtwórz Hub o właściwym rozmiarze (2x2, 3x3 lub 4x4)
    rebuildHub();

    return true;
  } catch (err) {
    console.warn("Błąd wczytywania zapisu, start od nowa:", err);
    return false;
  }
};

window.Factory.clearGameSave = function() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY);
  window.location.reload();
};