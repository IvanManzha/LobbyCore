/**
 * Нормализация сессии реплея: треки по игрокам, команда из событий.
 */

/**
 * true, если матч «как соло» для UI (нет составов 2+ с одним teamId из API-ростера).
 * Не использовать collectReplayRoster — там solo превращается в уникальные teamId.
 */
export function isSoloLikeSession(session) {
  const fromRoster = session?.roster || [];
  const counts = new Map();
  for (const p of fromRoster) {
    if (p?.teamId == null || String(p.teamId) === "") continue;
    const tid = String(p.teamId);
    counts.set(tid, (counts.get(tid) || 0) + 1);
  }
  if (counts.size === 0) return true;
  const maxSize = Math.max(...counts.values());
  return maxSize <= 1;
}

/**
 * Игроки с непустым треком после фильтра фазы самолёта (см. buildPlayerTrackList).
 */
export function getReplayActivePlayerIds(session) {
  return new Set(buildPlayerTrackList(session).map((t) => t.playerId).filter(Boolean));
}

/**
 * Оставляет в ростере только игроков, которых реально рисуем на карте.
 */
export function filterRosterToActivePlayers(session, roster) {
  if (!Array.isArray(roster) || roster.length === 0) return roster;
  const active = getReplayActivePlayerIds(session);
  if (active.size === 0) return roster;
  return roster.filter((p) => p?.id && active.has(p.id));
}

/**
 * @param {import('../services/dnaMapSessionContract').DnaMapSession | null} session
 * @param {string} playerId
 * @returns {string | null}
 */
export function getTeamIdForPlayer(session, playerId) {
  if (!playerId) return null;
  const roster = collectReplayRoster(session);
  const hit = roster.find((p) => p.id === playerId);
  if (hit?.teamId != null && hit.teamId !== "") return String(hit.teamId);
  if (!session?.events) return null;
  for (const e of session.events) {
    if (e.actor?.id === playerId && e.actor?.teamId != null) return String(e.actor.teamId);
    if (e.target?.id === playerId && e.target?.teamId != null) return String(e.target.teamId);
  }
  return null;
}

/**
 * Список игроков с label/teamId из сущностей и событий.
 * @returns {Array<{ id: string, label: string, teamId: string | null }>}
 */
export function collectReplayRoster(session) {
  const players = new Map();
  for (const r of session?.roster || []) {
    if (!r?.id) continue;
    players.set(r.id, {
      id: r.id,
      label: r.label || String(r.id),
      teamId: r.teamId != null ? String(r.teamId) : null,
    });
  }
  const addEnt = (ent) => {
    if (!ent?.id) return;
    const prev = players.get(ent.id) || {};
    players.set(ent.id, {
      id: ent.id,
      label: ent.label || prev.label || String(ent.id),
      teamId: ent.teamId ?? prev.teamId ?? null,
    });
  };
  if (session?.entities?.primary) addEnt(session.entities.primary);
  if (session?.entities?.secondary) addEnt(session.entities.secondary);
  for (const e of session?.events || []) {
    addEnt(e.actor);
    addEnt(e.target);
  }
  const roster = Array.from(players.values());
  if (!roster.length) return roster;

  const explicit = roster.filter((p) => p.teamId != null && String(p.teamId) !== "");
  const counts = new Map();
  explicit.forEach((p) => {
    const tid = String(p.teamId);
    counts.set(tid, (counts.get(tid) || 0) + 1);
  });
  const maxTeamSize = counts.size ? Math.max(...Array.from(counts.values())) : 0;

  // SOLO (или data без явных teamId): каждый игрок — "своя команда" для цвета/фокуса.
  const soloLike = maxTeamSize <= 1;
  if (soloLike) {
    return roster.map((p) => ({ ...p, teamId: p.id }));
  }

  // DUO/TRIO/SQUAD+: сохраняем реальные команды; отсутствующие teamId делаем уникальными,
  // чтобы игрок не выпадал в "серый" и оставался детерминированно окрашен.
  return roster.map((p) => (p.teamId == null || String(p.teamId) === "" ? { ...p, teamId: p.id } : p));
}

/**
 * Уникальные teamId, отсортированные.
 * @param {Array<{ teamId?: string | null }>} roster
 */
export function sortedTeamIdsFromRoster(roster) {
  const s = new Set();
  roster.forEach((p) => {
    if (p.teamId != null && p.teamId !== "") s.add(String(p.teamId));
  });
  return Array.from(s).sort();
}

/**
 * Линейная интерполяция x/y: между соседними точками телеметрии вставляются точки с шагом 1 с по времени
 * (при исходном шаге ~5 с получается 4 промежуточные точки на сегмент).
 * @param {Array<{ t?: number, x?: number, y?: number, meta?: object }>} points
 */
export function densifyTrackPointsToOneSecond(points) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const sorted = [...points].sort((a, b) => (Number(a?.t) || 0) - (Number(b?.t) || 0));
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    out.push(a);
    if (i >= sorted.length - 1) break;
    const b = sorted[i + 1];
    const t0 = Number(a?.t) || 0;
    const t1 = Number(b?.t) || 0;
    if (!(t1 > t0)) continue;
    const x0 = Number(a?.x) || 0;
    const y0 = Number(a?.y) || 0;
    const x1 = Number(b?.x) || 0;
    const y1 = Number(b?.y) || 0;
    const metaA = a?.meta && typeof a.meta === "object" ? a.meta : {};
    let t = Math.ceil(t0);
    while (t < t1) {
      const u = (t - t0) / (t1 - t0);
      out.push({
        t,
        x: x0 + (x1 - x0) * u,
        y: y0 + (y1 - y0) * u,
        meta: { ...metaA, interpolated: true },
      });
      t += 1;
    }
  }
  return out;
}

