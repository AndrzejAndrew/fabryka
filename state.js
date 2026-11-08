export const state = {
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

export function initInitialWorld() {
  // Hub 2x2 w centrum
  state.grid.set("0,0", { type: 'hub', x: 0, y: 0, rot: 0 });
  state.grid.set("1,0", { type: 'hub', x: 1, y: 0, rot: 0 });
  state.grid.set("0,1", { type: 'hub', x: 0, y: 1, rot: 0 });
  state.grid.set("1,1", { type: 'hub', x: 1, y: 1, rot: 0 });

  function generateCluster(cx, cy, r, kind, color = null) {
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist <= r) {
          if (dist < r - 0.7 || Math.random() > 0.35) {
            const gx = cx + x;
            const gy = cy + y;
            if (Math.abs(gx) > 2 || Math.abs(gy) > 2) {
              state.patches.set(`${gx},${gy}`, { kind, color });
            }
          }
        }
      }
    }
  }

  // Złoża kształtów
  generateCluster(-8, -6, 3, 'shape', 'circle');
  generateCluster(10, -5, 3, 'shape', 'square');
  generateCluster(-8, 9, 3, 'shape', 'square');
  generateCluster(9, 8, 3, 'shape', 'circle');

  // Złoża barwników podstawowych (RGB)
  generateCluster(-16, -2, 3, 'dye', 'red');
  generateCluster(-3, -14, 3, 'dye', 'green');
  generateCluster(15, 12, 3, 'dye', 'blue');
}