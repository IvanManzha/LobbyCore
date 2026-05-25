#!/usr/bin/env node
// scripts/db_scripts/calcTournamentIQ.js

/**
 * Рассчитывает турнирный IQ для каждого игрока по формуле:
 *   IQ_raw = wP*P + wS*S + wR*R + wE*E + wU*U + wC*C + wZ*Z + wG*G
 *   IQ = 100 * IQ_raw
 *
 * Перед запуском рассчитываем и проставляем флаг inCover для всех точек.
 */

require('dotenv').config();
const Knex = require('knex');
const config = require('../../knexfile')[process.env.NODE_ENV || 'development'];
const db     = Knex(config);

// Параметры inCover
const COVER_FACTOR   = 0.3;  // 30% средней скорости
const WINDOW_SIZE    = 4;    // окно из 4 точек
const SPECIAL_EVENTS = [
  'LogVaultStart','LogVaultEnd','LogEnterSmoke','LogLeaveSmoke'
];

// турнир, для которого считаем IQ
const tournamentId = 'test1';

// Веса подметрик (сумма = 1)
const weights = {
  P: 0.10,  // Positioning
  S: 0.10,  // Survival Time
  R: 0.15,  // Rotation Efficiency
  E: 0.15,  // Resource Efficiency
  U: 0.10,  // Utility Management
  C: 0.20,  // Cover
  Z: 0.10,  // Blue Zone Reactivity
  G: 0.10,   // Grenade Accuracy
  E_hd: 0.30,// Heals per Damage
  E_bu: 0.25,// Boost Uptime
  E_lu: 0.25,// Loot-to-Use
  E_rs: 0.20,// Remaining Supplies
};

// Заглушки для остальных
async function calcS() { return 0; }
async function calcU() { return 0; }
async function calcZ() { return 0; }
async function calcG() { return 0; }

/**
 * 0) Обновляем флаги inCover на основе скорости и специальных ивентов.
 */
async function updateCoverFlags() {
  console.log('>> Reset inCover flags');
  await db('telemetry_events').update({ inCover: 0 });

  console.log('>> Calculate average speeds');
  const avgSpeeds = await db.raw(`
    WITH pos AS (
      SELECT
        p.match_ref   AS matchId,
        p.id          AS partId,
        e.event_time  AS t,
        json_extract(e.event_data, '$.character.location.x') AS x,
        json_extract(e.event_data, '$.character.location.y') AS y
      FROM telemetry_events e
      JOIN participants p ON p.id = e.participant_ref
      JOIN matches m       ON m.id = p.match_ref
      WHERE m.tournament_id = ? AND e.event_type = 'LogPlayerPosition'
    ), speeds AS (
      SELECT
        matchId,
        partId,
        ((julianday(t) - julianday(
           LAG(t) OVER (PARTITION BY matchId, partId ORDER BY t)
         )) * 86400.0) AS dt,
        sqrt(
          (x - LAG(x) OVER (PARTITION BY matchId, partId ORDER BY t))*(x - LAG(x) OVER (PARTITION BY matchId, partId ORDER BY t))
        + (y - LAG(y) OVER (PARTITION BY matchId, partId ORDER BY t))*(y - LAG(y) OVER (PARTITION BY matchId, partId ORDER BY t))
        ) AS dist
      FROM pos
    )
    SELECT matchId, partId, AVG(dist / NULLIF(dt,0)) AS avgSpeed
    FROM speeds
    WHERE dt > 0
    GROUP BY matchId, partId;
  `, [tournamentId]);

  console.log('>> Mark slow windows as inCover');
  for (const { matchId, partId, avgSpeed } of avgSpeeds) {
    const threshold = avgSpeed * COVER_FACTOR;

    const points = await db('telemetry_events as e')
      .join('participants as p','e.participant_ref','p.id')
      .where('p.match_ref', matchId)
      .andWhere('e.participant_ref', partId)
      .andWhere('e.event_type','LogPlayerPosition')
      .select('e.id','e.event_time',
        db.raw(`json_extract(e.event_data,'$.character.location.x') AS x`),
        db.raw(`json_extract(e.event_data,'$.character.location.y') AS y`)
      )
      .orderBy('e.event_time','asc');

    const speeds = points.map((pt,i) => {
      if (i === 0) return null;
      const prev = points[i-1];
      const dt   = (new Date(pt.event_time) - new Date(prev.event_time))/1000;
      const dx   = pt.x - prev.x;
      const dy   = pt.y - prev.y;
      return dt>0
        ? { id: pt.id, speed: Math.hypot(dx, dy)/dt }
        : null;
    }).filter(Boolean);

    const coverIds = new Set();
    for (let i = 0; i <= speeds.length - WINDOW_SIZE; i++) {
      const win = speeds.slice(i, i + WINDOW_SIZE);
      if (win.every(s => s.speed < threshold)) {
        win.forEach(s => coverIds.add(s.id));
      }
    }

    if (coverIds.size) {
      await db('telemetry_events')
        .whereIn('id', Array.from(coverIds))
        .update({ inCover: 1 });
    }
    console.log(`  Match ${matchId}, Player ${partId}: marked ${coverIds.size}`);
  }

  console.log('>> Mark special events as inCover');
  const updated = await db('telemetry_events')
    .whereIn('event_type', SPECIAL_EVENTS)
    .update({ inCover: 1 });
  console.log(`  Special events: marked ${updated} points`);
}
/**
 * C: доля LogPlayerPosition с inCover=1
 */
