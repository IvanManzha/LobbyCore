import {
  LeaderboardRow,
  RawTable,
  RawTournament,
  TournamentLeaderboardResponse
} from './types';
import { buildCoverage } from './helpers';
import { getTournamentStatus, normalizeTournament } from './normalize';

export const buildTournamentLeaderboard = (
  rawTournament: RawTournament,
  rawTable: RawTable
): TournamentLeaderboardResponse => {
  const normalized = normalizeTournament(rawTournament, rawTable);

  const rows: LeaderboardRow[] = (rawTable.teams || []).map((team) => {
    const results = team.results || [];
    const completedMatches = results.filter((result) => result?.placement != null);
    const killsTrackedMatches = results.filter((result) => result?.kills != null).length;
    const totalKills = results.reduce((sum, result) => sum + (result?.kills || 0), 0);

    return {
      rank: team.rank ?? null,
      name: team.name || 'Команда',
      players: team.players || (team.name ? [team.name] : []),
      totalPoints: team.totalPoints || 0,
      totalKills,
      matchesPlayed: completedMatches.length,
      killsCoverage: buildCoverage(
        killsTrackedMatches,
        completedMatches.length,
        `Kills tracked: ${killsTrackedMatches}/${completedMatches.length}`
      )
    };
  });

  return {
    tournamentId: normalized.id,
    tournamentName: normalized.name,
    status: getTournamentStatus(rawTournament.state),
    mode: normalized.mode,
    roundsCount: normalized.roundsCount,
    rows
  };
};
