import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerStats } from '../index';

const baseTournament = {
  id: 't1',
  name: 'Test Cup',
  date: '2026-01-12',
  type: 'solo',
  state: 'Турнир окончен',
  rounds: 2
};

const baseTable = {
  tournament: {
    id: 't1',
    name: 'Test Cup',
    type: 'solo',
    rounds: 2,
    scoring: {
      placement: { 1: 25, 2: 20, 3: 17 },
      per_kill: 2
    }
  },
  teams: []
};

test('player без матчей -> core метрики = "—", matches=0', () => {
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: baseTable }
  });

  assert.equal(stats.meta.matchesPlayed, 0);
  const avgPlace = stats.core.find((item) => item.id === 'avg_place');
  assert.equal(avgPlace?.displayValue, '—');
});

test('часть матчей без kills -> coverage и avg kills корректны', () => {
  const table = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        results: [
          { placement: 1, kills: 2 },
          { placement: 5, kills: null }
        ]
      }
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: table }
  });

  const killsMetric = stats.core.find((item) => item.id === 'kills_per_match');
  assert.equal(killsMetric?.displayValue, '2.0');
  assert.equal(stats.coverage.kills.trackedMatches, 1);
  assert.equal(stats.coverage.kills.totalMatches, 2);
});

test('live tournament не влияет на all_time', () => {
  const liveTournament = {
    ...baseTournament,
    id: 't2',
    name: 'Live Cup',
    state: 'В процессе',
    date: '2026-02-01'
  };
  const liveTable = {
    ...baseTable,
    tournament: { ...baseTable.tournament, id: 't2', name: 'Live Cup' },
    teams: [
      {
        name: 'PlayerA',
        results: [{ placement: 1, kills: 4 }]
      }
    ]
  };
  const doneTable = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        results: [{ placement: 2, kills: 1 }]
      }
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament, liveTournament],
    tablesById: { t1: doneTable, t2: liveTable }
  }, { scope: 'all_time' });

  assert.equal(stats.meta.matchesPlayed, 1);
  const winRate = stats.core.find((item) => item.id === 'winrate');
  assert.equal(winRate?.displayValue, '0%');
});

test('winrate/top-3 для solo считаются корректно', () => {
  const botTeams = Array.from({ length: 9 }, (_, idx) => ({
    name: `Bot${idx + 1}`,
    results: [
      { placement: idx + 4, kills: 0 },
      { placement: idx + 4, kills: 0 },
      { placement: idx + 4, kills: 0 }
    ]
  }));
  const table = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        results: [
          { placement: 1, kills: 1 },
          { placement: 2, kills: 0 },
          { placement: 5, kills: 1 }
        ]
      },
      ...botTeams
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [{ ...baseTournament, rounds: 3 }],
    tablesById: { t1: table }
  });

  const winRate = stats.core.find((item) => item.id === 'winrate');
  const topRate = stats.core.find((item) => item.id === 'top_rate');
  assert.equal(winRate?.displayValue, '33%');
  assert.equal(topRate?.displayValue, '67%');
});

test('avg place округляется до 1 знака', () => {
  const table = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        results: [
          { placement: 1, kills: 0 },
          { placement: 2, kills: 0 },
          { placement: 3, kills: 0 }
        ]
      }
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [{ ...baseTournament, rounds: 3 }],
    tablesById: { t1: table }
  });

  const avgPlace = stats.core.find((item) => item.id === 'avg_place');
  assert.equal(avgPlace?.displayValue, '2.0');
});

test('coverage для deaths корректно считается', () => {
  const table = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        playerKills: [{ kills: [2, 1] }],
        playerDeaths: [{ deaths: [1, null] }],
        results: [
          { placement: 1, kills: 2 },
          { placement: 5, kills: 1 }
        ]
      }
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: table }
  });

  assert.equal(stats.coverage.deaths.trackedMatches, 1);
  assert.equal(stats.coverage.deaths.totalMatches, 2);
  assert.equal(stats.coverage.kd.trackedMatches, 1);
  assert.equal(stats.coverage.kd.totalMatches, 2);
});

test('K/D показывается только когда deaths есть', () => {
  const tableWithDeaths = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        playerKills: [{ kills: [2, 1] }],
        playerDeaths: [{ deaths: [1, 1] }],
        results: [
          { placement: 1, kills: 2 },
          { placement: 5, kills: 1 }
        ]
      }
    ]
  };
  const tableWithoutDeaths = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        playerKills: [{ kills: [2, 1] }],
        results: [
          { placement: 1, kills: 2 },
          { placement: 5, kills: 1 }
        ]
      }
    ]
  };
  const profile = { name: 'PlayerA', history: [] };
  
  const statsWithDeaths = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: tableWithDeaths }
  });
  
  const statsWithoutDeaths = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: tableWithoutDeaths }
  });

  const kdWithDeaths = statsWithDeaths.core.find((item) => item.id === 'kd');
  const kdWithoutDeaths = statsWithoutDeaths.core.find((item) => item.id === 'kd');
  
  assert.equal(kdWithDeaths?.displayValue, '1.50');
  // Когда deaths не трекались вообще, K/D должен быть "—"
  // Но если deaths = 0, а kills > 0, то K/D = Infinity (что правильно)
  // Проверяем, что когда deaths не трекались (null), K/D = "—"
  assert.equal(kdWithoutDeaths?.displayValue, '—');
  
  // Дополнительный тест: когда deaths = 0, но kills > 0
  const tableWithZeroDeaths = {
    ...baseTable,
    teams: [
      {
        name: 'PlayerA',
        playerKills: [{ kills: [2, 1] }],
        playerDeaths: [{ deaths: [0, 0] }],
        results: [
          { placement: 1, kills: 2 },
          { placement: 5, kills: 1 }
        ]
      }
    ]
  };
  const statsWithZeroDeaths = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: tableWithZeroDeaths }
  });
  const kdWithZeroDeaths = statsWithZeroDeaths.core.find((item) => item.id === 'kd');
  // Когда deaths = 0, но kills > 0, K/D = Infinity
  assert.equal(kdWithZeroDeaths?.displayValue, '∞');
});

test('все core метрики показывают "—" при отсутствии данных', () => {
  const profile = { name: 'PlayerA', history: [] };
  const stats = buildPlayerStats('PlayerA', {
    profile,
    tournaments: [baseTournament],
    tablesById: { t1: baseTable }
  });

  const rating = stats.core.find((item) => item.id === 'rating');
  const avgPlace = stats.core.find((item) => item.id === 'avg_place');
  const killsPerMatch = stats.core.find((item) => item.id === 'kills_per_match');
  const winrate = stats.core.find((item) => item.id === 'winrate');
  const topRate = stats.core.find((item) => item.id === 'top_rate');
  const kd = stats.core.find((item) => item.id === 'kd');

  assert.equal(rating?.displayValue, '—');
  assert.equal(avgPlace?.displayValue, '—');
  assert.equal(killsPerMatch?.displayValue, '—');
  assert.equal(winrate?.displayValue, '—');
  assert.equal(topRate?.displayValue, '—');
  assert.equal(kd?.displayValue, '—');
});