async function calcC(participant_ref) {
  const [{ total = 0, covered = 0 }] = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .andWhere('event_type','LogPlayerPosition')
    .select(
      db.raw('COUNT(*) as total'),
      db.raw('SUM(CASE WHEN inCover=1 THEN 1 ELSE 0 END) as covered')
    );

  return total>0 ? covered/total : 0;
}
/**
 * P: Positioning = 0.5*P1 + 0.25*P2 + 0.25*P3
 */
async function calcP(participant_ref) {
  // 1) P1: финальный ранг
  const ranks = await db('participants as p')
    .join('matches as m','p.match_ref','m.id')
    .where('m.tournament_id', tournamentId)
    .andWhere('p.id', participant_ref)
    .select(
      'p.match_ref',
      'p.individualRanking',
      db.raw('COUNT(*) OVER (PARTITION BY p.match_ref) as cnt')
    );

  let sumP1 = 0, nP1 = 0;
  for (const { individualRanking, cnt } of ranks) {
    if (cnt > 1) {
      sumP1 += 1 - (individualRanking - 1)/(cnt - 1);
      nP1++;
    }
  }
  const P1 = nP1>0 ? sumP1/nP1 : 0;

  // 2) P2: средняя высота z, нормированная по minZ/maxZ
  // Получаем глобальные minZ/maxZ один раз в main()
  const [{ avgZ = null }] = await db('telemetry_events as e')
    .join('participants as p','e.participant_ref','p.id')
    .join('matches as m','p.match_ref','m.id')
    .where('m.tournament_id', tournamentId)
    .andWhere('e.participant_ref', participant_ref)
    .andWhere('e.event_type','LogPlayerPosition')
    .select(db.raw(
      `AVG(CAST(json_extract(e.event_data,'$.character.location.z') AS REAL)) as avgZ`
    ));

  const z = parseFloat(avgZ);
  const P2 = (!isNaN(z) && maxZ>minZ)
    ? (z - minZ)/(maxZ - minZ)
    : 0;

  // 3) P3: centrality — 1 − avg(dist/zone_radius)
  const rows = await db('telemetry_events as e')
    .select(
      db.raw(`CAST(json_extract(e.event_data,'$.character.location.x') AS REAL) as x`),
      db.raw(`CAST(json_extract(e.event_data,'$.character.location.y') AS REAL) as y`),
      'e.zone_center_x as zx',
      'e.zone_center_y as zy',
      'e.zone_radius as zr'
    )
    .where('e.participant_ref', participant_ref)
    .andWhere('e.event_type','LogPlayerPosition')
    .andWhereNotNull('e.zone_center_x');

  let sumNorm = 0, cntNorm = 0;
  for (const { x,y,zx,zy,zr } of rows) {
    if (zr>0 && x!=null && y!=null) {
      const d = Math.hypot(x-zx, y-zy);
      sumNorm += d/zr;
      cntNorm++;
    }
  }
  const avgNorm = cntNorm>0 ? sumNorm/cntNorm : 1;
  const P3 = Math.max(0, Math.min(1, 1 - avgNorm));

  return 0.5*P1 + 0.25*P2 + 0.25*P3;
}
/**
 * Rotation Efficiency (R):
 *  R1 — реакция на новую зону: 1 − (reactionTime / phaseDuration)
 *  R2 — прямолинейность пути: straightDistance / pathDistance
 *  R3 — скорость перемещения: (straightDistance / reactionTime) / avgSpeed
 *
 * В каждой фазе R_i берём среднее по всем фазам, а итог:
 *   R = (R1 + R2 + R3) / 3
 */
