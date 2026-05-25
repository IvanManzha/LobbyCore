import {
  RawTable,
  RawTournament,
  NormalizedTournament,
  NormalizedMatch,
  TournamentStatus,
  PlayerHistoryEntry
} from './types';
import { normalizeMode, parseNumeric } from './helpers';

export const getTournamentStatus = (rawState?: string | null): TournamentStatus => {
  if (rawState === 'Турнир окончен') return 'DONE';
  if (rawState === 'В процессе') return 'LIVE';
  return 'REG';
};

export const normalizeTournament = (
  rawTournament: RawTournament,
  rawTable?: RawTable | null
): NormalizedTournament => {
  const id = rawTournament.id || rawTournament._id || rawTable?.tournament?.id || 'unknown';
  const name = rawTournament.name || rawTable?.tournament?.name || 'Турнир';
  const date = rawTournament.date || null;
  const mode = normalizeMode(rawTournament.type || rawTable?.tournament?.type);
  const status = getTournamentStatus(rawTournament.state);
  const roundsCount =
    rawTournament.rounds ||
    rawTable?.tournament?.rounds ||
    rawTable?.teams?.[0]?.results?.length ||
    0;
  const participantsCount = rawTable?.teams?.length ?? null;
  const scoringPlacement = rawTable?.tournament?.scoring?.placement || rawTournament.scoring?.placement || {};
  const scoringPerKill = rawTable?.tournament?.scoring?.per_kill ?? rawTournament.scoring?.per_kill ?? 0;

  return {
    id,
    name,
    date,
    mode,
    status,
    roundsCount,
    participantsCount,
    scoring: {
      placement: scoringPlacement,
      perKill: scoringPerKill
    }
  };
};

const countParticipantsForRound = (teams: RawTable['teams'], roundIndex: number): number | null => {
  if (!teams) return null;
  const count = teams.filter((team) => {
    const placement = team.results?.[roundIndex]?.placement;
    return typeof placement === 'number';
  }).length;
  return count > 0 ? count : null;
};

export const extractPlayerMatchesFromTable = (
  playerName: string,
  rawTournament: RawTournament,
  rawTable: RawTable
): NormalizedMatch[] => {
  if (!rawTable?.teams || rawTable.teams.length === 0) return [];

  const normalizedTournament = normalizeTournament(rawTournament, rawTable);
  const teams = rawTable.teams;
  const isSolo = normalizedTournament.mode === 'solo';

  const team = teams.find((candidate) => {
    if (isSolo) return candidate.name === playerName;
    return (candidate.players || []).includes(playerName);
  });

  if (!team) return [];

  const playerIndex = isSolo ? 0 : (team.players || []).indexOf(playerName);
  const results = team.results || [];
  const roundCount = normalizedTournament.roundsCount || results.length;
  const matches: NormalizedMatch[] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const result = results[roundIndex];
    const placement = parseNumeric(result?.placement ?? null);
    const kills = isSolo
      ? parseNumeric(result?.kills ?? null)
      : parseNumeric(team.playerKills?.[playerIndex]?.kills?.[roundIndex] ?? null);
    const deaths = parseNumeric(team.playerDeaths?.[playerIndex]?.deaths?.[roundIndex] ?? null);
    const participantsCount = countParticipantsForRound(teams, roundIndex);
    const placementPoints = placement != null
      ? normalizedTournament.scoring.placement[placement] || 0
      : null;
    const killPoints = kills != null
      ? kills * normalizedTournament.scoring.perKill
      : 0;
    const points = placementPoints != null ? placementPoints + killPoints : null;

    matches.push({
      tournamentId: normalizedTournament.id,
      tournamentName: normalizedTournament.name,
      date: normalizedTournament.date,
      mode: normalizedTournament.mode,
      status: normalizedTournament.status,
      roundIndex,
      placement,
      points,
      kills,
      deaths,
      participantsCount
    });
  }

  return matches;
};

export const fallbackMatchFromHistory = (
  entry: PlayerHistoryEntry | undefined,
  rawTournament: RawTournament
): NormalizedMatch[] => {
  if (!entry) return [];
  const normalizedTournament = normalizeTournament(rawTournament, null);
  const placement = parseNumeric(entry.place ?? null);
  const kills = parseNumeric(entry.personalKills ?? null);
  const deaths = parseNumeric(entry.personalDeaths ?? null);
  const points = parseNumeric(entry.points ?? null);

  return [
    {
      tournamentId: normalizedTournament.id,
      tournamentName: entry.tournamentName || normalizedTournament.name,
      date: entry.date || normalizedTournament.date,
      mode: normalizedTournament.mode,
      status: normalizedTournament.status,
      roundIndex: 0,
      placement,
      points,
      kills,
      deaths,
      participantsCount: null
    }
  ];
};
