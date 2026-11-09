window.Factory = window.Factory || {};

window.Factory.GRID_SIZE = 40;
window.Factory.POWER_RADIUS = 5; // Promień zasięgu Generatora Prądu w kratkach

window.Factory.DIRS = [
  { x: 0, y: -1, angle: 0 },             // 0: Góra (N)
  { x: 1, y: 0, angle: Math.PI / 2 },    // 1: Prawo (E)
  { x: 0, y: 1, angle: Math.PI },        // 2: Dół (S)
  { x: -1, y: 0, angle: -Math.PI / 2 }   // 3: Lewo (W)
];

window.Factory.COLOR_MAP = {
  uncolored: '#9ea7b3',
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

window.Factory.TOOL_HINTS = {
  belt: "<strong>Przenośnik [1]:</strong> Przeciągnij LPM, aby ułożyć taśmociąg.",
  miner: "<strong>Ekstraktor [2]:</strong> Wydobywa Koła, Kwadraty lub Barwniki. Działa 2x szybciej w zasięgu prądu ⚡!",
  cutter: "<strong>Przecinarka [3]:</strong> Wlot z tyłu. Prawa połówka wychodzi na wprost, lewa w lewy bok!",
  rotator: "<strong>Rotator [4]:</strong> Obraca dowolny kształt o 90° w prawo.",
  merger: "<strong>Monter [5]:</strong> Podaj 2 połówki, aby scalić je w jeden kształt.",
  painter: "<strong>Lakiernia [6]:</strong> Podaj kształt oraz kroplę barwnika, aby nadać mu kolor.",
  mixer: "<strong>Mieszalnik [7]:</strong> Podaj 2 różne barwniki RGB, aby wymieszać nowy kolor.",
  synthesizer: "<strong>Syntezator [8]:</strong> Podaj 1x Pełne Koło i 1x Pełny Kwadrat, aby wytworzyć Gwiazdę ⭐ (wartą 5 ⚙ i dającą prąd)!",
  generator: "<strong>Generator Prądu [9]:</strong> Podaj Gwiazdę ⭐! Zasila okoliczne maszyny (promień 5 pól) na 15s, dając 2x szybsze wydobycie!",
  splitter: "<strong>Rozdzielacz [0]:</strong> Rozdziela przedmioty naprzemiennie: na wprost oraz w prawy bok.",
  tunnel_in: "<strong>Tunel Wejście [Q]:</strong> Przesyła surowce pod ziemią (do 5 kratek) pod innymi taśmami.",
  tunnel_out: "<strong>Tunel Wyjście [E]:</strong> Odbiera surowce z Tunelu Wejściowego w tej samej linii.",
  delete: "<strong>Rozbiórka [X]:</strong> Usuwa budynki oraz kruszy skały 🪨 po odblokowaniu Świdrów."
};

window.Factory.makeQuad = function(type, color = 'uncolored') {
  return type ? { type, color } : null;
};

const mq = window.Factory.makeQuad;

window.Factory.LEVELS = [
  {
    lvl: 1,
    title: "Dostarcz Pełne Koła",
    requiredCount: 15,
    targetShape: [mq('circle'), mq('circle'), mq('circle'), mq('circle')],
    unlocks: ['cutter', 'splitter']
  },
  {
    lvl: 2,
    title: "Dostarcz Prawe Połówki Kół",
    requiredCount: 25,
    targetShape: [mq('circle'), mq('circle'), null, null],
    unlocks: ['rotator']
  },
  {
    lvl: 3,
    title: "Dostarcz Górne Połówki Kwadratów",
    requiredCount: 30,
    targetShape: [mq('square'), null, null, mq('square')],
    unlocks: ['merger']
  },
  {
    lvl: 4,
    title: "Dostarcz Hybrydę (Prawa: Kwadrat, Lewa: Koło)",
    requiredCount: 35,
    targetShape: [mq('square'), mq('square'), mq('circle'), mq('circle')],
    unlocks: ['synthesizer']
  },
  {
    lvl: 5,
    title: "Synteza: Dostarcz Gwiazdy (Koło + Kwadrat)",
    requiredCount: 30,
    targetShape: [mq('star'), mq('star'), mq('star'), mq('star')],
    unlocks: ['generator', 'painter']
  },
  {
    lvl: 6,
    title: "Dostarcz Czerwone Gwiazdy",
    requiredCount: 40,
    targetShape: [mq('star', 'red'), mq('star', 'red'), mq('star', 'red'), mq('star', 'red')],
    unlocks: ['mixer', 'tunnel_in', 'tunnel_out']
  },
  {
    lvl: 7,
    title: "Dostarcz Żółte Koła (Czerwony + Zielony)",
    requiredCount: 50,
    targetShape: [mq('circle', 'yellow'), mq('circle', 'yellow'), mq('circle', 'yellow'), mq('circle', 'yellow')],
    unlocks: []
  },
  {
    lvl: 8,
    title: "Dostarcz Złoto-Fioletowy Rdzeń Gwiezdny",
    requiredCount: 60,
    targetShape: [mq('star', 'yellow'), mq('star', 'yellow'), mq('square', 'purple'), mq('square', 'purple')],
    unlocks: []
  }
];