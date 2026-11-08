window.Factory = window.Factory || {};

window.Factory.drawShape = function(ctx, x, y, shape, size) {
  if (!Array.isArray(shape)) return;
  const { COLOR_MAP } = window.Factory;
  const half = size / 2;
  const radius = size / 2;

  ctx.save();
  ctx.translate(x, y);

  for (let q = 0; q < 4; q++) {
    const quad = shape[q];
    if (!quad || typeof quad !== 'object') continue;

    ctx.fillStyle = COLOR_MAP[quad.color] || COLOR_MAP.uncolored;
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 1.5;

    ctx.save();
    ctx.rotate((q * Math.PI) / 2);
    ctx.beginPath();
    if (quad.type === 'circle') {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, 0, Math.PI / 2);
      ctx.closePath();
    } else {
      ctx.rect(0, 0, half, half);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

window.Factory.drawDyeDrop = function(ctx, x, y, color, size) {
  const { COLOR_MAP } = window.Factory;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COLOR_MAP[color] || '#ff4d4f';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(-size * 0.1, -size * 0.1, size * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

window.Factory.drawBuilding = function(ctx, gx, gy, type, rot, alpha = 1.0) {
  const { GRID_SIZE, DIRS } = window.Factory;
  const cx = gx * GRID_SIZE + GRID_SIZE / 2;
  const cy = gy * GRID_SIZE + GRID_SIZE / 2;
  const dirObj = DIRS[rot] || DIRS[0];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(dirObj.angle);

  if (type === 'belt') {
    ctx.fillStyle = '#21262d';
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#8b949e';
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE * 0.26);
    ctx.lineTo(GRID_SIZE * 0.2, GRID_SIZE * 0.14);
    ctx.lineTo(-GRID_SIZE * 0.2, GRID_SIZE * 0.14);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'miner') {
    ctx.fillStyle = '#238636';
    ctx.strokeStyle = '#2ea043';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 3, -GRID_SIZE/2 + 3, GRID_SIZE - 6, GRID_SIZE - 6);
    ctx.strokeRect(-GRID_SIZE/2 + 3, -GRID_SIZE/2 + 3, GRID_SIZE - 6, GRID_SIZE - 6);
    ctx.fillStyle = '#f0f6fc';
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE * 0.35);
    ctx.lineTo(GRID_SIZE * 0.15, -GRID_SIZE * 0.1);
    ctx.lineTo(-GRID_SIZE * 0.15, -GRID_SIZE * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'cutter') {
    ctx.fillStyle = '#d29922';
    ctx.strokeStyle = '#e3b341';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    // Linia cięcia
    ctx.strokeStyle = '#f0f6fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE * 0.35);
    ctx.lineTo(0, GRID_SIZE * 0.35);
    ctx.stroke();
    // Wskaźnik lewego wyrzutu
    ctx.fillStyle = '#f0f6fc';
    ctx.beginPath();
    ctx.arc(-GRID_SIZE * 0.32, 0, 3, 0, Math.PI * 2);
    ctx.arc(0, -GRID_SIZE * 0.32, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'rotator') {
    ctx.fillStyle = '#1f6feb';
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeStyle = '#f0f6fc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, GRID_SIZE * 0.22, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (type === 'merger') {
    ctx.fillStyle = '#da3633';
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#f0f6fc';
    ctx.beginPath();
    ctx.moveTo(-GRID_SIZE * 0.2, GRID_SIZE * 0.25);
    ctx.lineTo(0, 0);
    ctx.lineTo(GRID_SIZE * 0.2, GRID_SIZE * 0.25);
    ctx.lineTo(0, -GRID_SIZE * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'painter') {
    ctx.fillStyle = '#b08800';
    ctx.strokeStyle = '#e3b341';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#f0f6fc';
    ctx.fillRect(-GRID_SIZE * 0.2, -GRID_SIZE * 0.25, GRID_SIZE * 0.4, GRID_SIZE * 0.18);
    ctx.fillStyle = '#ff7b72';
    ctx.fillRect(-GRID_SIZE * 0.08, -GRID_SIZE * 0.07, GRID_SIZE * 0.16, GRID_SIZE * 0.32);
  } else if (type === 'mixer') {
    ctx.fillStyle = '#3b2361';
    ctx.strokeStyle = '#a371f7';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath();
    ctx.arc(-GRID_SIZE * 0.15, GRID_SIZE * 0.15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7b72';
    ctx.beginPath();
    ctx.arc(GRID_SIZE * 0.15, GRID_SIZE * 0.15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a371f7';
    ctx.beginPath();
    ctx.arc(0, -GRID_SIZE * 0.15, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'tunnel_in' || type === 'tunnel_out') {
    ctx.fillStyle = '#382554';
    ctx.strokeStyle = '#8957e5';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
    ctx.fillStyle = '#bf94ff';
    ctx.beginPath();
    if (type === 'tunnel_in') ctx.arc(0, -GRID_SIZE * 0.1, GRID_SIZE * 0.25, Math.PI, 0);
    else ctx.arc(0, GRID_SIZE * 0.1, GRID_SIZE * 0.25, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'hub') {
    ctx.fillStyle = '#6e40c9';
    ctx.strokeStyle = '#8957e5';
    ctx.lineWidth = 2;
    ctx.fillRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.strokeRect(-GRID_SIZE/2 + 1, -GRID_SIZE/2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.strokeStyle = '#f0f6fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, GRID_SIZE * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
};