/**
 * @typedef {{ playerId: string, teamId: string | null, points: Array<{ t: number, x: number, y: number }> }} PlayerTrackEntry
 *
 * @param {import('../services/dnaMapSessionContract').DnaMapSession | null} session
 * @returns {PlayerTrackEntry[]}
 */
export function buildPlayerTrackList(session) {
  const roster = collectReplayRoster(session);
  const teamByPlayerId = new Map(roster.map((r) => [r.id, r.teamId ?? null]));
  const byPlayer = session?.tracks?.byPlayer;
  let result = [];
  if (byPlayer && typeof byPlayer === "object" && !Array.isArray(byPlayer)) {
    const direct = Object.entries(byPlayer).map(([playerId, points]) => ({
      playerId,
      teamId: teamByPlayerId.get(playerId) ?? getTeamIdForPlayer(session, playerId),
      points: Array.isArray(points) ? points : [],
    }));
    if (direct.some((x) => Array.isArray(x.points) && x.points.length > 0)) {
      result = direct;
    }
  }

  if (!result.length) {
    const out = [];
  const prim = session?.entities?.primary;
  const sec = session?.entities?.secondary;
  if (prim?.id && session?.tracks?.primary?.length) {
    out.push({
      playerId: prim.id,
        teamId:
          teamByPlayerId.get(prim.id) ??
          getTeamIdForPlayer(session, prim.id) ??
          (prim.teamId != null ? String(prim.teamId) : null),
      points: session.tracks.primary,
    });
  }
  if (sec?.id && session?.tracks?.secondary?.length) {
    out.push({
      playerId: sec.id,
        teamId:
          teamByPlayerId.get(sec.id) ??
          getTeamIdForPlayer(session, sec.id) ??
          (sec.teamId != null ? String(sec.teamId) : null),
      points: session.tracks.secondary,
    });
  }
    if (out.length > 0) result = out;
  }

  // Fallback: построить "лёгкие" треки по событиям, чтобы показывать всех доступных игроков на карте.
  if (!result.length) {
    const events = Array.isArray(session?.events) ? session.events : [];
    if (events.length === 0) return [];
    const byEventPlayer = new Map();
    const pushPoint = (id, t, x, y) => {
      if (!id || x == null || y == null) return;
      if (!byEventPlayer.has(id)) byEventPlayer.set(id, []);
      byEventPlayer.get(id).push({ t: Number(t) || 0, x, y, meta: {} });
    };
    for (const e of events) {
      pushPoint(e.actor?.id, e.t, e.x, e.y);
      pushPoint(e.target?.id, e.t, e.x, e.y);
    }
    const rosterIds = new Set(roster.map((r) => r.id).filter(Boolean));
    const built = [];
    for (const [playerId, pts] of byEventPlayer.entries()) {
      if (rosterIds.size && !rosterIds.has(playerId)) continue;
      const sorted = pts.sort((a, b) => (a.t || 0) - (b.t || 0));
      if (sorted.length === 0) continue;
      built.push({
        playerId,
        teamId: teamByPlayerId.get(playerId) ?? getTeamIdForPlayer(session, playerId),
        points: sorted,
      });
    }
    result = built;
  }

  if (!result.length) return [];

  // Режем треки до первого выхода из транспорта (эвристика: VEHICLE_EXIT актёра).
  // Это отсекает самолётную фазу и уменьшает "мусор".
  const events = Array.isArray(session?.events) ? session.events : [];
  const firstVehicleExitTByPlayer = new Map();
  for (const e of events) {
    if (e?.type !== "VEHICLE_EXIT") continue;
    const pid = e?.actor?.id;
    if (!pid) continue;
    const t = Number(e?.t) || 0;
    const prev = firstVehicleExitTByPlayer.get(pid);
    if (prev == null || t < prev) firstVehicleExitTByPlayer.set(pid, t);
  }

  const exitTs = Array.from(firstVehicleExitTByPlayer.values());
  const globalPlaneEndT = exitTs.length > 0 ? Math.min(...exitTs) : null;

  const filtered = result
    .map((entry) => {
      const ownExit = firstVehicleExitTByPlayer.get(entry.playerId);
      const cutoffT = ownExit != null ? ownExit : globalPlaneEndT;
      if (cutoffT == null) return entry;
      const pts = Array.isArray(entry.points) ? entry.points.filter((p) => Number(p?.t) >= cutoffT) : [];
      return { ...entry, points: pts };
    })
    .filter((e) => Array.isArray(e.points) && e.points.length > 0);

  return filtered.map((entry) => ({
    ...entry,
    points: densifyTrackPointsToOneSecond(entry.points),
  }));
}

/**
 * События, связанные с командой (актор или цель в команде).
 */
export function filterEventsForTeam(events, teamId) {
  if (!teamId || !Array.isArray(events)) return [];
  const tid = String(teamId);
  return events.filter((e) => {
    const a = e.actor?.teamId != null ? String(e.actor.teamId) : null;
    const t = e.target?.teamId != null ? String(e.target.teamId) : null;
    return a === tid || t === tid;
  });
}

/**
 * События, где игрок — актор или цель.
 */
export function filterEventsForPlayer(events, playerId) {
  if (!playerId || !Array.isArray(events)) return [];
  return events.filter(
    (e) => e.actor?.id === playerId || e.target?.id === playerId
  );
}
