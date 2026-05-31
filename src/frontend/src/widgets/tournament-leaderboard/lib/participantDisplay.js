export function getParticipantPlayerCount(players, fallbackName) {
  const list = Array.isArray(players) ? players : fallbackName ? [fallbackName] : [];
  return list.length;
}

/** Solo-турнир или «команда» из одного игрока (mixed/duo/squad). */
export function isSoloLikeParticipant({ tournamentType, players, name }) {
  if (tournamentType === 'solo') return true;
  return getParticipantPlayerCount(players, name) <= 1;
}

export function getParticipantPerformanceLink(tournamentId, tournamentType, name, players) {
  if (!tournamentId) return `/player/${encodeURIComponent(name)}`;
  if (isSoloLikeParticipant({ tournamentType, players, name })) {
    return `/tournament/${tournamentId}/solo/${encodeURIComponent(name)}`;
  }
  return `/tournament/${tournamentId}/team/${encodeURIComponent(name)}`;
}
