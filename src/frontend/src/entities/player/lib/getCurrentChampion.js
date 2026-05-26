import { tournamentApi } from '@/services/api';
import {
  filterTournaments,
  isTestChampionTeam,
} from '@/utils/testDataFilters';

/**
 * Возвращает текущего чемпиона: победитель последнего завершённого турнира.
 * Чемпион может быть командой (squad/duo/mixed) или соло-игроком (solo).
 * @returns {Promise<{ tournamentId: string, tournamentName: string, championName: string, championScore: number, championType: 'team'|'solo', bestKillName?: string, bestKillValue?: number, top3: Array<{ rank: number, name: string }> } | null>}
 */
export async function getCurrentChampion() {
  const tournaments = filterTournaments(await tournamentApi.getAll());
  const completed = tournaments
    .filter((t) => t.state === 'Турнир окончен' || t.state === 'DONE')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const last of completed) {
    const tournamentId = last.id || last._id;
    let table;
    try {
      table = await tournamentApi.getTable(tournamentId);
    } catch {
      continue;
    }

    const teams = table?.teams || [];
    const sorted = teams
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const top1 = sorted[0];
    if (!top1 || isTestChampionTeam(top1)) continue;

    return buildChampionPayload(last, top1, sorted, teams);
  }

  return null;
}

function buildChampionPayload(last, top1, sorted, teams) {
  const tournamentId = last.id || last._id;

  const championType = (last.type || '').toLowerCase() === 'solo' ? 'solo' : 'team';
  const championName = top1.name || '—';
  const championScore = top1.totalPoints ?? 0;

  const top3 = sorted.slice(0, 3).map((t) => ({
    rank: t.rank ?? 0,
    name: t.name || '—',
  }));

  // Команда/игрок с наибольшим количеством киллов
  let bestKillName = null;
  let bestKillValue = null;
  const withKills = teams.map((t) => {
    const k = (t.results || []).reduce((s, r) => s + (r?.kills ?? 0), 0);
    return { name: t.name, kills: k };
  });
  const best = withKills.reduce((prev, curr) => (curr.kills > (prev?.kills ?? -1) ? curr : prev), null);
  if (best && best.kills > 0) {
    bestKillName = best.name;
    bestKillValue = best.kills;
  }

  return {
    tournamentId,
    tournamentName: last.name || 'Турнир',
    championName,
    championScore,
    championType,
    ...(bestKillName != null && bestKillValue != null && { bestKillName, bestKillValue }),
    top3,
  };
}