async function calcR(participant_ref) {
    // 1) Выбираем все «начала» фаз (LogGameStatePeriodic) с невозрастающей zone_phase
    const phases = await db('telemetry_events as e')
      .select(
        'e.event_time as startTime',
        'e.zone_phase as phase',
        'e.zone_center_x as zx',
        'e.zone_center_y as zy',
        'e.zone_radius as zr'
      )
      .where('e.event_type', 'LogGameStatePeriodic')
      // только реальные фазы (например, phase > 0)
      .andWhere('e.zone_phase', '>', 0)
      .orderBy('e.event_time', 'asc');
  
    if (phases.length < 2) return 0;  // плохо данных
  
    // 2) Предварительно считаем среднюю скорость игрока (как в markCover)
    const [{ avgSpeed = 0 }] = await db.raw(`
      WITH pos AS (
        SELECT
          e.event_time AS t,
          json_extract(e.event_data, '$.character.location.x') AS x,
          json_extract(e.event_data, '$.character.location.y') AS y
        FROM telemetry_events e
        WHERE e.participant_ref = ? 
          AND e.event_type = 'LogPlayerPosition'
      ), speeds AS (
        SELECT
          ((julianday(t) - julianday(
             LAG(t) OVER (ORDER BY t)
           )) * 86400.0) AS dt,
          sqrt(
            (x - LAG(x) OVER (ORDER BY t))*(x - LAG(x) OVER (ORDER BY t))
          + (y - LAG(y) OVER (ORDER BY t))*(y - LAG(y) OVER (ORDER BY t))
          ) AS dist
        FROM pos
      )
      SELECT AVG(dist / NULLIF(dt,0)) AS avgSpeed
      FROM speeds
      WHERE dt > 0
    `, [participant_ref]).then(r => r[0]);
  
    // 3) Для каждой пары фаз считаем R1, R2, R3
    let sumR1 = 0, sumR2 = 0, sumR3 = 0, count = 0;
  
    // предварительно заберём все точки позиции игрока один раз
    const allPos = await db('telemetry_events as e')
      .select(
        'e.event_time as t',
        db.raw("CAST(json_extract(e.event_data, '$.character.location.x') AS REAL) as x"),
        db.raw("CAST(json_extract(e.event_data, '$.character.location.y') AS REAL) as y")
      )
      .where('e.participant_ref', participant_ref)
      .andWhere('e.event_type', 'LogPlayerPosition')
      .orderBy('e.event_time', 'asc');
  
    for (let i = 0; i < phases.length - 1; i++) {
      const cur = phases[i];
      const next = phases[i + 1];
  
      const phaseStart = new Date(cur.startTime).getTime();
      const phaseEnd   = new Date(next.startTime).getTime();
      const windowDur  = (phaseEnd - phaseStart) / 1000;  // в секундах
  
      // находим первую точку, когда игрок вошёл в новую зону
      let entryTime = null, entryIdx = -1;
      for (let j = 0; j < allPos.length; j++) {
        const p = allPos[j];
        const ts = new Date(p.t).getTime();
        if (ts < phaseStart) continue;
        const dx = p.x - cur.zx, dy = p.y - cur.zy;
        if (Math.hypot(dx, dy) <= cur.zr) {
          entryTime = ts;
          entryIdx  = j;
          break;
        }
      }
      if (entryTime === null) continue;  // не успел зайти — пропускаем
  
      const reactionTime = (entryTime - phaseStart) / 1000; // сек
      // R1: быстрее лучше, нормируем по длительности фазы
      const r1 = 1 - Math.min(reactionTime / windowDur, 1);
  
      // R2 & R3: считаем path и straight
      let pathDist = 0;
      for (let k = 1; k <= entryIdx; k++) {
        const a = allPos[k - 1], b = allPos[k];
        const dx = b.x - a.x, dy = b.y - a.y;
        pathDist += Math.hypot(dx, dy);
      }
      const startPos = allPos.find(p => new Date(p.t).getTime() >= phaseStart);
      if (!startPos) continue;
      const straight = Math.hypot(startPos.x - allPos[entryIdx].x,
                                  startPos.y - allPos[entryIdx].y);
  
      const r2 = pathDist > 0 ? Math.min(straight / pathDist, 1) : 0;
      const instSpeed = reactionTime > 0 ? straight / reactionTime : 0;
      const r3 = avgSpeed > 0 ? Math.min(instSpeed / avgSpeed, 1) : 0;
  
      sumR1 += r1;
      sumR2 += r2;
      sumR3 += r3;
      count++;
    }
  
    if (count === 0) return 0;
    // средние по всем фазам
    const R1 = sumR1 / count;
    const R2 = sumR2 / count;
    const R3 = sumR3 / count;
  
    // итоговый R
    return (R1 + R2 + R3) / 3;
  }

