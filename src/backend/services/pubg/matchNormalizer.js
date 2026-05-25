/**
 * Build normalized match.json from PUBG API match response.
 * @param {string} matchId
 * @param {Object} apiMatch - response from getMatch (data with data.included, data.attributes)
 * @returns {import('./pubgContracts').MatchMeta}
 */
function normalizeMatch(matchId, apiMatch) {
  const data = apiMatch.data || apiMatch;
  const attrs = data.attributes || {};
  const included = apiMatch.included || data.included || [];

  const participants = included
    .filter((i) => i.type === 'participant')
    .map((p) => {
      const stats = p.attributes?.stats || p.attributes || {};
      const accountId = stats.playerId || stats.actor || p.id || '';
      const name = stats.name || stats.playerName || '';
      return {
        accountId: String(accountId),
        name: String(name),
        teamId: stats.teamId != null ? String(stats.teamId) : undefined,
        stats: {
          kills: stats.kills,
          damage: stats.damageDealt ?? stats.damage,
          placement: stats.winPlace ?? stats.placement,
        },
      };
    })
    .filter((p) => p.accountId);

  const rosters = included
    .filter((i) => i.type === 'roster')
    .map((r) => ({
      teamId: r.attributes?.teamId ?? r.id,
      rosterId: r.id,
    }));

  const createdAt = attrs.createdAt || attrs.created_at;
  const startedAt = createdAt ? (typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString()) : undefined;

  return {
    matchId,
    mapName: attrs.mapName || attrs.map_name || '',
    startedAt,
    durationSec: attrs.duration,
    isCustomMatch: attrs.isCustomMatch === true,
    participants,
    rosters,
  };
}

module.exports = {
  normalizeMatch,
};
