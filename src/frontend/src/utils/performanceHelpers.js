// Локальный helper для coverage, чтобы не тянуть TS-модули из backend-части
function buildCoverage(trackedMatches, totalMatches, label) {
  return {
    trackedMatches,
    totalMatches,
    label
  };
}

// Нормализация результатов матчей для команды или игрока в рамках одного турнира
export function getMatchResults(entity, tournament) {
  const rounds = tournament?.rounds || 0;
  const scoring = tournament?.scoring || { placement: {}, per_kill: 0 };
  const results = entity?.results || [];

  const items = Array.from({ length: rounds }, (_, index) => {
    const matchIndex = index + 1;
    const raw = results[index] || {};
    const placement = raw.placement ?? null;
    const kills = raw.kills ?? null;

    const placementPoints =
      placement != null ? (scoring.placement?.[placement] || 0) : 0;
    const killPoints =
      kills != null ? kills * (scoring.per_kill || 0) : 0;
    const points = placementPoints + killPoints;

    return {
      matchIndex,
      placement,
      kills,
      points: points > 0 ? points : null,
      placementPoints: placementPoints || null,
      killPoints: killPoints || null
    };
  });

  return items;
}

// Данные для полосы формы
export function computeFormDots(results) {
  const maxPoints = results.reduce(
    (max, r) => (r.points != null && r.points > max ? r.points : max),
    0
  );

  return results.map((r) => ({
    matchIndex: r.matchIndex,
    placement: r.placement,
    kills: r.kills,
    points: r.points,
    bucket:
      r.placement == null
        ? 'muted'
        : r.placement >= 1 && r.placement <= 3
        ? 'good'
        : r.placement >= 4 && r.placement <= 10
        ? 'neutral'
        : 'bad',
    maxPoints
  }));
}

// Матрица киллов по игрокам/матчам для команды
export function getTeamKillsMatrix(team, tournament) {
  const rounds = tournament?.rounds || 0;
  const players = team?.players || (team?.name ? [team.name] : []);
  const rawMatrix = team?.playerKills || [];

  const matches = Array.from({ length: rounds }, (_, index) => index + 1);

  const matrix = players.map((_, playerIdx) => {
    const row = rawMatrix[playerIdx]?.kills || [];
    return matches.map((matchIndex) => {
      const value = row[matchIndex - 1];
      return value != null ? value : null;
    });
  });

  const rowSums = matrix.map((row) =>
    row.reduce((sum, value) => sum + (value || 0), 0)
  );

  const colSums = matches.map((_, colIdx) =>
    matrix.reduce((sum, row) => sum + (row[colIdx] || 0), 0)
  );

  // coverage по киллам: сколько матчей вообще имеют какие-то киллы
  let trackedMatches = 0;
  matches.forEach((matchIndex) => {
    const colIdx = matchIndex - 1;
    const hasAnyKillTracked = matrix.some((row) => row[colIdx] != null);
    if (hasAnyKillTracked) {
      trackedMatches += 1;
    }
  });

  const totalMatches = matches.length;

  const coverage =
    totalMatches > 0
      ? buildCoverage(
          trackedMatches,
          totalMatches,
          `Kills tracked: ${trackedMatches}/${totalMatches}`
        )
      : buildCoverage(0, 0, 'Kills tracked: 0/0');

  return {
    players,
    matches,
    matrix,
    rowSums,
    colSums,
    coverage
  };
}

// Подсчёт агрегатов по результатам
export function computeSummary(results, entity) {
  const valid = results.filter((r) => r.placement != null);
  const totalPoints =
    results.reduce((sum, r) => sum + (r.points || 0), 0) || 0;
  const killsTrackedMatches = results.filter((r) => r.kills != null).length;
  const totalKills =
    results.reduce((sum, r) => sum + (r.kills || 0), 0) || 0;

  const avgPlace =
    valid.length > 0
      ? valid.reduce((sum, r) => sum + (r.placement || 0), 0) / valid.length
      : null;

  const killsCoverage = buildCoverage(
    killsTrackedMatches,
    valid.length || 0,
    `Kills tracked: ${killsTrackedMatches}/${valid.length || 0}`
  );

  return {
    rank: entity?.rank ?? null,
    totalPoints,
    totalKills,
    avgPlace,
    killsCoverage
  };
}

// Highlights для экрана
export function computeHighlights(results, entity) {
  const completed = results.filter((r) => r.placement != null);
  if (!completed.length) {
    return {
      bestMatch: null,
      worstMatch: null,
      mvp: null,
      comeback: null
    };
  }

  const bestMatch = [...completed].sort((a, b) => {
    if (a.placement == null && b.placement == null) return 0;
    if (a.placement == null) return 1;
    if (b.placement == null) return -1;
    return a.placement - b.placement;
  })[0];

  const worstMatch = [...completed].sort((a, b) => {
    if (a.placement == null && b.placement == null) return 0;
    if (a.placement == null) return -1;
    if (b.placement == null) return 1;
    return b.placement - a.placement;
  })[0];

  // MVP: если есть playerKills – игрок с максимальной суммой киллов
  let mvp = null;
  if (Array.isArray(entity?.playerKills) && Array.isArray(entity?.players)) {
    const totals = entity.playerKills.map((row) =>
      (row.kills || []).reduce((sum, value) => sum + (value || 0), 0)
    );
    let bestIdx = -1;
    let bestKills = -1;
    totals.forEach((value, idx) => {
      if (value > bestKills) {
        bestKills = value;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      mvp = {
        playerName: entity.players[bestIdx],
        totalKills: bestKills
      };
    }
  }

  // Лучший камбэк: матч с максимальным приростом очков относительно предыдущего
  let comeback = null;
  if (completed.length > 1) {
    let bestDelta = -Infinity;
    for (let i = 1; i < completed.length; i += 1) {
      const prev = completed[i - 1];
      const curr = completed[i];
      const prevPoints = prev.points ?? 0;
      const currPoints = curr.points ?? 0;
      const delta = currPoints - prevPoints;
      if (Number.isFinite(delta) && delta > bestDelta && delta > 0) {
        bestDelta = delta;
        comeback = { ...curr, delta };
      }
    }
  }

  return {
    bestMatch,
    worstMatch,
    mvp,
    comeback
  };
}

// Локальная версия getTournamentStatus (аналог stats/normalize)
export function getTournamentStatus(state) {
  if (state === 'Турнир окончен' || state === 'DONE') return 'DONE';
  if (state === 'В процессе') return 'LIVE';
  return 'REG';
}

// Простое форматирование даты турнира (YYYY-MM-DD -> DD.MM.YYYY)
export function formatTournamentDate(value) {
  if (!value || typeof value !== 'string') return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

