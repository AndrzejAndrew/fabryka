window.Factory = window.Factory || {};

window.Factory.state = {
  camera: { x: 0, y: 0, zoom: 1 },
  currentTool: 'belt',
  currentRotation: 1,

  sciencePoints: 0,
  beltSpeedLvl: 1,
  minerSpeedLvl: 1,
  beltSpeed: 2.5,
  minerInterval: 5,

  currentLvlIndex: 0,
  currentLvlProgress: 0,

  patches: new Map(),
  grid: new Map(),
  beltItems: []
};

window.Factory.initInitialWorld = function() {
  const { state } = window.Factory;
  state.patches.clear();
  state.grid.clear();
  state.beltItems = [];

  // Hub 2x2 w centrum (0,0 do 1,1)
  state.grid.set("0,0", { type: 'hub', x: 0, y: 0, rot: 0 });
  state.grid.set("1,0", { type: 'hub', x: 1, y: 0, rot: 0 });
  state.grid.set("0,1", { type: 'hub', x: 0, y: 1, rot: 0 });
  state.grid.set("1,1", { type: 'hub', x: 1, y: 1, rot: 0 });

  function generateCluster(cx, cy, r, kind, subType) {
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist <= r - 0.2) {
          const gx = cx + x;
          const gy = cy + y;
          if (Math.abs(gx) > 2 || Math.abs(gy) > 2) {
            state.patches.set(`${gx},${gy}`, { kind, subType });
          }
        }
      }
    }
  }

  // Złoża kształtów
  generateCluster(-8, -5, 3, 'shape', 'circle');
  generateCluster(9, -5, 3, 'shape', 'square');
  generateCluster(-7, 8, 3, 'shape', 'square');
  generateCluster(8, 8, 3, 'shape', 'circle');

  // Złoża barwników RGB
  generateCluster(-15, 1, 2.5, 'dye', 'red');
  generateCluster(0, -13, 2.5, 'dye', 'green');
  generateCluster(14, 1, 2.5, 'dye', 'blue');
};
