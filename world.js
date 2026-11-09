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

  hubSize: 2,
  rockDrillUnlocked: false,

  currentLvlIndex: 0,
  currentLvlProgress: 0,

  mapSeed: 123456,
  lastSaveTime: Date.now(),

  patches: new Map(),
  rocks: new Set(),
  grid: new Map(),
  beltItems: []
};

// Deterministyczny generator liczb pseudolosowych (Mulberry32)
function createRNG(seed) {
  let a = seed >>> 0;
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Buduje lub rozbudowuje Hub (2x2, 3x3, 4x4) w centrum mapy
window.Factory.rebuildHub = function() {
  const { state } = window.Factory;
  const size = state.hubSize || 2;

  // Usuń stare kafelki Huba
  for (const [key, cell] of state.grid.entries()) {
    if (cell.type === 'hub') {
      state.grid.delete(key);
    }
  }

  // Wyznacz granice Huba wokół środka (dla 2x2: od 0 do 1; dla 3x3: od -1 do 1; dla 4x4: od -1 do 2)
  const startOffset = -Math.floor((size - 2) / 2);
  const endOffset = startOffset + size - 1;

  for (let x = startOffset; x <= endOffset; x++) {
    for (let y = startOffset; y <= endOffset; y++) {
      const key = `${x},${y}`;
      state.rocks.delete(key);
      state.patches.delete(key);
      state.grid.set(key, { type: 'hub', x, y, rot: 0 });
    }
  }
};

// Proceduralne generowanie świata (złoża kształtów, barwniki RGB oraz formacje skalne)
window.Factory.initInitialWorld = function(customSeed) {
  const { state, rebuildHub } = window.Factory;

  state.mapSeed = (typeof customSeed === 'number' && !isNaN(customSeed))
    ? customSeed
    : Math.floor(Math.random() * 1000000);

  const rng = createRNG(state.mapSeed);

  state.patches.clear();
  state.rocks.clear();
  state.grid.clear();
  state.beltItems = [];

  // Strefa bezpieczna wokół Huba (promień 5 kratek czysty od złóż i skał)
  const SAFE_ZONE = 4;

  function isSafeZone(gx, gy) {
    return gx >= -SAFE_ZONE && gx <= SAFE_ZONE + 1 && gy >= -SAFE_ZONE && gy <= SAFE_ZONE + 1;
  }

  // Funkcja pomocnicza generująca naturalny klaster złoża
  function generateCluster(cx, cy, r, kind, subType) {
    const rCeil = Math.ceil(r);
    for (let x = -rCeil; x <= rCeil; x++) {
      for (let y = -rCeil; y <= rCeil; y++) {
        // Lekkie zniekształcenie krawędzi dla bardziej naturalnego kształtu złoża
        const jitter = (rng() - 0.5) * 0.65;
        const dist = Math.sqrt(x * x + y * y);
        if (dist <= r + jitter) {
          const gx = cx + x;
          const gy = cy + y;
          if (!isSafeZone(gx, gy)) {
            const key = `${gx},${gy}`;
            state.rocks.delete(key); // Złoże zastępuje skałę
            state.patches.set(key, { kind, subType });
          }
        }
      }
    }
  }

  // Funkcja pomocnicza generująca pasma i kępy skał
  function generateRockFormation(cx, cy, length, thickness) {
    let currX = cx;
    let currY = cy;
    const angle = rng() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let step = 0; step < length; step++) {
      const ox = Math.round(currX + (rng() - 0.5) * 1.5);
      const oy = Math.round(currY + (rng() - 0.5) * 1.5);

      for (let rx = -thickness; rx <= thickness; rx++) {
        for (let ry = -thickness; ry <= thickness; ry++) {
          if (Math.sqrt(rx * rx + ry * ry) <= thickness + (rng() - 0.5) * 0.5) {
            const gx = ox + rx;
            const gy = oy + ry;
            const key = `${gx},${gy}`;
            if (!isSafeZone(gx, gy) && !state.patches.has(key)) {
              state.rocks.add(key);
            }
          }
        }
      }
      currX += dx;
      currY += dy;
    }
  }

  // 1. GWARANTOWANE ZŁOŻA STARTOWE (w pierwszym pierścieniu 7-13 kratek od bazy, w losowych kierunkach)
  const baseAngle = rng() * Math.PI * 2;
  const starterDefs = [
    { kind: 'shape', subType: 'circle', dist: 8 + rng() * 3, r: 2.8 },
    { kind: 'shape', subType: 'square', dist: 8 + rng() * 3, r: 2.8 },
    { kind: 'shape', subType: 'circle', dist: 10 + rng() * 4, r: 2.6 },
    { kind: 'shape', subType: 'square', dist: 10 + rng() * 4, r: 2.6 },
    { kind: 'dye', subType: 'red', dist: 13 + rng() * 4, r: 2.3 },
    { kind: 'dye', subType: 'green', dist: 13 + rng() * 4, r: 2.3 },
    { kind: 'dye', subType: 'blue', dist: 13 + rng() * 4, r: 2.3 }
  ];

  starterDefs.forEach((def, idx) => {
    const a = baseAngle + (idx * (Math.PI * 2)) / starterDefs.length + (rng() - 0.5) * 0.35;
    const cx = Math.round(Math.cos(a) * def.dist);
    const cy = Math.round(Math.sin(a) * def.dist);
    generateCluster(cx, cy, def.r, def.kind, def.subType);
  });

  // 2. DALSZE ZŁOŻA PROCEDURALNE (w promieniu od 18 do 48 kratek od Huba)
  const shapeTypes = ['circle', 'square'];
  const dyeTypes = ['red', 'green', 'blue'];

  for (let i = 0; i < 26; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 18 + rng() * 30;
    const cx = Math.round(Math.cos(angle) * dist);
    const cy = Math.round(Math.sin(angle) * dist);

    const isDye = rng() < 0.38;
    if (isDye) {
      const subType = dyeTypes[Math.floor(rng() * dyeTypes.length)];
      generateCluster(cx, cy, 2.0 + rng() * 1.5, 'dye', subType);
    } else {
      const subType = shapeTypes[Math.floor(rng() * shapeTypes.length)];
      generateCluster(cx, cy, 2.5 + rng() * 2.0, 'shape', subType);
    }
  }

  // 3. PROCEDURALNE FORMACJE SKALNE (przeszkody terenowe i pasma górskie)
  for (let i = 0; i < 32; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 9 + rng() * 38;
    const cx = Math.round(Math.cos(angle) * dist);
    const cy = Math.round(Math.sin(angle) * dist);
    const length = 3 + Math.floor(rng() * 7);
    const thickness = rng() < 0.65 ? 1 : 2;
    generateRockFormation(cx, cy, length, thickness);
  }

  // 4. Ustawienie Huba w centrum (domyślnie 2x2 lub większy po ulepszeniu)
  rebuildHub();
};