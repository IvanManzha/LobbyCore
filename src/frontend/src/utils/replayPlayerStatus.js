/**
 * Статус игрока на момент времени по ленте событий (без отдельного API состояния).
 * @typedef {'alive' | 'knocked' | 'dead'} PlayerLifeStatus
 */

/**
 * @param {string} playerId
 * @param {Array<{ t: number, type: string, actor?: object, target?: object }>} events
 * @param {number} currentTimeSec
 * @returns {PlayerLifeStatus}
 */
export function getPlayerStatusAtTime(playerId, events, currentTimeSec) {
  if (!playerId || !Array.isArray(events)) return "alive";
  // Предполагаем, что events уже отсортированы по t (backend делает sort).
  // На всякий случай: если порядок подозрительный — сортируем как fallback.
  const evs = events;
  if (evs.length > 1) {
    const firstT = Number(evs[0]?.t) || 0;
    const lastT = Number(evs[evs.length - 1]?.t) || 0;
    if (firstT > lastT) {
      return getPlayerStatusAtTime(playerId, [...evs].sort((a, b) => (a.t ?? 0) - (b.t ?? 0)), currentTimeSec);
    }
  }

  let knocked = false;
  const tMax = Number(currentTimeSec) || 0;
  for (const e of evs) {
    const t = Number(e?.t) || 0;
    if (t > tMax) break;

    const type = e.type;
    if (type === "DEATH" && e.target?.id === playerId) return "dead";
    if (type === "KILL" && e.target?.id === playerId) return "dead";
    if (type === "KNOCK" && e.target?.id === playerId) knocked = true;
    if (type === "REVIVE" && e.target?.id === playerId) knocked = false;
  }

  return knocked ? "knocked" : "alive";
}

/**
 * Суммарные киллы игрока до текущего времени (KILL с actor.id === playerId).
 */
export function countPlayerKillsUpTo(playerId, events, currentTimeSec) {
  if (!playerId || !Array.isArray(events)) return 0;
  let n = 0;
  for (const e of events) {
    if ((e.t ?? 0) > currentTimeSec) break;
    if (e.type === "KILL" && e.actor?.id === playerId) n += 1;
  }
  return n;
}

/**
 * Киллы команды до текущего времени.
 */
export function countTeamKillsUpTo(teamId, events, currentTimeSec) {
  if (teamId == null || teamId === "" || !Array.isArray(events)) return 0;
  const tid = String(teamId);
  let n = 0;
  for (const e of events) {
    if ((e.t ?? 0) > currentTimeSec) break;
    if (e.type === "KILL" && e.actor?.teamId != null && String(e.actor.teamId) === tid) n += 1;
  }
  return n;
}
