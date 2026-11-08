window.Factory = window.Factory || {};

window.Factory.GRID_SIZE = 40;

window.Factory.DIRS = [
  { x: 0, y: -1, angle: 0 },             // 0: Góra (N)
  { x: 1, y: 0, angle: Math.PI / 2 },    // 1: Prawo (E)
  { x: 0, y: 1, angle: Math.PI },        // 2: Dół (S)
  { x: -1, y: 0, angle: -Math.PI / 2 }   // 3: Lewo (W)
];

window.Factory.COLOR_MAP = {
  uncolored: '#8b949e',
  red: '#ff4d4f',
  green: '#52c41a',
  blue: '#1890ff',
  yellow: '#fadb14',
  purple: '#9254de',
  cyan: '#13c2c2',
  white: '#ffffff'
};

window.Factory.COLOR_MIXES = {
  'red+green': 'yellow',
  'green+red': 'yellow',
  'red+blue': 'purple',
  'blue+red': 'purple',
  'green+blue': 'cyan',
  'blue+green': 'cyan',
  'yellow+blue': 'white',
  'blue+yellow': 'white',
  'purple+green': 'white',
  'green+purple': 'white',
  'cyan+red': 'white',
  'red+cyan': 'white'
};

window.Factory.makeQuad = function(type, color = 'uncolored') {
  return type ? { type, color } : null;
};

const mq = window.Factory.makeQuad;

window.Factory.LEVELS = [
  {
    lvl: 1,
    title: "Dostarcz Pełne Koła",
    requiredCount: 20,
    targetShape: [mq('circle'), mq('circle'), mq('circle'), mq('circle')],
    unlocks: ['cutter']
  },
  {
    lvl: 2,
    title: "Dostarcz Połówki Kół (Lewe)",
    requiredCount: 30,
    targetShape: [null, null, mq('circle'), mq('circle')],
    unlocks: ['rotator']
  },
  {
    lvl: 3,
    title: "Dostarcz Połówki Kół (Prawe)",
    requiredCount: 30,
    targetShape: [mq('circle'), mq('circle'), null, null],
    unlocks: ['merger']
  },
  {
    lvl: 4,
    title: "Dostarcz Hybrydę Koło-Kwadrat",
    requiredCount: 40,
    targetShape: [mq('square'), mq('square'), mq('circle'), mq('circle')],
    unlocks: ['painter']
  },
  {
    lvl: 5,
    title: "Dostarcz Czerwone Koła",
    requiredCount: 40,
    targetShape: [mq('circle', 'red'), mq('circle', 'red'), mq('circle', 'red'), mq('circle', 'red')],
    unlocks: ['mixer']
  },
  {
    lvl: 6,
    title: "Dostarcz Zielone Kwadraty",
    requiredCount: 40,
    targetShape: [mq('square', 'green'), mq('square', 'green'), mq('square', 'green'), mq('square', 'green')],
    unlocks: ['tunnel_in', 'tunnel_out']
  },
  {
    lvl: 7,
    title: "Dostarcz Żółte Koła",
    requiredCount: 50,
    targetShape: [mq('circle', 'yellow'), mq('circle', 'yellow'), mq('circle', 'yellow'), mq('circle', 'yellow')],
    unlocks: []
  },
  {
    lvl: 8,
    title: "Dostarcz Fioletowe Hybrydy",
    requiredCount: 50,
    targetShape: [mq('square', 'purple'), mq('square', 'purple'), mq('circle', 'purple'), mq('circle', 'purple')],
    unlocks: []
  }
];
