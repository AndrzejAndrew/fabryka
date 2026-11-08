export const GRID_SIZE = 40;

export const DIRS = [
  { x: 0, y: -1, angle: 0 },             // 0: N
  { x: 1, y: 0, angle: Math.PI / 2 },    // 1: E
  { x: 0, y: 1, angle: Math.PI },        // 2: S
  { x: -1, y: 0, angle: -Math.PI / 2 }   // 3: W
];

export const COLOR_MAP = {
  uncolored: '#7f8c8d',
  red: '#ff4d4f',
  green: '#52c41a',
  blue: '#1890ff',
  yellow: '#fadb14',
  purple: '#722ed1',
  cyan: '#13c2c2',
  white: '#f0f2f5'
};

export const COLOR_MIXES = {
  'red+green': 'yellow',
  'green+red': 'yellow',
  'red+blue': 'purple',
  'blue+red': 'purple',
  'green+blue': 'cyan',
  'blue+green': 'cyan'
};

export function makeQuad(type, color = 'uncolored') {
  return type ? { type, color } : null;
}

export const LEVELS = [
  {
    lvl: 1,
    title: "Dostarcz Pełne Koła",
    requiredCount: 20,
    targetShape: [makeQuad('circle'), makeQuad('circle'), makeQuad('circle'), makeQuad('circle')],
    unlocks: ['cutter']
  },
  {
    lvl: 2,
    title: "Dostarcz Połówki Kół",
    requiredCount: 30,
    targetShape: [null, null, makeQuad('circle'), makeQuad('circle')],
    unlocks: ['rotator']
  },
  {
    lvl: 3,
    title: "Dostarcz Połówkę Prawą",
    requiredCount: 30,
    targetShape: [makeQuad('circle'), makeQuad('circle'), null, null],
    unlocks: ['merger']
  },
  {
    lvl: 4,
    title: "Dostarcz Hybrydę Koło-Kwadrat",
    requiredCount: 40,
    targetShape: [makeQuad('square'), makeQuad('square'), makeQuad('circle'), makeQuad('circle')],
    unlocks: ['painter']
  },
  {
    lvl: 5,
    title: "Dostarcz Czerwone Koła",
    requiredCount: 40,
    targetShape: [makeQuad('circle', 'red'), makeQuad('circle', 'red'), makeQuad('circle', 'red'), makeQuad('circle', 'red')],
    unlocks: ['mixer']
  },
  {
    lvl: 6,
    title: "Dostarcz Zielone Kwadraty",
    requiredCount: 40,
    targetShape: [makeQuad('square', 'green'), makeQuad('square', 'green'), makeQuad('square', 'green'), makeQuad('square', 'green')],
    unlocks: ['tunnel_in', 'tunnel_out']
  },
  {
    lvl: 7,
    title: "Dostarcz Żółte Koła",
    requiredCount: 50,
    targetShape: [makeQuad('circle', 'yellow'), makeQuad('circle', 'yellow'), makeQuad('circle', 'yellow'), makeQuad('circle', 'yellow')],
    unlocks: []
  },
  {
    lvl: 8,
    title: "Dostarcz Fioletowe Hybrydy",
    requiredCount: 50,
    targetShape: [makeQuad('square', 'purple'), makeQuad('square', 'purple'), makeQuad('circle', 'purple'), makeQuad('circle', 'purple')],
    unlocks: []
  }
];