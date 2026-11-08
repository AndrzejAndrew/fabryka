const SAVE_KEY = 'schematic_factory_save_v2';

export function saveGame(state) {
  try {
    const serializedGrid = Array.from(state.grid.entries()).map(([key, b]) => ({
      key,
      type: b.type,
      x: b.x,
      y: b.y,
      rot: b.rot
    }));

    const data = {
      version: 2,
      sciencePoints: state.sciencePoints,
      beltSpeedLvl: state.beltSpeedLvl,
      minerSpeedLvl: state.minerSpeedLvl,
      currentLvlIndex: state.currentLvlIndex,
      currentLvlProgress: state.currentLvlProgress,
      grid: serializedGrid
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Błąd zapisu localStorage:", err);
  }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    state.sciencePoints = data.sciencePoints || 0;
    state.beltSpeedLvl = data.beltSpeedLvl || 1;
    state.minerSpeedLvl = data.minerSpeedLvl || 1;
    state.currentLvlIndex = data.currentLvlIndex || 0;
    state.currentLvlProgress = data.currentLvlProgress || 0;

    state.beltSpeed = 2.5 + (state.beltSpeedLvl - 1) * 1.0;
    state.minerInterval = Math.max(2, 5 - (state.minerSpeedLvl - 1));

    if (Array.isArray(data.grid)) {
      state.grid.clear();
      data.grid.forEach(b => {
        state.grid.set(b.key, {
          type: b.type,
          x: b.x,
          y: b.y,
          rot: b.rot,
          timer: 0,
          storedShape: null,
          storedDye: null,
          storedInputs: [],
          storedDyes: []
        });
      });
    }

    return true;
  } catch (err) {
    console.error("Błąd odczytu localStorage:", err);
    return false;
  }
}

export function clearGameSave() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
}