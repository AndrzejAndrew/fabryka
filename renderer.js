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

  const { GRID_SIZE, DIRS, state } = window.Factory;
  const cx = gx * GRID_SIZE + GRID_SIZE / 2; const cy = gy * GRID_SIZE + GRID_SIZE / 2;
  const dirObj = DIRS[rot] || DIRS[0];

  // Rysowanie struktur wielopolowych 2x2 (Kuźnia) oraz 3x3 (Stocznia Arki) bez rotacji bryły
  if (type === 'foundry') {
    const px = gx * GRID_SIZE; const py = gy * GRID_SIZE;
    const sz = GRID_SIZE * 2;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#21262d'; ctx.strokeStyle = '#d29922'; ctx.lineWidth = 2.5;
    ctx.fillRect(px + 2, py + 2, sz - 4, sz - 4);
    ctx.strokeRect(px + 2, py + 2, sz - 4, sz - 4);

    // Piec hutniczy w centrum 2x2
    ctx.fillStyle = (bObj && bObj.isPowered) ? '#e3b341' : '#30363d';
    ctx.beginPath(); ctx.arc(px + sz / 2, py + sz / 2 - 4, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏭 2x2', px + sz / 2, py + sz / 2 - 4);

    ctx.fillStyle = '#8b949e'; ctx.font = '10px sans-serif';
    ctx.fillText('🔩 + 🔋 | ☣️', px + sz / 2, py + sz - 12);

    // Wskaźnik braku prądu dla Kuźni
    if (bObj && !bObj.isPowered) {
      ctx.fillStyle = 'rgba(248, 81, 73, 0.92)';
      ctx.beginPath(); ctx.arc(px + sz - 14, py + 14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('⚡', px + sz - 14, py + 14);
    }
    ctx.restore();
    return;
  }

  if (type === 'ark') {
    const px = gx * GRID_SIZE; const py = gy * GRID_SIZE;
    const sz = GRID_SIZE * 3;
    const cores = bObj ? (bObj.arkCoresDelivered || 0) : 0;
    const cells = Math.min(30, state.energyCells || 0);
    const pct = Math.min(100, Math.floor(((Math.min(50, cores) / 50) * 0.6 + (cells / 30) * 0.4) * 100));

    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#161b22'; ctx.strokeStyle = pct >= 100 ? '#3fb950' : '#a371f7'; ctx.lineWidth = 3;
    ctx.fillRect(px + 2, py + 2, sz - 4, sz - 4);
    ctx.strokeRect(px + 2, py + 2, sz - 4, sz - 4);

    // Okrąg platformy startowej Arki
    ctx.strokeStyle = 'rgba(163, 113, 247, 0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px + sz / 2, py + sz / 2 - 10, sz * 0.3, 0, Math.PI * 2); ctx.stroke();

    // Sylwetka Rakiety / Arki
    ctx.fillStyle = pct >= 100 ? '#3fb950' : '#58a6ff';
    ctx.beginPath();
    ctx.moveTo(px + sz / 2, py + 18);
    ctx.lineTo(px + sz / 2 + 16, py + sz / 2 + 6);
    ctx.lineTo(px + sz / 2 - 16, py + sz / 2 + 6);
    ctx.closePath(); ctx.fill();

    // Pasek postępu budowy na dole Stoczni 3x3
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(px + 10, py + sz - 34, sz - 20, 12);
    ctx.fillStyle = pct >= 100 ? '#3fb950' : '#a371f7';
    ctx.fillRect(px + 10, py + sz - 34, ((sz - 20) * pct) / 100, 12);

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`ARKA: ${pct}% (⭐${cores}/50 | 🔋${cells}/30)`, px + sz / 2, py + sz - 12);

    if (bObj && !bObj.isPowered) {
      ctx.fillStyle = 'rgba(248, 81, 73, 0.92)';
      ctx.beginPath(); ctx.arc(px + sz - 16, py + 16, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('⚡', px + sz - 16, py + 16);
    }
    ctx.restore();
    return;
  }

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
    const active = bObj && bObj.fuelTimer > 0;
    ctx.fillStyle = '#1c2129'; ctx.strokeStyle = active ? '#ff4d4f' : '#6e7681'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = active ? '#ff4d4f' : '#3b4352';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  } else if (type === 'landfill') {
    const count = bObj ? (bObj.storedWaste || 0) : 0;
    const isFull = count >= 100;
    ctx.fillStyle = '#2d333b';
    ctx.strokeStyle = isFull ? '#f85149' : '#3fb950';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);

    const fillPct = Math.min(100, count) / 100;
    ctx.fillStyle = isFull ? 'rgba(248, 81, 73, 0.5)' : 'rgba(63, 185, 80, 0.4)';
    const maxH = GRID_SIZE - 8;
    ctx.fillRect(-GRID_SIZE/2 + 4, GRID_SIZE/2 - 4 - (maxH * fillPct), GRID_SIZE - 8, maxH * fillPct);

    ctx.fillStyle = '#3fb950';
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE * 0.42);
    ctx.lineTo(5, -GRID_SIZE * 0.26);
    ctx.lineTo(-5, -GRID_SIZE * 0.26);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.rotate(-dirObj.angle);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${count}`, 0, 2);
    ctx.restore();
  } else if (type === 'tunnel_in' || type === 'tunnel_out') {
    ctx.fillStyle = '#382554'; ctx.strokeStyle = '#8957e5'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4); ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#d2a8ff'; ctx.beginPath(); if (type === 'tunnel_in') ctx.arc(0, -GRID_SIZE * 0.1, GRID_SIZE * 0.25, Math.PI, 0); else ctx.arc(0, GRID_SIZE * 0.1, GRID_SIZE * 0.25, 0, Math.PI); ctx.closePath(); ctx.fill();
  } else if (type === 'hub') {
    ctx.fillStyle = '#6e40c9'; ctx.strokeStyle = '#a371f7'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2); ctx.strokeRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, GRID_SIZE * 0.2, 0, Math.PI * 2); ctx.stroke();
  }
} else if (type === 'foundry') {
    // KUŹNIA PREFABRYKATÓW 2x1
    ctx.fillStyle = '#3b2314'; ctx.strokeStyle = '#ffa657'; ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE * 2 - 4, GRID_SIZE - 4);
    // Lewy wlot: ikona Gwiazdy
    ctx.fillStyle = '#fadb14';
    ctx.beginPath(); ctx.arc(0, GRID_SIZE * 0.22, 5, 0, Math.PI * 2); ctx.fill();
    // Prawy wlot: ikona Kształtu
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(GRID_SIZE - 5, GRID_SIZE * 0.16, 10, 10);
    // Środek: symbol stalowej sztaby / zębatki 🔩
    ctx.fillStyle = '#ffa657';
    ctx.fillRect(GRID_SIZE * 0.25, -8, GRID_SIZE * 0.5, 12);
    // Prawy wylot: zielona kropka Żużla
    ctx.fillStyle = '#3fb950';
    ctx.beginPath(); ctx.arc(GRID_SIZE, -14, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'ark_shipyard') {
    // STOCZNIA ARKI 3x3 (9 pól!)
    ctx.rotate(-dirObj.angle); // Stocznia 3x3 zawsze rysowana prosto
    const totalW = GRID_SIZE * 3;
    ctx.fillStyle = '#111827'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, totalW - 4, totalW - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, totalW - 4, totalW - 4);

    // Lądowisko w centrum 3x3
    const centerX = GRID_SIZE; const centerY = GRID_SIZE;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(centerX, centerY, GRID_SIZE * 1.1, 0, Math.PI * 2); ctx.stroke();

    // Postęp budowy Arki
    const { state, LEVELS } = window.Factory;
    const req = LEVELS[LEVELS.length - 1].requiredCount || 60;
    const prog = (state.currentLvlIndex >= LEVELS.length - 1) ? state.currentLvlProgress : 0;
    const pct = Math.min(1, prog / req);

    // Rysowanie kadłuba statku Arki zależnie od % ukończenia
    ctx.fillStyle = pct >= 1 ? '#fadb14' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - GRID_SIZE * 0.9);
    ctx.lineTo(centerX + GRID_SIZE * 0.65, centerY + GRID_SIZE * 0.7);
    ctx.lineTo(centerX, centerY + GRID_SIZE * 0.4);
    ctx.lineTo(centerX - GRID_SIZE * 0.65, centerY + GRID_SIZE * 0.7);
    ctx.closePath();
    ctx.globalAlpha = 0.2 + 0.8 * pct;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();

    // Napis postępu na Stoczni
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`ARKA: ${Math.floor(pct * 100)}%`, centerX, centerY + GRID_SIZE * 1.05);
	
  if (bObj && ['painter', 'mixer', 'synthesizer'].includes(type)) {
    const needsPower = type !== 'synthesizer' || (window.Factory.state.currentLvlIndex >= 5);
    if (needsPower && !bObj.isPowered) {
      ctx.save();
      ctx.rotate(-dirObj.angle);
      ctx.fillStyle = 'rgba(248, 81, 73, 0.9)';
      ctx.beginPath();
      ctx.arc(GRID_SIZE * 0.5, -GRID_SIZE * 0.35, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', GRID_SIZE * 0.5, -GRID_SIZE * 0.35);
      ctx.restore();
    }
  }
	if (bObj && ['painter', 'mixer', 'synthesizer', 'foundry', 'ark_shipyard'].includes(type)) {
  ctx.restore();
};