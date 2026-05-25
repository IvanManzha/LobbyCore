// scripts/db_scripts/updateProfiles.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { db } = require('../../lib/db');
const { upsertProfileStats, getProfile } = require('/lib/profileDb');

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

async function main() {
  const tournamentId = process.argv[2];
  if (!tournamentId) {
    console.error('Usage: node updateProfiles.js <tournamentId>');
    process.exit(1);
  }

  // --- 0) Загрузим список турниров из файла, отсортируем по дате
  const toursFile = path.join(__dirname, '..', '..', 'data', 'tournaments.json');
  const tours = JSON.parse(fs.readFileSync(toursFile, 'utf8'))
    .filter(t => t.state !== 'Турнир отменен')
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  // --- 1) Собираем базовые агрегаты по всем матчам для каждого игрока
  const agg = await db('participants as p')
    .join('matches as m', 'p.match_ref', 'm.id')
    .groupBy('p.player_id', 'p.player_name')
    .select(
      'p.player_id',
      'p.player_name',
      db.raw('COUNT(*)::integer AS total_matches'),
      db.raw('SUM(p.kills)::integer AS total_kills'),
      db.raw('AVG(p.kills)::float   AS avg_kills'),
      db.raw("SUM(CASE WHEN p.placement = 1 THEN 1 ELSE 0 END)::integer AS total_wins"),
      db.raw("SUM(CASE WHEN p.placement <= 10 THEN 1 ELSE 0 END)::integer AS top10_finishes"),
      db.raw('AVG(p.damage)::float AS avg_damage'),
      db.raw("SUM((p.stats ->> 'assists')::integer)::integer AS total_assists")
    );

  for (let r of agg) {
    // --- 2) Достаём старый efficient_rating
    const profRec = await getProfile(r.player_id) || {};
    const oldRating = profRec.efficient_rating || 0;

    // --- 3) Собираем историю событий участника по турнирам
    // Получаем из БД для этого игрока все записи
    const history = await db('participants as p')
      .join('matches as m', 'p.match_ref', 'm.id')
      .where('p.player_id', r.player_id)
      .orderBy('m.played_at', 'asc')
      .select('m.tournament_id', 'p.placement', 'p.kills');

    // --- 4) Строим events[] длиной tours.length
    const events = tours.map(t => {
      const rec = history.find(h => h.tournament_id === t.id);
      if (!rec) return null;
      const kills = rec.kills || 0;
      const scale = t.type === 'solo' ? soloPlace : teamPlace;
      const def   = t.type === 'solo' ? defaultSolo : defaultTeam;
      return getP(rec.placement, kills, scale, def);
    });

    // --- 5) Калибровка первых N
    const firstP = [];
    for (const p of events) {
      if (p != null) firstP.push(p);
      if (firstP.length >= N) break;
    }
    const longAnchor    = mean(firstP);
    const isCalibrating = firstP.length < N;

    // --- 6) Пересчёт рейтинга
    let rating = isCalibrating ? longAnchor : oldRating;
    if (!isCalibrating) {
      let histP = [...firstP];
      let realCnt = firstP.length;
      for (let p of events) {
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
    }
    const newEfficient = parseFloat(rating.toFixed(2));

    // --- 7) Собираем полный профиль для upsert
    const profile = {
      player_id:      r.player_id,
      player_name:    r.player_name,
      total_matches:  r.total_matches,
      total_kills:    r.total_kills,
      avg_kills:      parseFloat(r.avg_kills.toFixed(2)),
      total_wins:     r.total_wins,
      top10_finishes: r.top10_finishes,
      avg_damage:     parseFloat(r.avg_damage.toFixed(2)),
      total_assists:  r.total_assists,
      efficient_rating: newEfficient
      // остальные метрики оставляем как есть (upsertProfileStats не перезаписывает ненаписанные)
    };

    // --- 8) Upsert в player_profiles
    await upsertProfileStats(profile);
    console.log(`→ ${r.player_name}: efficient_rating ${oldRating} → ${newEfficient}`);
  }

  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
