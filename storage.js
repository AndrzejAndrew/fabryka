window.Factory = window.Factory || {};

const SAVE_KEY = 'schematic_factory_save_v3';

window.Factory.saveGame = function() {
  const { state } = window.Factory;
  try {
    const serializedGrid = Array.from(state.grid.entries()).map(([key, b]) => ({
      key,
      type: b.type,
      x: b.x,
      y: b.y,
      rot: b.rot
    }));

    const data = {
      version: 3,
      sciencePoints: state.sciencePoints,
      beltSpeedLvl: state.beltSpeedLvl,
      minerSpeedLvl: state.minerSpeedLvl,
      currentLvlIndex: state.currentLvlIndex,
      currentLvlProgress: state.currentLvlProgress,
      grid: serializedGrid
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Błąd zapisu gry:", err);
  }
};

window.Factory.loadGame = function() {
  const { state, LEVELS } = window.Factory;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (!data || data.version !== 3) return false;

    state.sciencePoints = Number(data.sciencePoints) || 0;
    state.beltSpeedLvl = Number(data.beltSpeedLvl) || 1;
    state.minerSpeedLvl = Number(data.minerSpeedLvl) || 1;
    state.currentLvlIndex = Math.min(Number(data.currentLvlIndex) || 0, LEVELS.length - 1);
    state.currentLvlProgress = Number(data.currentLvlProgress) || 0;

    state.beltSpeed = 2.5 + (state.beltSpeedLvl - 1) * 1.0;
    state.minerInterval = Math.max(2, 5 - (state.minerSpeedLvl - 1));

    if (Array.isArray(data.grid) && data.grid.length > 0) {
      state.grid.clear();
      data.grid.forEach(b => {
        state.grid.set(b.key, {
          type: b.type,
          x: b.x,
          y: b.y,
          rot: b.rot || 0,
          timer: 0,
          storedShape: null,
          storedDye: null,
          storedInputs: [],
          storedDyes: []
        });
      });
      // Upewnij się, że Hub 2x2 zawsze istnieje
      state.grid.set("0,0", { type: 'hub', x: 0, y: 0, rot: 0 });
      state.grid.set("1,0", { type: 'hub', x: 1, y: 0, rot: 0 });
      state.grid.set("0,1", { type: 'hub', x: 0, y: 1, rot: 0 });
      state.grid.set("1,1", { type: 'hub', x: 1, y: 1, rot: 0 });
    }

    return true;
  } catch (err) {
    console.warn("Błąd wczytywania zapisu, start od nowa:", err);
    return false;
  }
};

window.Factory.clearGameSave = function() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
};
