// Модуль для построения derived views из table.json
// Источник правды: table.json, этот модуль только строит представления для UI

/**
 * Вычисляет очки за матч для команды/игрока
 */
function calculateMatchPoints(result, scoring, tournamentId, teamSize = 1) {
  if (!result) return null;
  
  const placement = result.placement ?? null;
  const kills = result.kills ?? null;
  
  // Очки за место
  const placementPoints = placement != null 
    ? (scoring.placement?.[placement] || 0) 
    : 0;
  
  // Очки за киллы
  const killPoints = kills != null 
    ? kills * (scoring.per_kill || 0) 
    : 0;
  
  // Если нет данных о месте и киллах, возвращаем null
  if (placement == null && kills == null) {
    return null;
  }
  
  let points = placementPoints + killPoints;
  
  // Модификатор для HotDrop турнира
  const isHotDrop = tournamentId === 'HotDrop';
  if (isHotDrop && teamSize > 1) {
    const modifier = teamSize === 2 ? 0.8 : teamSize === 3 ? 0.6 : 1;
    points = points * modifier;
  }
  
  return points > 0 ? points : null;
}

/**
 * Определяет статус матча на основе заполненности данных
 */
function getMatchStatus(results) {
  if (!results || results.length === 0) return 'empty';
  
  const hasAnyData = results.some(r => 
    r.place != null || r.kills != null || r.points != null
  );
  
  if (!hasAnyData) return 'empty';
  
  // Проверяем, все ли команды/игроки имеют данные
  const allHavePlacement = results.every(r => r.place != null);
  const allHaveKills = results.every(r => r.kills != null);
  
  if (allHavePlacement && allHaveKills) return 'filled';
  return 'partial';
}

/**
 * Строит массив MatchSummary из table.json
 */
export function buildMatchesFromResults(table) {
  if (!table || !table.tournament || !table.teams) {
    return [];
  }
  
  const { tournament, teams } = table;
  // Число раундов: максимум из tournament.rounds и фактической длины results у команд,
  // чтобы отображались все раунды при расхождении (например, раунды добавлялись через add-round).
  const roundsFromMeta = tournament.rounds || 0;
  const roundsFromTeams = Math.max(0, ...(teams || []).map(t => (t.results && Array.isArray(t.results) ? t.results.length : 0)));
  const rounds = Math.max(roundsFromMeta, roundsFromTeams);
  const scoring = tournament.scoring || { placement: {}, per_kill: 0 };
  const tournamentId = tournament.id || null;
  const tournamentType = tournament.type || 'solo';
  const isSolo = tournamentType === 'solo';
  
  const matches = [];
  
  // Для каждого матча (matchIndex от 1 до rounds)
  for (let matchIndex = 1; matchIndex <= rounds; matchIndex++) {
    const matchResults = [];
    const matchIndex0 = matchIndex - 1; // индекс в массиве (0-based)
    
    // Собираем результаты всех команд/игроков для этого матча
    teams.forEach(team => {
      const result = team.results?.[matchIndex0] || {};
      const placement = result.placement ?? null;
      const kills = result.kills ?? null;
      
      // Для solo: kills из results - это личные киллы
      // Для squad/duo: kills из results - это командные киллы
      let entityKills = kills;
      
      // Вычисляем очки
      const teamSize = Array.isArray(team.players) ? team.players.length : 1;
      const points = calculateMatchPoints(result, scoring, tournamentId, teamSize);
      
      matchResults.push({
        entityId: team.name,
        name: team.name,
        place: placement,
        kills: entityKills,
        points: points
      });
    });
    
    // Сортируем по месту (лучшие первые)
    matchResults.sort((a, b) => {
      if (a.place == null && b.place == null) return 0;
      if (a.place == null) return 1;
      if (b.place == null) return -1;
      return a.place - b.place;
    });
    
    // Определяем статус матча
    const status = getMatchStatus(matchResults);
    
    // Вычисляем totals
    const totalKills = matchResults.reduce((sum, r) => sum + (r.kills ?? 0), 0);
    const totalPoints = matchResults.reduce((sum, r) => sum + (r.points ?? 0), 0);
    
    // Находим best
    const topResult = matchResults.find(r => r.place != null);
    const maxKillsResult = matchResults.reduce((best, r) => 
      (r.kills ?? 0) > (best.kills ?? 0) ? r : best, 
      matchResults[0] || { kills: null }
    );
    const maxPointsResult = matchResults.reduce((best, r) => 
      (r.points ?? 0) > (best.points ?? 0) ? r : best, 
      matchResults[0] || { points: null }
    );
    
    matches.push({
      matchIndex,
      status,
      results: matchResults,
      totals: {
        kills: totalKills > 0 ? totalKills : null,
        points: totalPoints > 0 ? totalPoints : null
      },
      best: {
        topEntity: topResult?.name,
        maxKills: maxKillsResult?.kills ?? null,
        maxPoints: maxPointsResult?.points ?? null
      }
    });
  }
  
  return matches;
}

/**
 * Строит массив PlayerOrTeamSummary из matches и table
 */