async function calcE(participant_ref) {
  // 1) Heals и boosts
  const [{ heals = 0, boosts = 0 }] = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .whereIn('event_type', ['healEvent','boostEvent'])
    .count({ heals: db.raw("CASE WHEN event_type='healEvent' THEN 1 END") })
    .sum({ boosts: db.raw("CASE WHEN event_type='boostEvent' THEN 1 ELSE 0 END") });

  // 2) Damage taken
  const [{ damageTaken = 0 }] = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .andWhere('event_type','LogPlayerTakeDamage')
    .sum({ damageTaken: db.raw("json_extract(event_data,'$.damage')") });

  const Hd_raw = heals / (damageTaken + 1);

  // 3) Survival time
  const [{ tStart, tEnd }] = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .min({ tStart: 'event_time' })
    .max({ tEnd:   'event_time' });

  const T_survived = (new Date(tEnd) - new Date(tStart)) / 1000;

  // 4) Boost Uptime
  const boostRows = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .andWhere('event_type','boostEvent')
    .select('event_time','event_data');

  let T_boost = 0;
  for (const { event_time, event_data } of boostRows) {
    const item = JSON.parse(event_data).item || '';
    let dur = 0;
    if (/EnergyDrink/.test(item))    dur = 120;
    else if (/Painkiller/.test(item)) dur = 180;
    else if (/Adrenaline/.test(item)) dur = 300;

    const elapsedSinceStart = (new Date(event_time) - new Date(tStart)) / 1000;
    const remain = T_survived - elapsedSinceStart;
    if (remain > 0) T_boost += Math.min(dur, remain);
  }
  const Bu_raw = T_survived > 0 ? T_boost / T_survived : 0;

  // 5) Loot-to-Use & Remaining
  const [{ picked = 0 }] = await db('telemetry_events')
    .where('participant_ref', participant_ref)
    .andWhere('event_type','itemLoot')
    .andWhereRaw("json_extract(event_data,'$.item_category') IN ('Heals','Boosts')")
    .count('* AS picked');

  const used = heals + boosts;
  const Lu_raw = used / (picked + 1);
  const Rs_raw = (picked - used) / (picked + 1);

  // 6) Собираем min/max по пулу матчей (единожды, до цикла main)
  //    Здесь используем глобальные объекты bounds.*
  const Hd = (Hd_raw - bounds.Hd.min) / (bounds.Hd.max - bounds.Hd.min);
  const Bu = (Bu_raw - bounds.Bu.min) / (bounds.Bu.max - bounds.Bu.min);
  const Lu = (Lu_raw - bounds.Lu.min) / (bounds.Lu.max - bounds.Lu.min);
  const Rs = (Rs_raw - bounds.Rs.min) / (bounds.Rs.max - bounds.Rs.min);

  // 7) Взвешиваем
  const E = weights.E_hd * Hd
          + weights.E_bu * Bu
          + weights.E_lu * Lu
          + weights.E_rs * Rs;
  return E;
  }

let bounds = {
  Hd: { min: Infinity, max: -Infinity },
  Bu: { min: Infinity, max: -Infinity },
  Lu: { min: Infinity, max: -Infinity },
  Rs: { min: Infinity, max: -Infinity },
};

