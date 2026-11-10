(function() {
  const {
    GRID_SIZE, DIRS, LEVELS, COLOR_MAP, POWER_RADIUS,
    state, initInitialWorld, saveGame, loadGame, clearGameSave,
    runSimulationTick, isFullShapeOfType, isFoundryInput, isArkFuelShape,
    drawShape, drawDyeDrop, drawWaste, drawRock, drawBuilding, setupInput
  } = window.Factory;

  state.rocks = state.rocks || new Set();
  state.patches = state.patches || new Map();
  state.grid = state.grid || new Map();
  state.beltItems = state.beltItems || [];
  state.hubSize = state.hubSize || 2;
  state.rockDrillUnlocked = Boolean(state.rockDrillUnlocked);
  state.matter = state.matter ?? 200;
  state.steelPlates = state.steelPlates || 0;
  state.energyCells = state.energyCells || 0;
  state.matterPerMinute = state.matterPerMinute || 0;
  state.sciencePerMinute = state.sciencePerMinute || 0;
  state.prestigeCount = state.prestigeCount || 0;
  state.quantumCores = state.quantumCores || 0;

  const BUILDING_COSTS = {
    belt: 1, miner: 15, cutter: 30, rotator: 20, merger: 40,
    painter: 50, mixer: 60, synthesizer: 100, generator: 150,
    splitter: 10, tunnel_in: 25, tunnel_out: 25,
    incinerator: 80, landfill: 20,
    foundry: 120, ark_shipyard: 500
  };

  const TOOL_HINTS = {
    belt: "Kieruje przepływem. Przeciągnij LPM, by budować linię taśmociągu.",
    miner: "Wydobywa surowce ze złoża. Działa 2.5x szybciej w zasięgu prądu ⚡!",
    cutter: "Maszyna 2x1. Wlot w lewy kafel -> wypluwa Lewą połówkę (lewy tor) i Prawą połówkę (prawy tor).",
    rotator: "Obraca dowolny kształt o 90° w prawo.",
    merger: "Maszyna 2x1. Doprowadź połówki do LEWEGO i PRAWEGO wlotu -> wychodzą złączone z lewego toru.",
    painter: "Maszyna 2x1 (Wymaga ⚡). Wlot Lewy: Kształt | Prawy: Barwnik -> Wylot Lewy: Pomalowany kształt | Prawy: Żużel ☣️.",
    mixer: "Maszyna 2x1 (Wymaga ⚡). Wlot Lewy: Barwnik 1 | Prawy: Barwnik 2 -> Wylot Lewy: Wymieszany kolor.",
    synthesizer: "Maszyna 2x1. Wlot Lewy: Koło | Prawy: Kwadrat -> Wylot Lewy: Gwiazda ⭐ | Prawy: Żużel ☣️.",
    generator: "Spala Gwiazdę ⭐, zasilając okoliczne kopalnie i fabryki na 15 sekund (promień 5 pól).",
    splitter: "Maszyna 2x1. Wlot w lewy kafel -> rozdziela 50/50 na lewy i prawy tor wyjściowy.",
    tunnel_in: "Wpuszcza surowce (oraz Żużel) pod ziemię na odległość do 5 pól.",
    tunnel_out: "Odbiera surowce z Tunelu Wejściowego ustawionego w tym samym kierunku.",
    delete: "Zwraca 50% Materii za budynek. Kruszy skały po odblokowaniu Świdrów.",
    incinerator: "Spalarnia [C]: Niszczy toksyczny Żużel ☣️ i generuje z niego prąd ⚡ na 15 sekund!",
    landfill: "Wysypisko [V]: Magazynuje do 100 beczek Żużla ☣️. Podłącz taśmę z przodu, by wypompować odpad do Spalarni.",
    foundry: "Kuźnia 2x1 [F]: Wymaga prądu ⚡! Wlot Lewy: Gwiazda ⭐ | Prawy: Kształt -> Daje +1 🔩 Prefabrykat i wyrzuca Żużel ☣️ prawym torem.",
	ark_shipyard: "Stocznia Arki 3x3 [G] (Koszt: 500 🧱 + 20 🔩): Wymaga prądu ⚡! Podłącz do niej Złoto-Fioletowe Rdzenie Gwiezdne, aby zbudować Arkę!"
  };

  const rebuildHub = window.Factory.rebuildHub || function() {
    const size = state.hubSize || 2;
    for (const [k, cell] of state.grid.entries()) {
      if (cell.type === 'hub') state.grid.delete(k);
    }
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
  window.Factory.rebuildHub = rebuildHub;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const goalCanvas = document.getElementById('goalCanvas');
  const goalCtx = goalCanvas.getContext('2d');

  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '1';

  const uiContainer = document.getElementById('ui');
  if (uiContainer) uiContainer.style.zIndex = '10';
  const toolbarContainer = document.getElementById('toolbar');
  if (toolbarContainer) toolbarContainer.style.zIndex = '10';
  const hintsContainer = document.getElementById('hints');
  if (hintsContainer) hintsContainer.style.zIndex = '10';

  const levelBadge = document.getElementById('levelBadge');
  const goalTitle = document.getElementById('goalTitle');
  const goalProgressFill = document.getElementById('goalProgressFill');
  const goalProgressText = document.getElementById('goalProgressText');
  const scienceDisplay = document.getElementById('scienceDisplay');
  const contextHint = document.getElementById('contextHint');

  if (scienceDisplay && !document.getElementById('matterDisplay')) {
    const matterDiv = document.createElement('div');
    matterDiv.id = 'matterDisplay';
    matterDiv.className = 'science-score';
    matterDiv.style.color = '#3fb950';
    matterDiv.style.marginBottom = '2px';
    scienceDisplay.parentNode.insertBefore(matterDiv, scienceDisplay);
  }
  const matterDisplay = document.getElementById('matterDisplay');
if (scienceDisplay && !document.getElementById('alloyDisplay')) {
  const alloyDiv = document.createElement('div');
  alloyDiv.id = 'alloyDisplay';
  alloyDiv.className = 'science-score';
  alloyDiv.style.color = '#ffa657';
  alloyDiv.style.fontSize = '15px';
  alloyDiv.style.marginBottom = '4px';
  scienceDisplay.parentNode.insertBefore(alloyDiv, scienceDisplay);
}
const alloyDisplay = document.getElementById('alloyDisplay');

  if (scienceDisplay && !document.getElementById('componentsDisplay')) {
    const compDiv = document.createElement('div');
    compDiv.id = 'componentsDisplay';
    compDiv.style.cssText = 'font-size:13px; font-weight:bold; color:#e3b341; margin-bottom:6px; display:flex; gap:12px;';
    scienceDisplay.parentNode.insertBefore(compDiv, scienceDisplay);
  }
  const componentsDisplay = document.getElementById('componentsDisplay');

  if (scienceDisplay && !document.getElementById('prestigeDisplay')) {
    const prestigeDiv = document.createElement('div');
    prestigeDiv.id = 'prestigeDisplay';
    prestigeDiv.style.color = '#58a6ff';
    prestigeDiv.style.fontSize = '14px';
    prestigeDiv.style.fontWeight = 'bold';
    prestigeDiv.style.marginBottom = '6px';
    prestigeDiv.style.display = 'none';
    scienceDisplay.parentNode.insertBefore(prestigeDiv, matterDisplay);
  }
  const prestigeDisplay = document.getElementById('prestigeDisplay');

  const upgBeltBtn = document.getElementById('upgBelt');
  const upgMinerBtn = document.getElementById('upgMiner');
  const upgHubBtn = document.getElementById('upgHub');
  const upgDrillBtn = document.getElementById('upgDrill');
  const beltLvlText = document.getElementById('beltLvl');
  const minerLvlText = document.getElementById('minerLvl');
  const hubLvlText = document.getElementById('hubLvl');
  const drillLvlText = document.getElementById('drillLvl');
  const beltCostText = document.getElementById('beltCost');
  const minerCostText = document.getElementById('minerCost');
  const hubCostText = document.getElementById('hubCost');
  const drillCostText = document.getElementById('drillCost');
  const toolButtons = document.querySelectorAll('.tool-btn');
  const newMapBtn = document.getElementById('newMapBtn');
  const helpBtn = document.getElementById('helpBtn');

  // --- WBUDOWANA ENCYKLOPEDIA FABRYKI (WIKI MODAL) ---
  const wikiModal = document.createElement('div');
  wikiModal.id = 'wikiModal';
  wikiModal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); display: none;
    align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(4px);
  `;
  wikiModal.innerHTML = `
    <div style="background:#161b22; border:1px solid #30363d; border-radius:12px; width:780px; max-width:94%; max-height:86vh; display:flex; flex-direction:column; box-shadow:0 16px 40px rgba(0,0,0,0.85); color:#f0f6fc;">
      <div style="padding:16px 22px; border-bottom:1px solid #30363d; display:flex; justify-content:space-between; align-items:center;">
        <h2 style="font-size:18px; margin:0; color:#58a6ff;">📚 Encyklopedia Inżyniera Fabryki</h2>
        <button id="closeWikiBtn" style="background:transparent; border:none; color:#8b949e; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div style="padding:10px 22px; display:flex; flex-wrap:wrap; gap:8px; border-bottom:1px solid #21262d; background:#0d1117;">
        <button class="wiki-tab-btn active" data-tab="wiki-machines" style="background:#21262d; border:1px solid #58a6ff; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">⚙️ Maszyny 1x1 i 2x1</button>
        <button class="wiki-tab-btn" data-tab="wiki-ark" style="background:transparent; border:1px solid #30363d; color:#8b949e; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">🏭 Kuźnia 2x2 i Arka 3x3</button>
        <button class="wiki-tab-btn" data-tab="wiki-waste" style="background:transparent; border:1px solid #30363d; color:#8b949e; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">☣️ Żużel i Utylizacja</button>
        <button class="wiki-tab-btn" data-tab="wiki-colors" style="background:transparent; border:1px solid #30363d; color:#8b949e; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">🎨 Barwniki RGB i Prąd ⚡</button>
      </div>
      <div style="padding:20px 24px; overflow-y:auto; font-size:13px; line-height:1.6; color:#c9d1d9;">
        
        <div id="wiki-machines" class="wiki-tab-content">
          <h4 style="color:#3fb950; margin:4px 0 6px;">Maszyny Dwuwejściowe / Dwuwyjściowe (2x1):</h4>
          <ul style="padding-left:18px; margin:0 0 14px;">
            <li><b>✂️ Przecinarka [3] (30 🧱):</b> Wlot w lewy kafel. Z lewego wylotu wychodzi Lewa połówka, a z prawego Prawa połówka.</li>
            <li><b>🧩 Monter [5] (40 🧱):</b> Doprowadź dwa fragmenty kształtów do lewego i prawego wlotu. Z lewego wylotu wyjedzie sklejona hybryda.</li>
            <li><b>⚗️ Syntezator [8] (100 🧱):</b> Lewy wlot = Pełne Koło | Prawy = Pełny Kwadrat. Wylot Lewy = Gwiazda ⭐ | Prawy = Żużel ☣️.</li>
            <li><b>🎨 Lakiernia [6] (50 🧱, wymaga ⚡):</b> Lewy wlot = Kształt | Prawy = Barwnik. Wylot Lewy = Pomalowany kształt | Prawy = Żużel ☣️.</li>
            <li><b>🧪 Mieszalnik Barw [7] (60 🧱, wymaga ⚡):</b> Lewy wlot = Barwnik 1 | Prawy = Barwnik 2 -> Wylot Lewy = Wymieszany kolor.</li>
            <li><b>🔀 Rozdzielacz [0] (10 🧱):</b> Wlot w lewy kafel -> rozdziela naprzemiennie 50/50 na lewy i prawy wylot.</li>
          </ul>
        </div>

        <div id="wiki-ark" class="wiki-tab-content" style="display:none;">
          <div style="background:rgba(210,153,34,0.12); border-left:3px solid #d29922; padding:10px 14px; border-radius:4px; margin-bottom:14px;">
            <b>Odejście od Huba – Zewnętrzny Przemysł Ciężki:</b> Od Poziomu 5 odblokowujesz budynki produkujące zaawansowane prefabrykaty potrzebne do opuszczenia planety!
          </div>
          <ul style="padding-left:18px;">
            <li><b>🏭 Kuźnia Komponentów 2x2 [F] (200 🧱, wymaga prądu ⚡):</b>
              <ul>
                <li>Podaj do niej dowolną <b>Hybrydę</b> (np. Koło+Kwadrat z Montera), aby wykuć <b>+1 🔩 Płytę Stalową</b>.</li>
                <li>Podaj do niej kształt zawierający <b>Gwiazdę ⭐</b>, aby wyprodukować <b>+1 🔋 Ogniwo Energetyczne</b> oraz <b>+1 🔩 Płytę Stalową</b>!</li>
                <li>⚠️ Z przodu Kuźni 2x2 wydobywa się <b>Żużel ☣️</b> – musisz podłączyć tam taśmociąg prowadzący do Spalarni lub Wysypiska!</li>
              </ul>
            </li>
            <li style="margin-top:10px;"><b>🚀 Stocznia Arki 3x3 [B] (500 🧱 + 25 🔩 Płyt Stalowych, wymaga prądu ⚡):</b>
              <ul>
                <li>Monumentalny dok konstrukcyjny stawiany na mapie (od Poziomu 8).</li>
                <li>Aby zbudować Arkę (100%), musisz zgromadzić w magazynie <b>30 🔋 Ogniw Energetycznych</b> z Kuźni oraz dostarczyć taśmociągami bezpośrednio do murów Stoczni <b>50x Rdzeni Gwiezdnych (Gwiazd ⭐)</b>.</li>
                <li>Po osiągnięciu 100% na Stoczni odblokuje się przycisk <b>🌌 Wystrzel Arkę (Skok Międzyplanetarny)</b>!</li>
              </ul>
            </li>
          </ul>
        </div>

        <div id="wiki-waste" class="wiki-tab-content" style="display:none;">
          <p><b>☣️ Toksyczny Żużel:</b> Powstaje w <b>Syntezatorze, Lakierni oraz Kuźni 2x2</b>. Żużel ma całkowity zakaz wjazdu do głównego Huba!</p>
          <ul style="padding-left:18px;">
            <li><b>🗑️ Wysypisko [V] (20 🧱):</b> Mieści do 100 beczek Żużla. Nie można go zburzyć <kbd>X</kbd>, dopóki zalega w nim odpad! Aby je opróżnić, postaw taśmociąg przed strzałką wylotową Wysypiska i poprowadź go do Spalarni.</li>
            <li><b>🔥 Spalarnia [C] (80 🧱):</b> Spala Żużel i generuje z każdej beczki <b>15 sekund darmowego prądu ⚡</b>!</li>
          </ul>
        </div>

        <div id="wiki-colors" class="wiki-tab-content" style="display:none;">
          <h4 style="color:#a371f7; margin:0 0 8px;">🧪 Mieszanie Barwników RGB:</h4>
          <ul style="padding-left:18px; margin-bottom:16px;">
            <li>🔴 Czerwony + 🟢 Zielony = 🟡 <b>Żółty</b></li>
            <li>🔴 Czerwony + 🔵 Niebieski = 🟣 <b>Fioletowy</b></li>
            <li>🟢 Zielony + 🔵 Niebieski = 🩵 <b>Morski (Cyan)</b></li>
            <li>🟡 Żółty + 🔵 Niebieski = ⚪ <b>Biały</b></li>
          </ul>
          <h4 style="color:#fadb14; margin:0 0 8px;">⚡ Działanie Prądu:</h4>
          <p>Żółte pole z Generatora [9] lub Spalarni [C] (promień 5 kratek) zasila wymagające prądu maszyny (Lakiernia, Mieszalnik, Syntezator, Kuźnia 2x2, Stocznia Arki 3x3), przyspiesza Ekstraktory <b>2.5x</b> oraz przyspiesza taśmociągi o <b>+50%</b>!</p>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(wikiModal);

  if (helpBtn) {
    helpBtn.innerText = "📚 Encyklopedia";
    helpBtn.style.position = 'fixed';
    helpBtn.style.top = '16px';
    helpBtn.style.right = '16px';
    helpBtn.style.zIndex = '20';
    helpBtn.addEventListener('click', () => { wikiModal.style.display = 'flex'; });
  }

  document.getElementById('closeWikiBtn').addEventListener('click', () => { wikiModal.style.display = 'none'; });
  wikiModal.querySelectorAll('.wiki-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wikiModal.querySelectorAll('.wiki-tab-btn').forEach(b => {
        b.classList.remove('active'); b.style.background = 'transparent'; b.style.borderColor = '#30363d'; b.style.color = '#8b949e';
      });
      wikiModal.querySelectorAll('.wiki-tab-content').forEach(c => { c.style.display = 'none'; });
      btn.classList.add('active'); btn.style.background = '#21262d'; btn.style.borderColor = '#58a6ff'; btn.style.color = '#fff';
      document.getElementById(btn.dataset.tab).style.display = 'block';
    });
  });

  // --- OKIENKO POWIADOMIEŃ LEVEL UP ---
  const levelUpModal = document.createElement('div');
  levelUpModal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.78);
    display: none; align-items: center; justify-content: center; z-index: 180;
  `;
  levelUpModal.innerHTML = `
    <div style="background:#161b22; border:2px solid #58a6ff; border-radius:12px; padding:22px 26px; max-width:500px; width:92%; box-shadow:0 16px 40px rgba(0,0,0,0.85); color:#f0f6fc;">
      <h3 id="lvlUpTitle" style="color:#58a6ff; margin:0 0 12px; font-size:17px;"></h3>
      <div id="lvlUpBody" style="font-size:13px; line-height:1.55; color:#c9d1d9; margin-bottom:18px;"></div>
      <button id="lvlUpClose" style="background:#238636; border:1px solid #3fb950; color:#fff; font-weight:700; padding:9px 18px; border-radius:6px; cursor:pointer; width:100%;">Zrozumiano! Kontynuuj budowę</button>
    </div>
  `;
  document.body.appendChild(levelUpModal);
  document.getElementById('lvlUpClose').addEventListener('click', () => { levelUpModal.style.display = 'none'; });

  const LEVEL_GUIDES = {
    5: {
      title: "🏭 Poziom 5 — Odblokowano: Syntezator, Wysypisko i Kuźnię Komponentów 2x2 [F]!",
      body: `<p>Od teraz możesz stawiać <b>Kuźnie Komponentów 2x2 [F]</b>! Podaj do zasilonej prądem Kuźni Hybrydy (by produkować <b>🔩 Płyty Stalowe</b>) oraz Gwiazdy ⭐ (by produkować <b>🔋 Ogniwa Energetyczne</b> potrzebne później do budowy Stoczni Arki!).</p>`
    },
    8: {
      title: "🚀 Poziom 8 — Finał: Odblokowano Stocznię Arki 3x3 [B]!",
      body: `<p>Oprócz dostarczenia Rdzeni do Bazy możesz teraz wybudować na mapie monumentalną <b>Stocznię Arki 3x3 [B]</b> (wymaga 500 🧱 i 25 🔩 Płyt Stalowych). Zasil ją prądem, zgromadź 30 🔋 Ogniw i doprowadź do niej 50 Gwiazd/Rdzeni, aby odlecieć na nową planetę!</p>`
    }
  };

  upgBeltBtn.addEventListener('click', () => {
    const cost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    if (state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.beltSpeedLvl++; state.beltSpeed = 2.5 + (state.beltSpeedLvl - 1) * 1.0;
      updateUI(); saveGame();
    }
  });

  upgMinerBtn.addEventListener('click', () => {
    const cost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    if (state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.minerSpeedLvl++; state.minerInterval = Math.max(2, 5 - (state.minerSpeedLvl - 1));
      updateUI(); saveGame();
    }
  });

  upgHubBtn.addEventListener('click', () => {
    const cost = state.hubSize === 2 ? 50 : 120;
    if (state.hubSize < 4 && state.sciencePoints >= cost) {
      state.sciencePoints -= cost; state.hubSize++; rebuildHub(); updateUI(); saveGame();
    }
  });

  upgDrillBtn.addEventListener('click', () => {
    if (!state.rockDrillUnlocked && state.sciencePoints >= 40) {
      state.sciencePoints -= 40; state.rockDrillUnlocked = true; updateUI(); saveGame();
    }
  });

  const resetSaveBtn = document.getElementById('resetSaveBtn');
  if (resetSaveBtn) {
    resetSaveBtn.addEventListener('click', () => {
      if (confirm("⚠️ UWAGA! Czy na pewno chcesz skasować cały zapis gry i zacząć od zera?")) clearGameSave();
    });
  }

  const prestigeActionBtn = document.createElement('button');
  prestigeActionBtn.className = 'upgrade-btn';
  prestigeActionBtn.style.borderColor = '#3fb950';
  prestigeActionBtn.style.color = '#3fb950';
  prestigeActionBtn.style.display = 'none';
  prestigeActionBtn.innerHTML = `<span>🚀 Wystrzel Arkę (Skok)</span><span>100% Gotowe!</span>`;
  document.querySelector('.upgrade-list').prepend(prestigeActionBtn);

  prestigeActionBtn.addEventListener('click', () => {
    if (confirm("🚀 ARKA GOTOWA DO STARTU!\nOpuszczenie planety zresetuje mapę i budynki, ale zdobędziesz +1 Rdzeń Kwantowy (+25% prędkości wydobycia, komponentów i zysków). Wystrzelić Arkę?")) {
      state.quantumCores++;
      state.prestigeCount++;
      state.matter = 200;
      state.steelPlates = 0;
      state.energyCells = 0;
      state.currentLvlIndex = 0;
      state.currentLvlProgress = 0;
      state.beltItems = [];
      state.grid.clear();
      initInitialWorld(Math.floor(Math.random() * 1000000));
      rebuildHub();
      saveGame();
      updateUI();
    }
  });

  function calculateOfflineProgress() {
    const now = Date.now();
    const lastTime = state.lastSaveTime || now;
    const diffMinutes = Math.floor((now - lastTime) / 60000);
    if (diffMinutes > 3 && (state.matterPerMinute > 0 || state.sciencePerMinute > 0)) {
      const effective = Math.min(diffMinutes, 24 * 60);
      state.matter += effective * (state.matterPerMinute || 0);
      state.sciencePoints += effective * (state.sciencePerMinute || 0);
    }
    state.lastSaveTime = now;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  state.camera.x = canvas.width / 2;
  state.camera.y = canvas.height / 2;

  if (!loadGame()) initInitialWorld();
  rebuildHub();
  calculateOfflineProgress();

  if (newMapBtn) {
    newMapBtn.addEventListener('click', () => {
      if (confirm("Nowa mapa? Znikną budynki, technologia zostaje.")) {
        initInitialWorld(Math.floor(Math.random() * 1000000));
        rebuildHub();
        saveGame();
        updateUI();
      }
    });
  }

  function isArkComplete() {
    let arkBuilding = null;
    for (const [, b] of state.grid.entries()) {
      if (b.type === 'ark') { arkBuilding = b; break; }
    }
    if (!arkBuilding) return false;
    return (arkBuilding.arkCoresDelivered || 0) >= 50 && (state.energyCells || 0) >= 30;
  }

  function canEnterMachine(nextCell, item) {
    if (!nextCell) return false;

    if (item.isWaste) {
      if (nextCell.type === 'belt') return true;
      if (nextCell.type === 'incinerator') return true;
      if (nextCell.type === 'landfill') return (nextCell.storedWaste || 0) < 100;
      if (nextCell.type === 'splitter') return !nextCell.storedItem;
      if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye && !nextCell.hasWasteStored;
      return false;
    }

    if (nextCell.type === 'belt' || nextCell.type === 'hub') return true;

    // KUŹNIA KOMPONENTÓW 2x2 (dowolny z 4 kafelków przyjmuje Hybrydy i Gwiazdy)
    if (nextCell.type === 'foundry' || nextCell.type === 'foundry_sec') {
      const main = nextCell.type === 'foundry' ? nextCell : state.grid.get(nextCell.partnerKey);
      if (!main || item.isDye) return false;
      return !main.storedShape && isFoundryInput(item.shape);
    }

    // STOCZNIA ARKI 3x3 (dowolny z 9 kafelków przyjmuje Gwiazdy/Rdzenie Gwiezdne pod prądem)
    if (nextCell.type === 'ark' || nextCell.type === 'ark_sec') {
      const main = nextCell.type === 'ark' ? nextCell : state.grid.get(nextCell.partnerKey);
      if (!main || !main.isPowered || item.isDye) return false;
      return (main.arkCoresDelivered || 0) < 50 && isArkFuelShape(item.shape);
    }

    if (nextCell.type === 'cutter') return !item.isDye && !nextCell.storedShape;
    if (nextCell.type === 'rotator') return !item.isDye && !nextCell.storedShape;

    if (nextCell.type === 'merger') return !item.isDye && !nextCell.storedLeft;
    if (nextCell.type === 'merger_sec') {
      const main = state.grid.get(nextCell.partnerKey);
      return main && !item.isDye && !main.storedRight;
    }

    if (nextCell.type === 'synthesizer') return !item.isDye && isFullShapeOfType(item.shape, 'circle') && !nextCell.storedLeft;
    if (nextCell.type === 'synthesizer_sec') {
      const main = state.grid.get(nextCell.partnerKey);
      return main && !item.isDye && isFullShapeOfType(item.shape, 'square') && !main.storedRight;
    }

    if (nextCell.type === 'painter') return !item.isDye && !nextCell.storedLeft;
    if (nextCell.type === 'painter_sec') {
      const main = state.grid.get(nextCell.partnerKey);
      return main && item.isDye && !main.storedRight;
    }

    if (nextCell.type === 'mixer') return item.isDye && !nextCell.storedLeft;
    if (nextCell.type === 'mixer_sec') {
      const main = state.grid.get(nextCell.partnerKey);
      return main && item.isDye && !main.storedRight;
    }

    if (nextCell.type === 'generator') return isFullShapeOfType(item.shape, 'star') && (nextCell.fuelTimer || 0) < 100;
    if (nextCell.type === 'splitter') return !nextCell.storedItem;
    if (nextCell.type === 'splitter_sec') return false;

    if (nextCell.type === 'tunnel_in') return !nextCell.storedShape && !nextCell.storedDye && !nextCell.hasWasteStored;
    return false;
    
    // Stocznia Arki 3x3 przyjmuje dowolne kształty (byle nie barwnik i nie żużel)
    if (nextCell.type === 'ark_shipyard' || nextCell.type === 'ark_shipyard_sec') {
      return !item.isDye && !item.isWaste;
    }
    // Kuźnia 2x1: lewy kafel przyjmuje Gwiazdę, prawy (_sec) dowolny kształt
    if (nextCell.type === 'foundry') {
      return !item.isDye && !item.isWaste && isFullShapeOfType(item.shape, 'star') && !nextCell.storedLeft;
    }
    if (nextCell.type === 'foundry_sec') {
      const main = state.grid.get(nextCell.partnerKey);
      return main && !item.isDye && !item.isWaste && !main.storedRight;
    }
  }

  function updateUI() {
    const current = LEVELS[state.currentLvlIndex] || LEVELS[LEVELS.length - 1];

    levelBadge.innerText = `POZIOM ${current.lvl}`;
    goalTitle.innerText = current.title;
    goalProgressText.innerText = `${state.currentLvlProgress} / ${current.requiredCount}`;
    goalProgressFill.style.width = `${Math.min(100, (state.currentLvlProgress / current.requiredCount) * 100)}%`;
    goalCtx.clearRect(0, 0, 42, 42);
    drawShape(goalCtx, 21, 21, current.targetShape, 26);

    LEVELS.forEach((lvl, idx) => {
      if (idx < state.currentLvlIndex) {
        lvl.unlocks.forEach(t => {
          const btn = document.getElementById(`tool-${t}`);
          if (btn) {
            btn.disabled = false;
            const sc = btn.querySelector('.shortcut');
            if (sc) sc.innerText = sc.innerText.replace(' 🔒', '');
          }
        });
      }
    });

    if (state.currentLvlIndex >= 4) {
      const lfBtn = document.getElementById('tool-landfill');
      if (lfBtn) { lfBtn.disabled = false; const sc = lfBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[V]'; }
      const fnBtn = document.getElementById('tool-foundry');
      if (fnBtn) { fnBtn.disabled = false; const sc = fnBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[F]'; }
    }
    if (state.currentLvlIndex >= 5) {
      const incBtn = document.getElementById('tool-incinerator');
      if (incBtn) { incBtn.disabled = false; const sc = incBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[C]'; }
    }
    if (state.currentLvlIndex >= 7) {
      const arkBtn = document.getElementById('tool-ark');
      if (arkBtn) { arkBtn.disabled = false; const sc = arkBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[B]'; }
    }

    scienceDisplay.innerText = `${state.sciencePoints} ⚙`;
    if (matterDisplay) matterDisplay.innerText = `${Math.floor(state.matter)} 🧱 Materii`;
    if (componentsDisplay) {
      componentsDisplay.innerHTML = `<span>🔩 Stal: ${state.steelPlates || 0}</span><span>🔋 Ogniwa: ${state.energyCells || 0}</span>`;
    }

    if (state.quantumCores > 0) {
      prestigeDisplay.style.display = 'block';
      prestigeDisplay.innerText = `🌌 Rdzenie Kwantowe: ${state.quantumCores} (+${state.quantumCores * 25}% Zysków)`;
    }

    if (isArkComplete()) {
      prestigeActionBtn.style.display = 'flex';
    } else {
      prestigeActionBtn.style.display = 'none';
    }

    const bCost = Math.round(20 * Math.pow(1.7, state.beltSpeedLvl - 1));
    beltCostText.innerText = `${bCost} ⚙`;
    beltLvlText.innerText = `(Poz. ${state.beltSpeedLvl})`;
    upgBeltBtn.disabled = state.sciencePoints < bCost;

    const mCost = Math.round(25 * Math.pow(1.7, state.minerSpeedLvl - 1));
    minerCostText.innerText = `${mCost} ⚙`;
    minerLvlText.innerText = `(Poz. ${state.minerSpeedLvl})`;
    upgMinerBtn.disabled = state.sciencePoints < mCost;

    if (state.hubSize >= 4) {
      hubLvlText.innerText = `(4x4 MAX)`;
      hubCostText.innerText = `MAX`;
      upgHubBtn.disabled = true;
    } else {
      const hCost = state.hubSize === 2 ? 50 : 120;
      hubLvlText.innerText = `(${state.hubSize}x${state.hubSize} -> ${state.hubSize + 1}x${state.hubSize + 1})`;
      hubCostText.innerText = `${hCost} ⚙`;
      upgHubBtn.disabled = state.sciencePoints < hCost;
    }

    if (state.rockDrillUnlocked) {
      drillLvlText.innerText = `(Aktywne)`;
      drillCostText.innerText = `OK`;
      upgDrillBtn.disabled = true;
    } else {
      drillLvlText.innerText = `(Zablok.)`;
      drillCostText.innerText = `40 ⚙`;
      upgDrillBtn.disabled = state.sciencePoints < 40;
    }
	if (alloyDisplay) alloyDisplay.innerText = `${state.alloyPlates || 0} 🔩 Prefabrykatów`;

    if (state.currentLvlIndex >= 6) {
      const fBtn = document.getElementById('tool-foundry');
      if (fBtn) { fBtn.disabled = false; const sc = fBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[F]'; }
    }
    if (state.currentLvlIndex >= 7) {
      const aBtn = document.getElementById('tool-ark_shipyard');
      if (aBtn) { aBtn.disabled = false; const sc = aBtn.querySelector('.shortcut'); if (sc) sc.innerText = '[G]'; }
    }
  }

  function selectTool(name) {
    const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
    if (btn && !btn.disabled) {
      state.currentTool = name;
      toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      const cost = BUILDING_COSTS[name] || 0;
      const extraCost = name === 'ark' ? ' + 25 🔩' : '';
      const costBadge = cost > 0
        ? `<div style="display:inline-block; background:rgba(63, 185, 80, 0.2); border: 1px solid #3fb950; color:#3fb950; padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:8px;">KOSZT: ${cost} 🧱${extraCost}</div>`
        : '';
      if (TOOL_HINTS[name]) contextHint.innerHTML = costBadge + TOOL_HINTS[name];
    }
  }

  toolButtons.forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));
  const input = setupInput(canvas, selectTool);

  let matterGainedThisMinute = 0;
  let scienceGainedThisMinute = 0;
  setInterval(() => {
    state.matterPerMinute = matterGainedThisMinute;
    state.sciencePerMinute = scienceGainedThisMinute;
    matterGainedThisMinute = 0;
    scienceGainedThisMinute = 0;
  }, 60000);

  setInterval(() => {
    runSimulationTick((m, s) => {
      if (m > 0) { state.matter += m; matterGainedThisMinute += m; }
      if (s > 0) { state.sciencePoints += s; scienceGainedThisMinute += s; }
      updateUI();
    }, (finishedLvl, nextLvl) => {
      updateUI();
      saveGame();
      if (nextLvl && LEVEL_GUIDES[nextLvl.lvl]) {
        const g = LEVEL_GUIDES[nextLvl.lvl];
        document.getElementById('lvlUpTitle').innerHTML = g.title;
        document.getElementById('lvlUpBody').innerHTML = g.body;
        levelUpModal.style.display = 'flex';
      }
    });
  }, 100);

  setInterval(() => saveGame(), 5000);
  window.addEventListener('beforeunload', () => saveGame());

  let lastTime = performance.now();
  function render(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    for (let i = state.beltItems.length - 1; i >= 0; i--) {
      const item = state.beltItems[i];
      const cell = state.grid.get(`${item.curX},${item.curY}`);
      if (!cell) { state.beltItems.splice(i, 1); continue; }

      const speedBoost = (cell.isPowered ? 1.5 : 1.0);
      item.progress += dt * state.beltSpeed * speedBoost;
      if (item.progress >= 1.0) {
        if (cell.type === 'incinerator' && item.isWaste) {
          cell.fuelTimer = 150;
          state.beltItems.splice(i, 1); continue;
        }
        if (cell.type === 'landfill' && item.isWaste) {
          cell.storedWaste = (cell.storedWaste || 0) + 1;
          state.beltItems.splice(i, 1); continue;
        }

        // KUŹNIA 2x2
        if ((cell.type === 'foundry' || cell.type === 'foundry_sec') && !item.isDye && !item.isWaste) {
          const main = cell.type === 'foundry' ? cell : state.grid.get(cell.partnerKey);
          if (main && !main.storedShape && isFoundryInput(item.shape)) {
            main.storedShape = item.shape;
            state.beltItems.splice(i, 1); continue;
          }
        }

        // STOCZNIA ARKI 3x3
        if ((cell.type === 'ark' || cell.type === 'ark_sec') && !item.isDye && !item.isWaste) {
          const main = cell.type === 'ark' ? cell : state.grid.get(cell.partnerKey);
          if (main && main.isPowered && (main.arkCoresDelivered || 0) < 50 && isArkFuelShape(item.shape)) {
            main.arkCoresDelivered = (main.arkCoresDelivered || 0) + 1;
            state.beltItems.splice(i, 1);
            updateUI();
            continue;
          }
        }

        if (cell.type === 'cutter' && !item.isDye && !item.isWaste && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }
        if (cell.type === 'rotator' && !item.isDye && !item.isWaste && !cell.storedShape) { cell.storedShape = item.shape; state.beltItems.splice(i, 1); continue; }

        if (['merger', 'painter', 'mixer', 'synthesizer', 'foundry'].includes(cell.type)) {
          if (!cell.storedLeft && !item.isWaste) {
            if (cell.type === 'mixer' && item.isDye) cell.storedLeft = item.dyeColor;
            else if (cell.type === 'painter' && !item.isDye) cell.storedLeft = item.shape;
            else if (cell.type === 'synthesizer' && !item.isDye && isFullShapeOfType(item.shape, 'circle')) cell.storedLeft = item.shape;
            else if (cell.type === 'foundry' && !item.isDye && isFullShapeOfType(item.shape, 'star')) cell.storedLeft = item.shape;
            else if (cell.type === 'merger' && !item.isDye) cell.storedLeft = item.shape;
            else continue;
            state.beltItems.splice(i, 1); continue;
          }
        }

        if (['merger_sec', 'painter_sec', 'mixer_sec', 'synthesizer_sec', 'foundry_sec'].includes(cell.type)) {
          const main = state.grid.get(cell.partnerKey);
          if (main && !main.storedRight && !item.isWaste) {
            const baseType = main.type;
            if (baseType === 'mixer' && item.isDye) main.storedRight = item.dyeColor;
            else if (baseType === 'painter' && item.isDye) main.storedRight = item.dyeColor;
            else if (baseType === 'synthesizer' && !item.isDye && isFullShapeOfType(item.shape, 'square')) main.storedRight = item.shape;
            else if (baseType === 'foundry' && !item.isDye) main.storedRight = item.shape;
            else if (baseType === 'merger' && !item.isDye) main.storedRight = item.shape;
            else continue;
            state.beltItems.splice(i, 1); continue;
          }
        }

        if (cell.type === 'generator' && !item.isDye && !item.isWaste) {
          if (isFullShapeOfType(item.shape, 'star')) { cell.fuelTimer = 150; state.beltItems.splice(i, 1); continue; }
        }
        if (cell.type === 'splitter' && !cell.storedItem) {
          cell.storedItem = { isDye: item.isDye, isWaste: item.isWaste, dyeColor: item.dyeColor, shape: item.shape };
          state.beltItems.splice(i, 1); continue;
        }

         if (cell.type === 'tunnel_in' && !cell.storedShape && !cell.storedDye && !cell.hasWasteStored) {
          if (item.isWaste) cell.hasWasteStored = true;
          else if (item.isDye) cell.storedDye = item.dyeColor;
          else cell.storedShape = item.shape;
          state.beltItems.splice(i, 1); continue;
        }

        if (cell.type === 'belt') {
          const dir = DIRS[cell.rot] || DIRS[0];
          const nx = item.curX + dir.x;
          const ny = item.curY + dir.y;
          const nextCell = state.grid.get(`${nx},${ny}`);
          const occupied = state.beltItems.some(o => o !== item && o.curX === nx && o.curY === ny);
          if (!occupied && canEnterMachine(nextCell, item)) {
            item.curX = nx; item.curY = ny; item.progress = 0;
          } else {
            item.progress = 1.0;
          }
        }
      }
    }

    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(state.camera.x, state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    const startCol = Math.floor((-state.camera.x / state.camera.zoom) / GRID_SIZE) - 1;
    const endCol = startCol + Math.ceil(canvas.width / state.camera.zoom / GRID_SIZE) + 2;
    const startRow = Math.floor((-state.camera.y / state.camera.zoom) / GRID_SIZE) - 1;
    const endRow = startRow + Math.ceil(canvas.height / state.camera.zoom / GRID_SIZE) + 2;

    for (let x = startCol; x <= endCol; x++) {
      for (let y = startRow; y <= endRow; y++) {
        const patch = state.patches.get(`${x},${y}`);
        if (patch) {
          const px = x * GRID_SIZE, py = y * GRID_SIZE;
          ctx.fillStyle = '#151b26';
          ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);
          if (patch.kind === 'shape') {
            ctx.fillStyle = 'rgba(158, 167, 179, 0.35)';
            if (patch.subType === 'circle') {
              ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.32, 0, Math.PI * 2); ctx.fill();
            } else {
              const sz = GRID_SIZE * 0.55;
              ctx.fillRect(px + (GRID_SIZE - sz) / 2, py + (GRID_SIZE - sz) / 2, sz, sz);
            }
          } else if (patch.kind === 'dye') {
            ctx.fillStyle = COLOR_MAP[patch.subType] || '#ff4d4f';
            ctx.globalAlpha = 0.45;
            ctx.beginPath(); ctx.arc(px + GRID_SIZE / 2, py + GRID_SIZE / 2, GRID_SIZE * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }
      }
    }

    ctx.strokeStyle = '#19202b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) { ctx.moveTo(x * GRID_SIZE, startRow * GRID_SIZE); ctx.lineTo(x * GRID_SIZE, endRow * GRID_SIZE); }
    for (let y = startRow; y <= endRow; y++) { ctx.moveTo(startCol * GRID_SIZE, y * GRID_SIZE); ctx.lineTo(endCol * GRID_SIZE, y * GRID_SIZE); }
    ctx.stroke();

    if (state.rocks) {
      for (let x = startCol; x <= endCol; x++) {
        for (let y = startRow; y <= endRow; y++) {
          if (state.rocks.has(`${x},${y}`)) drawRock(ctx, x, y);
        }
      }
    }

    state.grid.forEach(b => {
      if ((b.type === 'generator' || b.type === 'incinerator') && (b.fuelTimer || 0) > 0) {
        ctx.fillStyle = 'rgba(250, 219, 20, 0.08)';
        ctx.strokeStyle = 'rgba(250, 219, 20, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2, POWER_RADIUS * GRID_SIZE, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    });

    state.grid.forEach(b => {
      if (b.type === 'tunnel_in') {
        const dir = DIRS[b.rot];
        for (let dist = 1; dist <= 5; dist++) {
          const tx = b.x + dir.x * dist, ty = b.y + dir.y * dist;
          const target = state.grid.get(`${tx},${ty}`);
          if (target && target.type === 'tunnel_out' && target.rot === b.rot) {
            ctx.strokeStyle = '#bf94ff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(b.x * GRID_SIZE + GRID_SIZE / 2, b.y * GRID_SIZE + GRID_SIZE / 2);
            ctx.lineTo(tx * GRID_SIZE + GRID_SIZE / 2, ty * GRID_SIZE + GRID_SIZE / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            break;
          }
        }
      }
    });

    state.grid.forEach(b => drawBuilding(ctx, b.x, b.y, b.type, b.rot, 1.0, b));

    const preview = input.getDragPreview();
    if (preview) {
      preview.forEach(node => {
        const afford = state.matter >= BUILDING_COSTS['belt'];
        ctx.strokeStyle = afford ? '' : '#f85149';
        drawBuilding(ctx, node.x, node.y, 'belt', node.rot, afford ? 0.45 : 0.7);
      });
    } else if (input.getHoverTile) {
      const hover = input.getHoverTile();
      if (hover) {
        if (state.currentTool === 'delete') {
          ctx.strokeStyle = '#f85149';
          ctx.lineWidth = 2;
          ctx.strokeRect(hover.x * GRID_SIZE + 2, hover.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        } else {
          const cost = BUILDING_COSTS[state.currentTool] || 0;
          const afford = state.matter >= cost;
          if (!afford) {
            ctx.fillStyle = 'rgba(248, 81, 73, 0.3)';
            ctx.fillRect(hover.x * GRID_SIZE, hover.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
          }
          drawBuilding(ctx, hover.x, hover.y, state.currentTool, state.currentRotation, afford ? 0.42 : 0.2);
        }
      }
    }

    state.beltItems.forEach(item => {
      const cell = state.grid.get(`${item.curX},${item.curY}`);
      let px = item.curX * GRID_SIZE + GRID_SIZE / 2, py = item.curY * GRID_SIZE + GRID_SIZE / 2;
      if (cell && cell.type === 'belt') {
        const dir = DIRS[cell.rot] || DIRS[0];
        px += dir.x * (item.progress - 0.5) * GRID_SIZE;
        py += dir.y * (item.progress - 0.5) * GRID_SIZE;
      }

      if (item.isWaste) drawWaste(ctx, px, py, GRID_SIZE * 0.4);
      else if (item.isDye) drawDyeDrop(ctx, px, py, item.dyeColor, GRID_SIZE * 0.4);
      else drawShape(ctx, px, py, item.shape, GRID_SIZE * 0.38);
    });

    ctx.restore();
    requestAnimationFrame(render);
  }
  updateUI();
  requestAnimationFrame(render);
})();