export function buildEntitiesFromMatches(matches, table, tournamentMeta) {
  if (!table || !table.tournament || !table.teams) {
    return [];
  }
  
  const { tournament, teams } = table;
  // tournamentId может быть в tournament.id или в tournamentMeta.id
  const tournamentId = tournament.id || tournamentMeta?.id || null;
  const tournamentType = tournament.type || 'solo';
  const isSolo = tournamentType === 'solo';
  const scoring = tournament.scoring || { placement: {}, per_kill: 0 };
  
  const entities = [];
  
  teams.forEach(team => {
    const teamResults = team.results || [];
    const teamPlayers = team.players || (team.name ? [team.name] : []);
    const teamSize = teamPlayers.length;
    
    // Собираем данные по матчам для этой команды/игрока
    const matchData = matches.map(match => {
      const matchResult = match.results.find(r => r.entityId === team.name);
      return {
        matchIndex: match.matchIndex,
        place: matchResult?.place ?? null,
        kills: matchResult?.kills ?? null,
        points: matchResult?.points ?? null
      };
    });
    
    // Вычисляем агрегаты
    const matchesPlayed = matchData.filter(m => m.place != null).length;
    const totalPoints = team.totalPoints ?? null;
    
    // Total kills: для solo из results, для squad/duo суммируем playerKills
    let totalKills = null;
    if (isSolo) {
      totalKills = teamResults.reduce((sum, r) => sum + (r.kills ?? 0), 0) || null;
    } else {
      // Для командных: суммируем все playerKills
      if (Array.isArray(team.playerKills)) {
        const sum = team.playerKills.reduce((total, pk) => {
          const kills = pk.kills || [];
          return total + kills.reduce((s, k) => s + (k ?? 0), 0);
        }, 0);
        totalKills = sum > 0 ? sum : null;
      }
    }
    
    // Среднее место
    const places = matchData.filter(m => m.place != null).map(m => m.place);
    const avgPlace = places.length > 0
      ? places.reduce((sum, p) => sum + p, 0) / places.length
      : null;
    
    // Лучший матч
    const bestMatch = matchData
      .filter(m => m.points != null)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    
    // Форма: все раунды (с результатом и без), чтобы в таблице игроков отображались все матчи
    const form = matchData.map(m => ({
      matchIndex: m.matchIndex,
      place: m.place ?? null,
      points: m.points ?? null,
      kills: m.kills ?? null
    }));
    
    // Ссылка
    const link = isSolo
      ? `/tournament/${tournamentId}/solo/${encodeURIComponent(team.name)}`
      : `/tournament/${tournamentId}/team/${encodeURIComponent(team.name)}`;
    
    // Для командных турниров: собираем данные по игрокам (из playerKills или только состав для REG)
    let players = null;
    if (!isSolo && teamPlayers.length > 1) {
      if (Array.isArray(team.playerKills)) {
        players = teamPlayers.map((playerName, playerIdx) => {
          const playerKills = team.playerKills[playerIdx]?.kills || [];
          const playerTotalKills = playerKills.reduce((sum, k) => sum + (k ?? 0), 0);
          const playerKillsMatches = playerKills.filter(k => k != null).length;
          const playerAvgKills = playerKillsMatches > 0
            ? playerTotalKills / playerKillsMatches
            : null;
          let playerBestMatch = null;
          let maxKills = -1;
          playerKills.forEach((kills, idx) => {
            if (kills != null && kills > maxKills) {
              maxKills = kills;
              playerBestMatch = { matchIndex: idx + 1, kills };
            }
          });
          return {
            name: playerName,
            totalKills: playerTotalKills > 0 ? playerTotalKills : null,
            avgKills: playerAvgKills,
            bestMatch: playerBestMatch
          };
        });
      } else {
        // Турнир на регистрации: только состав без статистики
        players = teamPlayers.map((name) => ({
          name,
          totalKills: null,
          avgKills: null,
          bestMatch: null
        }));
      }
    }
    
    entities.push({
      entityId: team.name,
      name: team.name,
      rank: team.rank ?? null,
      matchesPlayed,
      totalPoints,
      totalKills,
      avgPlace: avgPlace ? Math.round(avgPlace * 10) / 10 : null,
      bestMatch: bestMatch ? {
        matchIndex: bestMatch.matchIndex,
        points: bestMatch.points,
        kills: bestMatch.kills,
        place: bestMatch.place
      } : undefined,
      form: form.length > 0 ? form : undefined, // все раунды, place может быть null
      link,
      players
    });
  });
  
  // Сортируем по rank
  entities.sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });
  
  return entities;
}

/**
 * Вычисляет coverage статистику
 */
export function computeCoverage(matches, entities) {
  if (!matches || matches.length === 0) {
    return {
      matchesFilled: 0,
      matchesTotal: 0,
      killsTracked: 0,
      pointsTracked: 0
    };
  }
  
  const matchesFilled = matches.filter(m => m.status === 'filled').length;
  const matchesTotal = matches.length;
  
  // Считаем сколько матчей имеют tracked kills
  const killsTracked = matches.filter(m => 
    m.results.some(r => r.kills != null)
  ).length;
  
  // Считаем сколько матчей имеют tracked points
  const pointsTracked = matches.filter(m => 
    m.results.some(r => r.points != null)
  ).length;
  
  return {
    matchesFilled,
    matchesTotal,
    killsTracked,
    pointsTracked
  };
}

/**
 * Главная функция: строит все derived views из table.json
 */
export function buildTournamentDerived(table, tournamentMeta) {
  if (!table) {
    return {
      matches: [],
      entities: [],
      coverage: {
        matchesFilled: 0,
        matchesTotal: 0,
        killsTracked: 0,
        pointsTracked: 0
      }
    };
  }
  
  const matches = buildMatchesFromResults(table);
  const entities = buildEntitiesFromMatches(matches, table, tournamentMeta);
  const coverage = computeCoverage(matches, entities);
  
  return {
    matches,
    entities,
    coverage
  };
}
