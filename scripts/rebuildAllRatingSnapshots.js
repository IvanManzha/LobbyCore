#!/usr/bin/env node
// scripts/rebuildAllRatingSnapshots.js

const fs   = require('fs');
const path = require('path');

const PLAYERS_DIR      = path.join(__dirname, '..', 'data', 'players');
const TOURNAMENTS_FILE = path.join(__dirname, '..', 'data', 'tournaments.json');
const SNAPSHOT_DIR     = path.join(__dirname, '..', 'data', 'ratingSnapshots');

// Помощники
const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const std  = (arr, avg) => {
  if (!arr.length) return 0;
  const m = avg != null ? avg : mean(arr);
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/arr.length);
};
const getP = (place, kills, scale, def, w=3) => {
  if (place == null) return null;
  const base = scale[place] != null ? scale[place] : def;
  return base + w*(kills||0);
};

// Параметры рейтинга
const w       = 3, N = 5, W = 5, M = 10, C = 10;
const betaL0  = 0.5, betaS0 = 0.3, Svol = 10, skipPenalty = 0.95, AI = 1;
const soloPlace = {1:100,2:90,3:75,4:65,5:50,6:40};
const teamPlace = {1:100,2:75,3:50,4:25,5:20};
const defSolo   = 25, defTeam = 15;

(async () => {
  // 1) Загрузить и отсортировать только реально завершённые турниры без "test" в id
  const tournaments = JSON.parse(fs.readFileSync(TOURNAMENTS_FILE,'utf-8'))
    .filter(t =>
      t.state === 'Турнир окончен' &&
      !t.id.toLowerCase().includes('test') &&
      t.id !== 'HotDrop'  // <-- исключаем Hot Drop из расчета рейтинга
    )
    .sort((a,b)=>new Date(a.date) - new Date(b.date));

  // 2) Очистить старые снапшоты
  if (fs.existsSync(SNAPSHOT_DIR)) {
    fs.readdirSync(SNAPSHOT_DIR).forEach(f =>
      fs.unlinkSync(path.join(SNAPSHOT_DIR, f))
    );
  } else {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  // 3) Загрузить все профили (не изменяем их здесь)
  const files = fs.readdirSync(PLAYERS_DIR).filter(f=>f.endsWith('.json'));
  const profiles = {};
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(PLAYERS_DIR,f),'utf-8'));
    p.history = Array.isArray(p.history) ? p.history : [];
    profiles[p.name] = p;
  }

  // 4) Для каждого турнира собираем снимок
  for (const tour of tournaments) {
    console.log(`\n--- Building snapshot for ${tour.id} (${tour.date}) ---`);

    // 4.1) Собираем P-значения по истории до и включая этот тур
    const events = {};
    tournaments
      .filter(t => new Date(t.date) <= new Date(tour.date))
      .forEach(t => {
        const tablePath = path.join(__dirname,'..','data','tournaments',t.id,'table.json');
        if (!fs.existsSync(tablePath)) return;
        const table = JSON.parse(fs.readFileSync(tablePath,'utf-8'));
        table.teams.forEach(team => {
          const players = t.type==='solo' ? [team.name] : team.players || [];
          players.forEach(pl => {
            const rec = profiles[pl].history.find(h=>h.tournamentId===t.id);
            if (!rec || rec.place==='Турнир ещё идёт') return;
            const kills = Number(rec.personalKills) || 0;
            const scale = t.type==='solo' ? soloPlace : teamPlace;
            const def   = t.type==='solo' ? defSolo   : defTeam;
            const P = getP(rec.place, kills, scale, def, w);
            events[pl] = events[pl] || [];
            events[pl].push(P);
          });
        });
      });

    // 4.2) Считаем для каждого игрока «сырое» значение рейтинга и формируем массив
    const rawSnapshot = [];
    for (const [name, p] of Object.entries(profiles)) {
      const ev = events[name] || [];
      const firstVals = ev.slice(0, N).filter(x=>x!=null);
      const longA = mean(firstVals);
      let rating = longA;

      if (firstVals.length >= N) {
        let histP = [...firstVals];
        ev.slice(N).forEach(P => {
          if (P == null) {
            rating *= skipPenalty;
          } else {
            histP.push(P);
            const lastW  = histP.slice(-W);
            const Wavg   = mean(lastW);
            const sigma  = std(lastW, Wavg);
            const phi    = 1/(1 + sigma/Svol);
            const realCnt= histP.length;
            const mUse   = Math.min(realCnt - N, M);
            const shortA = mUse>0 ? mean(histP.slice(-mUse)) : longA;
            const gammaL = (mUse/(mUse+C))*betaL0;
            const gammaS = (mUse/(mUse+C))*betaS0;
            rating = AI*(phi*(gammaL*longA+gammaS*shortA) + (1-phi)*Wavg);
          }
        });
      }

      // старый рейтинг — тот, что был в истории именно для этого тура
      const histEntry = profiles[name].history.find(h=>h.tournamentId===tour.id);
      const oldRating = histEntry?.oldRating ?? p.effectiveRating ?? 0;

      rawSnapshot.push({
        player:       name,
        ratingBefore: oldRating,
        ratingAfter:  parseFloat(rating.toFixed(2))
      });
    }

    // 4.3) Формируем и сохраняем снапшот для текущего турнира
  {
    // находим индекс текущего турнира в отсортированном списке
    const idx = tournaments.findIndex(t => t.id === tour.id);

    // если это не первый турнир, подгружаем предыдущий снапшот
    let prevMap = {};
    if (idx > 0) {
      const prevId       = tournaments[idx - 1].id;
      const prevSnapPath = path.join(SNAPSHOT_DIR, `${prevId}.json`);
      if (fs.existsSync(prevSnapPath)) {
        const prevSnap = JSON.parse(fs.readFileSync(prevSnapPath, 'utf-8'));
        // строим map: player → ratingAfter
        prevMap = Object.fromEntries(
          prevSnap.map(r => [r.player, r.ratingAfter])
        );
      }
    }

    // для каждого raw-рейтингa подставляем oldRating из prevMap (или 0)
    const finalSnapshot = rawSnapshot
      .map(r => {
        const oldR = idx > 0
          ? (prevMap[r.player] != null ? prevMap[r.player] : 0)
          : 0;
        return {
          player:       r.player,
          ratingBefore: oldR,
          ratingAfter:  r.ratingAfter
        };
      })


    // сохраняем в файл
    const outPath = path.join(SNAPSHOT_DIR, `${tour.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(finalSnapshot, null, 2), 'utf-8');
    console.log(`→ Snapshot saved: ${path.basename(outPath)} (${finalSnapshot.length} changes)`);
  }
  }

  console.log('\n✅ All snapshots rebuilt (only non-zero changes).');
})();