async function computeBounds() {
  const players = await db('participants as p')
    .join('matches as m','p.match_ref','m.id')
    .where('m.tournament_id', tournamentId)
    .groupBy('p.id')
    .select('p.id as participant_ref');

  for (const { participant_ref } of players) {
    // вычисляем raw-значения без нормализации
    const valHd = await (async () => {
      const [{ heals = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','healEvent')
        .count('* AS heals');
      const [{ damageTaken = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','LogPlayerTakeDamage')
        .sum({ damageTaken: db.raw("json_extract(event_data,'$.damage')") });
      return heals / (damageTaken + 1);
    })();

    const valBu = await (async () => {
      // 1) Берём время старта и конца выживания
      const [{ tStart, tEnd }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .min({ tStart: 'event_time' })
        .max({ tEnd:   'event_time' });
      const T_survived = (new Date(tEnd) - new Date(tStart)) / 1000;
    
      // 2) Собираем все boostEvent этого игрока
      const boostRows = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','boostEvent')
        .select('event_time','event_data');
    
      // 3) Суммируем длительности баффов
      let T_boost = 0;
      for (const { event_time, event_data } of boostRows) {
        const item = JSON.parse(event_data).item || '';
        let dur = 0;
        if (/EnergyDrink/.test(item))     dur = 120;
        else if (/Painkiller/.test(item))  dur = 180;
        else if (/Adrenaline/.test(item))  dur = 300;
    
        // не выйти за рамки выживания
        const elapsedSinceStart = (new Date(event_time) - new Date(tStart)) / 1000;
        const remain = T_survived - elapsedSinceStart;
        if (remain > 0) T_boost += Math.min(dur, remain);
      }
    
      // 4) Вычисляем отношение
      return T_survived > 0 ? T_boost / T_survived : 0;
    })();

    const valLu = await (async () => {
      const [{ picked = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','itemLoot')
        .andWhereRaw("json_extract(event_data,'$.item_category') IN ('Heals','Boosts')")
        .count('* AS picked');
      const [{ heals = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','healEvent')
        .count('* AS heals');
      const [{ boosts = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','boostEvent')
        .count('* AS boosts');
      const used = heals + boosts;
      return used / (picked + 1);
    })();

    const valRs = await (async () => {
      const [{ picked = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','itemLoot')
        .andWhereRaw("json_extract(event_data,'$.item_category') IN ('Heals','Boosts')")
        .count('* AS picked');
      const [{ heals = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','healEvent')
        .count('* AS heals');
      const [{ boosts = 0 }] = await db('telemetry_events')
        .where('participant_ref', participant_ref)
        .andWhere('event_type','boostEvent')
        .count('* AS boosts');
      const used = heals + boosts;
      return (picked - used) / (picked + 1);
    })();

    bounds.Hd.min = Math.min(bounds.Hd.min, valHd);
    bounds.Hd.max = Math.max(bounds.Hd.max, valHd);
    bounds.Bu.min = Math.min(bounds.Bu.min, valBu);
    bounds.Bu.max = Math.max(bounds.Bu.max, valBu);
    bounds.Lu.min = Math.min(bounds.Lu.min, valLu);
    bounds.Lu.max = Math.max(bounds.Lu.max, valLu);
    bounds.Rs.min = Math.min(bounds.Rs.min, valRs);
    bounds.Rs.max = Math.max(bounds.Rs.max, valRs);
  }
}

async function main() {
  // 0) Отметить inCover
  await updateCoverFlags();

  // 1) Вычислить границы для нормализации E-подметрик
  await computeBounds();

  // 2) (Опционально) вычислить minZ/maxZ для calcP
  const [{ minZ = 0, maxZ = 0 }] = await db.raw(`
    SELECT
      MIN(json_extract(e.event_data,'$.character.location.z')) AS minZ,
      MAX(json_extract(e.event_data,'$.character.location.z')) AS maxZ
    FROM telemetry_events e
    JOIN participants p ON p.id = e.participant_ref
    JOIN matches m       ON m.id = p.match_ref
    WHERE m.tournament_id = ? AND e.event_type = 'LogPlayerPosition';
  `, [tournamentId]);

  // 3) Собрать список участников турнира
  const players = await db('participants as p')
    .join('matches as m','p.match_ref','m.id')
    .where('m.tournament_id', tournamentId)
    .groupBy('p.id')
    .select('p.id as participant_ref','p.player_name');

  console.log('Player\tP\tS\tR\tE\tU\tC\tZ\tG\tIQ');
  for (const { participant_ref, player_name } of players) {
    // Параллельно вычисляем все метрики
    const [P,S,R,E,U,C,Z,G] = await Promise.all([
      calcP(participant_ref),
      calcS(participant_ref),
      calcR(participant_ref),
      calcE(participant_ref),  // теперь E учитывает 4 подметрики
      calcU(participant_ref),
      calcC(participant_ref),
      calcZ(participant_ref),
      calcG(participant_ref),
    ]);

    // Собираем IQ
    const IQ_raw =
      weights.P * P +
      weights.S * S +
      weights.R * R +
      weights.E * E +
      weights.U * U +
      weights.C * C +
      weights.Z * Z +
      weights.G * G;
    const IQ = 100 * IQ_raw;

    console.log(
      `${player_name}\t`+
      `${P.toFixed(2)}\t${S.toFixed(2)}\t${R.toFixed(2)}\t${E.toFixed(2)}\t`+
      `${U.toFixed(2)}\t${(C*100).toFixed(1)}%\t${Z.toFixed(2)}\t${G.toFixed(2)}\t`+
      `${IQ.toFixed(2)}`
    );
  }

  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});