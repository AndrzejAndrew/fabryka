window.Factory = window.Factory || {};

window.Factory.drawShape = function(ctx, x, y, shape, size) {
  if (!Array.isArray(shape)) return;
  const { COLOR_MAP } = window.Factory;
  const half = size / 2; const radius = size / 2;
  ctx.save(); ctx.translate(x, y);
  for (let q = 0; q < 4; q++) {
    const quad = shape[q]; if (!quad || typeof quad !== 'object') continue;
    ctx.fillStyle = COLOR_MAP[quad.color] || COLOR_MAP.uncolored;
    ctx.strokeStyle = '#0d1017'; ctx.lineWidth = 1.5; ctx.save();
    ctx.rotate((q * Math.PI) / 2 - Math.PI / 2);
    ctx.beginPath();
    if (quad.type === 'circle') { ctx.moveTo(0, 0); ctx.arc(0, 0, radius, 0, Math.PI / 2); ctx.closePath(); } 
    else if (quad.type === 'star') { ctx.moveTo(0, 0); ctx.lineTo(radius * 0.45, 0); ctx.lineTo(radius * 1.15, radius * 1.15); ctx.lineTo(0, radius * 0.45); ctx.closePath(); } 
    else { ctx.rect(0, 0, half, half); }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
};

window.Factory.drawDyeDrop = function(ctx, x, y, color, size) {
  const { COLOR_MAP } = window.Factory;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = COLOR_MAP[color] || '#ff4d4f'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx.beginPath(); ctx.arc(-size * 0.1, -size * 0.1, size * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

// NOWA FUNKCJA - rysowanie tokstycznych beczek (żużla)
window.Factory.drawWaste = function(ctx, x, y, size) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#262c36'; ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3fb950'; ctx.beginPath(); ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};

window.Factory.drawRock = function(ctx, gx, gy) {
  const { GRID_SIZE } = window.Factory; const px = gx * GRID_SIZE; const py = gy * GRID_SIZE;
  ctx.fillStyle = '#262c36'; ctx.strokeStyle = '#3b4352'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px + 6, py + 4); ctx.lineTo(px + GRID_SIZE - 5, py + 7); ctx.lineTo(px + GRID_SIZE - 3, py + GRID_SIZE - 6); ctx.lineTo(px + 5, py + GRID_SIZE - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1c2129'; ctx.fillRect(px + 12, py + 12, GRID_SIZE - 24, GRID_SIZE - 24);
};

window.Factory.drawBuilding = function(ctx, gx, gy, type, rot, alpha = 1.0, bObj = null) {
  if (type.endsWith('_sec')) return; 
  
  const { GRID_SIZE, DIRS } = window.Factory;
  const cx = gx * GRID_SIZE + GRID_SIZE / 2; const cy = gy * GRID_SIZE + GRID_SIZE / 2;
  const dirObj = DIRS[rot] || DIRS[0];

  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(dirObj.angle);

  if (type === 'belt') {
    ctx.fillStyle = '#1c2128'; ctx.strokeStyle = '#30363d'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#8b949e'; ctx.beginPath(); ctx.moveTo(0, -GRID_SIZE * 0.26); ctx.lineTo(GRID_SIZE * 0.2, GRID_SIZE * 0.14); ctx.lineTo(-GRID_SIZE * 0.2, GRID_SIZE * 0.14); ctx.closePath(); ctx.fill();
  } else if (type === 'miner') {
    const powered = bObj && bObj.isPowered;
    ctx.fillStyle = powered ? '#2ea043' : '#238636'; ctx.strokeStyle = powered ? '#fadb14' : '#3fb950'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 3, -GRID_SIZE/2 + 3, GRID_SIZE - 6, GRID_SIZE - 6); ctx.strokeRect(-GRID_SIZE/2 + 3, -GRID_SIZE/2 + 3, GRID_SIZE - 6, GRID_SIZE - 6);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -GRID_SIZE * 0.36); ctx.lineTo(GRID_SIZE * 0.16, -GRID_SIZE * 0.08); ctx.lineTo(-GRID_SIZE * 0.16, -GRID_SIZE * 0.08); ctx.closePath(); ctx.fill();
  } else if (type === 'cutter') {
    ctx.fillStyle = '#9e6a03'; ctx.strokeStyle = '#e3b341'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(GRID_SIZE * 0.5, -GRID_SIZE * 0.36); ctx.lineTo(GRID_SIZE * 0.5, GRID_SIZE * 0.36); ctx.stroke();
    ctx.fillStyle = '#d29922'; ctx.beginPath(); ctx.moveTo(-6, GRID_SIZE * 0.42); ctx.lineTo(6, GRID_SIZE * 0.42); ctx.lineTo(0, GRID_SIZE * 0.24); ctx.closePath(); ctx.fill();
  } else if (type === 'merger') {
    ctx.fillStyle = '#bd2c00'; ctx.strokeStyle = '#f85149'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#d29922'; ctx.fillRect(-6, GRID_SIZE * 0.25, 12, 6); ctx.fillRect(GRID_SIZE - 6, GRID_SIZE * 0.25, 12, 6);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-GRID_SIZE * 0.22, -GRID_SIZE * 0.1); ctx.lineTo(0, -GRID_SIZE * 0.35); ctx.lineTo(GRID_SIZE * 0.22, -GRID_SIZE * 0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(0, GRID_SIZE * 0.1); ctx.lineTo(GRID_SIZE * 0.5, -GRID_SIZE * 0.1); ctx.lineTo(GRID_SIZE, GRID_SIZE * 0.1); ctx.stroke();
  } else if (type === 'painter') {
    ctx.fillStyle = '#9a6700'; ctx.strokeStyle = '#d29922'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(-6, GRID_SIZE * 0.15, 12, 12); 
    ctx.fillStyle = '#ff7b72'; ctx.beginPath(); ctx.arc(GRID_SIZE, GRID_SIZE * 0.22, 6, 0, Math.PI * 2); ctx.fill(); 
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
    // Ikona Odpadów
    ctx.fillStyle = '#3fb950'; ctx.beginPath(); ctx.arc(GRID_SIZE, -14, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'mixer') {
    ctx.fillStyle = '#553098'; ctx.strokeStyle = '#a371f7'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#ff4d4f'; ctx.beginPath(); ctx.arc(0, GRID_SIZE * 0.22, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1890ff'; ctx.beginPath(); ctx.arc(GRID_SIZE, GRID_SIZE * 0.22, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
  } else if (type === 'synthesizer') {
    ctx.fillStyle = '#0969da'; ctx.strokeStyle = '#54aeff'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, GRID_SIZE * 0.2, 5, 0, Math.PI*2); ctx.stroke();
    ctx.strokeRect(GRID_SIZE - 5, GRID_SIZE * 0.15, 10, 10);
    ctx.fillStyle = '#fadb14'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(3, -5); ctx.lineTo(10, -2); ctx.lineTo(3, 1); ctx.lineTo(0, 8); ctx.lineTo(-3, 1); ctx.lineTo(-10, -2); ctx.lineTo(-3, -5); ctx.closePath(); ctx.fill();
    // Ikona Odpadów
    ctx.fillStyle = '#3fb950'; ctx.beginPath(); ctx.arc(GRID_SIZE, -14, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'splitter') {
    ctx.fillStyle = '#2d333b'; ctx.strokeStyle = '#636e7b'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#d29922'; ctx.fillRect(-6, GRID_SIZE * 0.25, 12, 6);
    ctx.fillStyle = '#58a6ff'; 
    ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(6, 2); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(GRID_SIZE - 6, 2); ctx.lineTo(GRID_SIZE + 6, 2); ctx.lineTo(GRID_SIZE, -12); ctx.closePath(); ctx.fill();
  } else if (type === 'rotator') {
    ctx.fillStyle = '#1f6feb'; ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, GRID_SIZE * 0.22, -Math.PI * 0.7, Math.PI * 0.5); ctx.stroke();
  } else if (type === 'generator') {
    const active = bObj && bObj.fuelTimer > 0;
    ctx.fillStyle = active ? '#b08800' : '#30363d'; ctx.strokeStyle = active ? '#fadb14' : '#6e7681'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = active ? '#ffffff' : '#8b949e'; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-6, 1); ctx.lineTo(1, 1); ctx.lineTo(-2, 10); ctx.lineTo(6, -1); ctx.lineTo(-1, -1); ctx.closePath(); ctx.fill();
  } else if (type === 'incinerator') {
    // --- NOWY BUDYNEK: SPALARNIA ---
    const active = bObj && bObj.fuelTimer > 0;
    ctx.fillStyle = '#1c2129'; ctx.strokeStyle = active ? '#ff4d4f' : '#6e7681'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    // Płomień
    ctx.fillStyle = active ? '#ff4d4f' : '#3b4352';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  } else if (type === 'landfill') {
    // --- NOWY BUDYNEK: WYSYPISKO ---
    ctx.fillStyle = '#2d333b'; ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    // Wskaźnik zapełnienia
    const fillPct = bObj ? (Math.min(100, bObj.storedWaste || 0) / 100) : 0;
    ctx.fillStyle = 'rgba(63, 185, 80, 0.4)';
    const maxH = GRID_SIZE - 8;
    ctx.fillRect(-GRID_SIZE/2 + 4, GRID_SIZE/2 - 4 - (maxH * fillPct), GRID_SIZE - 8, maxH * fillPct);
    // Ikona beczki
    ctx.fillStyle = '#3fb950'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'tunnel_in' || type === 'tunnel_out') {
    ctx.fillStyle = '#382554'; ctx.strokeStyle = '#8957e5'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#d2a8ff'; ctx.beginPath(); if (type === 'tunnel_in') ctx.arc(0, -GRID_SIZE * 0.1, GRID_SIZE * 0.25, Math.PI, 0); else ctx.arc(0, GRID_SIZE * 0.1, GRID_SIZE * 0.25, 0, Math.PI); ctx.closePath(); ctx.fill();
  } else if (type === 'hub') {
    ctx.fillStyle = '#6e40c9'; ctx.strokeStyle = '#a371f7'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2); ctx.strokeRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, GRID_SIZE * 0.2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
};