#!/usr/bin/env node
// scripts/calcEffectiveRating.js

const fs   = require('fs');
const path = require('path');

const PLAYERS_DIR       = path.join(__dirname, '..', 'data', 'players');
const TOURNAMENTS_FILE  = path.join(__dirname, '..', 'data', 'tournaments.json');
const SNAPSHOT_DIR      = path.join(__dirname, '..', 'data', 'ratingSnapshots');

// Параметры алгоритма
const w           = 3,   N = 5,   W = 5,   M = 10;
const C           = 10,  betaL0 = 0.5, betaS0 = 0.3;
const Svol        = 10,  skipPenalty = 0.95, AI = 1;
const soloPlace   = {1:100,2:90,3:75,4:65,5:50,6:40};
const teamPlace   = {1:100,2:75,3:50,4:25,5:20};
const defaultSolo = 25,  defaultTeam = 15;

// Вспомогательные
const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const std  = (arr, avg) => {
  if (!arr.length) return 0;
  const m = avg != null ? avg : mean(arr);
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/arr.length);
};
const getP  = (place, kills, scale, def) => {
  if (place == null) return null;
  const base = scale[place] != null ? scale[place] : def;
  return base + w*(kills||0);
};

(async()=>{
  // 1) Загрузим турниры, пропускаем отменённые и отсортируем
  const tours = JSON.parse(fs.readFileSync(TOURNAMENTS_FILE,'utf-8'))
    .filter(t =>
      t.state !== 'Турнир отменен' &&
      !t.id.toLowerCase().includes('test') &&    // <-- исключаем все id с "test"
      t.id !== 'HotDrop'  // <-- исключаем Hot Drop из расчета рейтинга
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastTournamentId   = tours[tours.length-1].id;
  const lastTournamentDate = tours[tours.length-1].date;

  // 2) Подготовим снапшот для последнего турнира
  const snapshot = [];

  // 3) Обрабатываем каждого игрока
  const files = fs.readdirSync(PLAYERS_DIR).filter(f=>f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(PLAYERS_DIR, file);
    const profile  = JSON.parse(fs.readFileSync(filePath,'utf-8'));
    const hist     = profile.history || [];

    // 4) Запомним старый рейтинг (до пересчёта)
    const oldRating = profile.effectiveRating != null
      ? profile.effectiveRating
      : (profile.rating != null ? profile.rating : 0);

    // 5) Собираем events[]: P для каждого турнира
    const events = tours.map(t => {
      const rec = hist.find(h=>h.tournamentId===t.id);
      if (!rec || rec.place==='Турнир ещё идёт') return null;
      const kills = Number(rec.personalKills) || 0;
      const scale = t.type==='solo' ? soloPlace : teamPlace;
      const def   = t.type==='solo' ? defaultSolo : defaultTeam;
      return getP(rec.place, kills, scale, def);
    });

    // 6) Калибровка firstP → longAnchor
    const firstP = [];
    for (const p of events) {
      if (p != null) firstP.push(p);
      if (firstP.length >= N) break;
    }
    const longAnchor    = mean(firstP);
    const isCalibrating = firstP.length < N;
    profile.calibrating = isCalibrating;
    profile.longAnchor  = parseFloat(longAnchor.toFixed(2));

    // 7) Если калибруется — effectiveRating = longAnchor
    let rating = longAnchor;
    if (isCalibrating) {
      profile.effectiveRating = parseFloat(rating.toFixed(2));
      console.log(`🔧 ${profile.name}: calibrating (${firstP.length}/${N}) → ${rating.toFixed(2)}`);
    } else {
      // 8) Пересчёт после калибровки
      let histP   = [...firstP];
      let realCnt = firstP.length;
      for (let i = 0; i < events.length; i++) {
        const p = events[i];
        if (histP.length < N) {
          if (p != null) histP.push(p);
          continue;
        }
        if (p == null) {
          rating *= skipPenalty;
        } else {
          histP.push(p);
          realCnt++;
          const lastW = histP.slice(-W);
          const Wavg  = mean(lastW);
          const sigma = std(lastW, Wavg);
          const phi   = 1/(1 + sigma/Svol);
          const mUse  = Math.min(realCnt - N, M);
          const shortA = mUse>0 ? mean(histP.slice(-mUse)) : longAnchor;
          const gammaL = (mUse/(mUse+C))*betaL0;
          const gammaS = (mUse/(mUse+C))*betaS0;
          rating = AI * (
            phi*(gammaL*longAnchor + gammaS*shortA)
            + (1-phi)*Wavg
          );
        }
      }
      profile.effectiveRating = parseFloat(rating.toFixed(2));
      console.log(`🎯 ${profile.name}: recalculated → ${rating.toFixed(2)}`);
    }

    // 9) Обновляем поля в history для последнего турнира
    profile.history = hist.map(entry => {
      if (entry.tournamentId !== lastTournamentId) return entry;
      return {
        ...entry,
        oldRating: oldRating,
        newRating: profile.effectiveRating
      };
    });

    // 10) Сохраняем профиль
    fs.writeFileSync(filePath, JSON.stringify(profile,null,2),'utf-8');

    // 11) Добавляем в снапшот
    snapshot.push({
      player: profile.name,
      ratingBefore: oldRating,
      ratingAfter: profile.effectiveRating
    });
  }

  // 12) Записываем снапшот
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
  const snapPath = path.join(SNAPSHOT_DIR, `${lastTournamentId}.json`);
  fs.writeFileSync(snapPath, JSON.stringify(snapshot,null,2),'utf-8');
  console.log(`💾 Snapshot written: ${snapPath}`);

  console.log('🎉 Пересчёт рейтингов и обновление history завершены.');
})();
