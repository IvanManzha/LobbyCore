import React, { useMemo, useRef, useState } from "react";
import MapCanvas from "../dna-map/MapCanvas";
import Timeline from "../dna-map/Timeline";
import EventFeed from "../dna-map/EventFeed";
import { getMapImageQualityUrls } from "../../config/pubgMaps";
import { useMapScrollQuality } from "../../hooks/useMapScrollQuality";
import MapQualityBackground from "./MapQualityBackground";
import { interpolateZoneAtTime } from "../../utils/mapZoneInterpolation";
import {
  collectReplayRoster,
  sortedTeamIdsFromRoster,
  getTeamIdForPlayer,
  isSoloLikeSession,
  filterRosterToActivePlayers,
} from "../../utils/replaySessionModel";
import { getStableTeamColor } from "../../utils/replayTeamColors";
import {
  getPlayerStatusAtTime,
  countPlayerKillsUpTo,
  countTeamKillsUpTo,
} from "../../utils/replayPlayerStatus";
import "./DnaReplayViewerShell.css";

function formatReplayTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function displayPlayerLabel(p) {
  if (!p?.label) return "Игрок";
  const s = String(p.label);
  if (/^[0-9a-f-]{32,}$/i.test(s)) return `Игрок ${s.slice(0, 6)}…`;
  return s;
}

function uniqueTeams(roster) {
  const s = new Set();
  roster.forEach((p) => {
    if (p.teamId != null && p.teamId !== "") s.add(String(p.teamId));
  });
  return Array.from(s).sort();
}

function StatusBadge({ status }) {
  const label = status === "dead" ? "Мёртв" : status === "knocked" ? "Нок" : "Жив";
  return <span className={`dna-replay-status dna-replay-status--${status}`}>{label}</span>;
}

/** Tactical Replay Viewer — фазы select / immersing / replay и layout реплея. */
export default function DnaReplayViewerShell({ studio }) {
  const rootRef = useRef(null);
  const {
    session,
    loading,
    error,
    currentTimeSec,
    seekCurrentTimeSec,
    selectedEventId,
    selectedFightId,
    setSelectedEventId,
    setSelectedFightId,
    layers,
    eventFilters,
    setLayers,
    setEventFilters,
    handleFocusDeath,
    handleFocusPoint,
    focusPoint,
    setFocusPoint,
    matchId,
    primaryId,
    isolateFightId,
    setIsolateFightId,
    isPlaying,
    playSpeed,
    togglePlayPause,
    setPlaySpeed,
    tournaments,
    loadingTournaments,
    selectedTournamentId,
    tournamentMatches,
    loadingTournamentMatches,
    onTournamentChange,
    onTournamentMatchSelect,
    replayPhase,
    feedUnlockedAfterPlay,
    feedCollapsed,
    setFeedCollapsed,
    focusTeamId,
    setFocusTeamId,
    focusPlayerId,
    setFocusPlayerId,
    playerSearchQuery,
    setPlayerSearchQuery,
    enterReplayMatch,
    resetReplayFocus,
    lastTestMatchId,
    loadingLastTestMatch,
    applyLastTestMatchFromTestDb,
    devTools,
    effectiveDnaTest,
  } = studio;

  const showTestDbDevActions = Boolean(devTools && effectiveDnaTest);

  const mapCanvasRef = useRef(null);
  const [hoverPlayerId, setHoverPlayerId] = useState(null);

  const selectedMatchMeta = useMemo(
    () => tournamentMatches.find((m) => String(m.matchId) === String(matchId)) ?? null,
    [tournamentMatches, matchId]
  );

  const mapQualityUrls = useMemo(
    () => getMapImageQualityUrls(selectedMatchMeta?.mapName),
    [selectedMatchMeta?.mapName]
  );
  const mapScrollQuality = useMapScrollQuality(rootRef, {
    enabled: replayPhase === "select" || replayPhase === "immersing",
    lowUrl: mapQualityUrls.low,
    highUrl: mapQualityUrls.high,
  });

  const rosterAll = useMemo(() => collectReplayRoster(session), [session]);
  const roster = useMemo(
    () => filterRosterToActivePlayers(session, rosterAll),
    [session, rosterAll]
  );
  const teamGameMode = useMemo(() => !isSoloLikeSession(session), [session]);
  const teams = useMemo(() => uniqueTeams(roster), [roster]);
  const sortedTeamIds = useMemo(() => sortedTeamIdsFromRoster(roster), [roster]);
  const focusMode = focusPlayerId ? "player" : focusTeamId ? "team" : "none";

  const zonePhaseHint = useMemo(() => {
    const snaps = session?.zoneSnapshots;
    if (!Array.isArray(snaps) || snaps.length === 0) {
      return "Фаза ? · Команд: ?";
    }
    const z = interpolateZoneAtTime(snaps, currentTimeSec);
    if (!z?.safe?.r || z.safe.r <= 0) return "Фаза ? · Команд: ?";
    const phase = Math.max(1, Math.min(8, Math.round((1 - z.safe.r / 220000) * 8)));
    const teamCount = new Set(roster.map((p) => String(p.teamId ?? ""))).size;
    return `Фаза ${phase} · Команд: ${teamCount}`;
  }, [session?.zoneSnapshots, currentTimeSec, roster]);

  const filteredRoster = useMemo(() => {
    const q = (playerSearchQuery || "").trim().toLowerCase();
    let list = roster;
    if (focusPlayerId && teamGameMode) {
      const tid = getTeamIdForPlayer(session, focusPlayerId);
      if (tid != null) list = roster.filter((p) => String(p.teamId ?? "") === String(tid));
      else list = roster.filter((p) => p.id === focusPlayerId);
    } else if (focusPlayerId && !teamGameMode) {
      list = roster.filter((p) => p.id === focusPlayerId);
    } else if (focusTeamId) {
      list = roster.filter((p) => String(p.teamId ?? "") === String(focusTeamId));
    }
    if (!q) return list;
    return list.filter((p) => String(p.label || "").toLowerCase().includes(q));
  }, [roster, playerSearchQuery, focusTeamId, focusPlayerId, teamGameMode, session]);

  const groupedRoster = useMemo(() => {
    const groups = new Map();
    filteredRoster.forEach((p) => {
      const tid = p.teamId != null && p.teamId !== "" ? String(p.teamId) : "_nogroup";
      if (!groups.has(tid)) groups.set(tid, []);
      groups.get(tid).push(p);
    });
    const ordered = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "_nogroup") return 1;
      if (b[0] === "_nogroup") return -1;
      return Number(a[0]) - Number(b[0]);
    });
    ordered.forEach(([, list]) => list.sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "ru")));
    return ordered;
  }, [filteredRoster]);

  const selectedEvent = useMemo(
    () => session?.events?.find((e) => e.id === selectedEventId) ?? null,
    [session?.events, selectedEventId]
  );

  const eventsList = session?.events ?? [];

  const aliveStatsHint = useMemo(() => {
    if (!roster.length) return "Игроки: нет данных";
    const alive = roster.filter(
      (p) => getPlayerStatusAtTime(p.id, eventsList, currentTimeSec) !== "dead"
    ).length;
    return `Живых на таймкоде: ${alive} / ${roster.length}`;
  }, [roster, eventsList, currentTimeSec]);

  const focusedTeamStats = useMemo(() => {
    if (!focusTeamId || !session) return null;
    const members = roster.filter((p) => String(p.teamId ?? "") === String(focusTeamId));
    const alive = members.filter(
      (p) => getPlayerStatusAtTime(p.id, eventsList, currentTimeSec) !== "dead"
    ).length;
    const kills = countTeamKillsUpTo(focusTeamId, eventsList, currentTimeSec);
    return { total: members.length, alive, kills };
  }, [focusTeamId, roster, session, eventsList, currentTimeSec]);

  const focusedPlayerRow = useMemo(
    () => (focusPlayerId ? roster.find((r) => r.id === focusPlayerId) : null),
    [roster, focusPlayerId]
  );

  const focusedPlayerKills = useMemo(
    () => (focusPlayerId ? countPlayerKillsUpTo(focusPlayerId, eventsList, currentTimeSec) : 0),
    [focusPlayerId, eventsList, currentTimeSec]
  );

  const onTeamFilterChange = (tid) => {
    setFocusTeamId(tid || null);
    setFocusPlayerId(null); // player focus only by roster click
  };

  const onPlayerPick = (pid) => {
    if (!pid) return;
    setFocusPlayerId(pid);
    const pl = roster.find((r) => r.id === pid);
    if (pl?.teamId != null && pl.teamId !== "") setFocusTeamId(String(pl.teamId));
  };

  const focusTeamOnlyFromPlayer = () => {
    if (!focusPlayerId) return;
    const pl = roster.find((r) => r.id === focusPlayerId);
    setFocusPlayerId(null);
    if (pl?.teamId != null && pl.teamId !== "") setFocusTeamId(String(pl.teamId));
  };

  const toolbarMeta = useMemo(() => {
    const mapName = session?.match?.mapName || selectedMatchMeta?.mapName || "Карта";
    const startedAt = session?.match?.startedAt || selectedMatchMeta?.startedAt || null;
    const dt = startedAt ? new Date(startedAt) : null;
    const d = dt ? dt.toLocaleDateString("ru-RU") : "—";
    const t = dt ? dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—";
    return `${mapName} • ${d} • ${t} • Карта`;
  }, [session?.match?.mapName, session?.match?.startedAt, selectedMatchMeta?.mapName, selectedMatchMeta?.startedAt]);

  if (replayPhase === "select") {
    return (
      <div className="dna-replay-root dna-replay-root--select" ref={rootRef}>
        {mapQualityUrls.low || mapQualityUrls.high ? (
          <div className="dna-replay-immerse-map-layer dna-replay-select-map-bg">
            <MapQualityBackground
              lowUrl={mapQualityUrls.low}
              highUrl={mapQualityUrls.high}
              quality={mapScrollQuality.quality}
            />
          </div>
        ) : null}
        <div className="dna-replay-select">
          <div className="dna-replay-select-panel">
            <div className="dna-replay-select-title">Выберите матч турнира для реплея</div>
            {error && <div className="dna-replay-err">{error}</div>}

            <div className="dna-replay-select-grid">
              <div className="dna-replay-field">
                <div className="dna-replay-label">Турнир</div>
                <select
                  className="dna-replay-field-select"
                  value={selectedTournamentId}
                  disabled={loadingTournaments || tournaments.length === 0 || loading}
                  onChange={(e) => onTournamentChange?.(e.target.value)}
                >
                  <option value="">{loadingTournaments ? "Загрузка..." : "Выберите турнир"}</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dna-replay-field">
                <div className="dna-replay-label">Матч</div>
                <select
                  className="dna-replay-field-select"
                  value={matchId || ""}
                  disabled={
                    loading || loadingTournamentMatches || !selectedTournamentId || tournamentMatches.length === 0
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next) return;
                    onTournamentMatchSelect?.(next);
                  }}
                >
                  <option value="">{loadingTournamentMatches ? "Загрузка..." : "Выберите матч"}</option>
                  {tournamentMatches.map((m) => (
                    <option key={m.matchId} value={m.matchId}>
                      {m.mapName || m.matchId}
                      {m.startedAt ? ` • ${new Date(m.startedAt).toLocaleDateString()}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="dna-replay-select-hint">
              Primary: <strong>{primaryId}</strong>. Карта и таймлайн появятся только после «Погрузиться в матч».
            </div>

            <div className="dna-replay-select-actions">
              {showTestDbDevActions ? (
                lastTestMatchId ? (
                  <button
                    type="button"
                    className="dna-replay-btn-ghost"
                    disabled={loadingLastTestMatch || loading}
                    onClick={applyLastTestMatchFromTestDb}
                  >
                    {loadingLastTestMatch ? "Загрузка…" : "Последний матч из test DB"}
                  </button>
                ) : (
                  !loadingLastTestMatch && (
                    <span className="dna-replay-select-muted">
                      Нет last match в test DB — включите test DB в dev-настройках или выберите турнир/матч.
                    </span>
                  )
                )
              ) : null}
              <button
                type="button"
                className="dna-replay-btn-primary"
                disabled={!matchId?.trim() || loading}
                onClick={() => enterReplayMatch()}
              >
                Погрузиться в матч
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (replayPhase === "immersing") {
    return (
      <div className="dna-replay-root dna-replay-root--player" ref={rootRef}>
        <div className="dna-replay-stack">
          {mapQualityUrls.low || mapQualityUrls.high ? (
            <div className="dna-replay-immerse-map-layer">
              <MapQualityBackground
                lowUrl={mapQualityUrls.low}
                highUrl={mapQualityUrls.high}
                quality={mapScrollQuality.quality}
              />
            </div>
          ) : (
            <div className="dna-replay-immerse-map-fallback" aria-hidden />
          )}
          <div className="dna-replay-immerse-overlay" role="status" aria-live="polite">
            <div className="dna-replay-immerse-inner dnaLabShell--shortFade">
              <div className="dna-replay-immerse-title">Погружение в матч</div>
              <div className="dna-replay-immerse-sub">Загрузка телеметрии и построение сессии…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // replay: карта на весь слой, UI только поверх
  return (
    <div className="dna-replay-root dna-replay-root--player">
      <div className="dna-replay-stack">
        <div className="dna-replay-map-layer">
          <MapCanvas
            ref={mapCanvasRef}
            session={session}
            currentTimeSec={currentTimeSec}
            selectedEventId={selectedEventId}
            layers={layers}
            eventFilters={eventFilters}
            onSelectEvent={setSelectedEventId}
            onFocusPoint={handleFocusPoint}
            onResetView={() => {}}
            isolateFightId={isolateFightId}
            focusPoint={focusPoint}
            onFocusApplied={() => setFocusPoint(null)}
            zoomInOnly
            focusPlayerId={focusPlayerId}
            focusTeamId={focusTeamId}
            hoverPlayerId={hoverPlayerId}
            teamGameMode={teamGameMode}
            onPlayerMarkerClick={onPlayerPick}
          />
        </div>

        <div className="dna-replay-overlay">
          {error && (
            <div className="dna-replay-overlay-err">
              <div className="dna-replay-err">{error}</div>
            </div>
          )}

          <header className="dna-replay-topbar dna-replay-topbar--minimal">
            <div className="dna-replay-topbar-left">
              <span className="dna-replay-topbar-title">Replay</span>
            </div>
            <div className="dna-replay-topbar-right">
              <div className="dna-replay-layer-toggles" title="Слои карты">
                <label>
                  <input
                    type="checkbox"
                    checked={!!layers.path}
                    onChange={(e) => setLayers((L) => ({ ...L, path: e.target.checked }))}
                  />
                  Маршруты
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!layers.events}
                    onChange={(e) => setLayers((L) => ({ ...L, events: e.target.checked }))}
                  />
                  События
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!layers.zone}
                    onChange={(e) => setLayers((L) => ({ ...L, zone: e.target.checked }))}
                  />
                  Зона
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!layers.fights}
                    onChange={(e) => setLayers((L) => ({ ...L, fights: e.target.checked }))}
                  />
                  Бои
                </label>
              </div>
            </div>
          </header>

          <div className="dna-replay-mid">
          <aside className={`dna-replay-left dna-replay-left--mode-${focusMode}`}>
            <div className="dna-replay-left-head">
              <div className="dna-replay-left-title">Фокус</div>
              <div className="dna-replay-left-filters">
                <label className="dna-replay-filter">
                  <span>Команда</span>
                  <select
                    value={focusTeamId ?? ""}
                    onChange={(e) => onTeamFilterChange(e.target.value)}
                  >
                    <option value="">Все команды</option>
                    {teams.map((tid) => (
                      <option key={tid} value={tid}>
                        {tid}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="dna-replay-quick-actions">
                <button type="button" className="dna-replay-btn-ghost dna-replay-btn-tiny" onClick={resetReplayFocus}>
                  Показать всех
                </button>
                {focusPlayerId && (
                  <button
                    type="button"
                    className="dna-replay-btn-ghost dna-replay-btn-tiny"
                    onClick={focusTeamOnlyFromPlayer}
                  >
                    Только команда
                  </button>
                )}
              </div>
            </div>
            <input
              className="dna-replay-search"
              type="search"
              placeholder="Поиск по нику…"
              value={playerSearchQuery}
              onChange={(e) => setPlayerSearchQuery(e.target.value)}
              autoComplete="off"
            />

            {focusMode === "player" && focusedPlayerRow && (
              <div className="dna-replay-player-card dnaLabShell--shortFade">
                <div
                  className="dna-replay-player-card-accent"
                  style={{ background: getStableTeamColor(getTeamIdForPlayer(session, focusPlayerId), sortedTeamIds) }}
                />
                <div className="dna-replay-player-card-head">
                  <div className="dna-replay-player-card-name">{displayPlayerLabel(focusedPlayerRow)}</div>
                  <StatusBadge status={getPlayerStatusAtTime(focusPlayerId, eventsList, currentTimeSec)} />
                </div>
                <div className="dna-replay-player-card-meta">
                  <span>
                    Команда: <strong>{getTeamIdForPlayer(session, focusPlayerId) ?? "—"}</strong>
                  </span>
                  <span>
                    Киллы: <strong>{focusedPlayerKills}</strong>
                  </span>
                </div>
                <div className="dna-replay-player-card-meta muted">
                  Рейтинг / ранг: данные профиля появятся при связке с DNA-профилем.
                </div>
                <button
                  type="button"
                  className="dna-replay-btn-ghost dna-replay-btn-tiny"
                  onClick={() => {
                    setFocusPlayerId(null);
                    setHoverPlayerId(null);
                  }}
                >
                  Снять выбор игрока
                </button>
              </div>
            )}

            {(focusMode !== "player" || (teamGameMode && focusPlayerId)) && (
              <div className="dna-replay-roster">
                {filteredRoster.length === 0 && (
                  <div className="dna-replay-detail-placeholder">Нет игроков в списке (данные сессии ограничены).</div>
                )}
                {focusMode === "none" &&
                  filteredRoster.map((p) => {
                    const tid = p.teamId != null && p.teamId !== "" ? String(p.teamId) : "_nogroup";
                    const color =
                      tid === "_nogroup" ? "rgba(148,163,184,0.5)" : getStableTeamColor(tid, sortedTeamIds);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`dna-replay-roster-row ${focusPlayerId === p.id ? "is-active" : ""} ${
                          teamGameMode && focusPlayerId && p.id !== focusPlayerId ? "is-dimmed" : ""
                        }`}
                        onMouseEnter={() => setHoverPlayerId(p.id)}
                        onMouseLeave={() => setHoverPlayerId(null)}
                        onClick={() => onPlayerPick(p.id)}
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <span className="dna-replay-team-swatch sm" style={{ background: color }} />
                        <span className="dna-replay-roster-main">
                          <span className="dna-replay-roster-name">{displayPlayerLabel(p)}</span>
                          <span className="dna-replay-roster-sub">{tid === "_nogroup" ? "Без команды" : `Команда ${tid}`}</span>
                        </span>
                        <StatusBadge status={getPlayerStatusAtTime(p.id, eventsList, currentTimeSec)} />
                      </button>
                    );
                  })}
                {groupedRoster.map(([tid, players]) => {
                  const color = tid === "_nogroup" ? "rgba(148,163,184,0.6)" : getStableTeamColor(tid, sortedTeamIds);
                  return (
                    <div key={tid} className="dna-replay-roster-group">
                      <div className="dna-replay-roster-group-head">
                        <span className="dna-replay-team-swatch sm" style={{ background: color }} />
                        <span>{tid === "_nogroup" ? "Без команды" : `Команда ${tid}`}</span>
                      </div>
                      {players.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`dna-replay-roster-row ${focusPlayerId === p.id ? "is-active" : ""} ${
                            teamGameMode && focusPlayerId && p.id !== focusPlayerId ? "is-dimmed" : ""
                          }`}
                          onMouseEnter={() => setHoverPlayerId(p.id)}
                          onMouseLeave={() => setHoverPlayerId(null)}
                          onClick={() => onPlayerPick(p.id)}
                          style={{ borderLeft: `3px solid ${color}` }}
                        >
                          <span className="dna-replay-team-swatch sm" style={{ background: color }} />
                          <span className="dna-replay-roster-main">
                            <span className="dna-replay-roster-name">{displayPlayerLabel(p)}</span>
                            <span className="dna-replay-roster-sub">{tid === "_nogroup" ? "Без команды" : `Команда ${tid}`}</span>
                          </span>
                          <StatusBadge status={getPlayerStatusAtTime(p.id, eventsList, currentTimeSec)} />
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="dna-replay-map-pass" aria-hidden />

          <div className="dna-replay-right-wrap">
          <div className={`dna-replay-right ${feedCollapsed ? "dna-replay-right--collapsed" : ""}`}>
            {!feedCollapsed && (
              <div className="dna-replay-right-inner">
                <div className="dna-replay-right-body">
                  <div className="dna-replay-section-title">События матча</div>
                  {focusMode === "team" && focusTeamId && focusedTeamStats && (
                    <div className="dna-replay-right-context dna-replay-team-summary dnaLabShell--shortFade">
                      <div
                        className="dna-replay-team-summary-swatch"
                        style={{ background: getStableTeamColor(focusTeamId, sortedTeamIds) }}
                      />
                      <div>
                        <div className="dna-replay-team-summary-title">Команда {focusTeamId}</div>
                        <div className="dna-replay-team-summary-stats">
                          Состав: {focusedTeamStats.total} · Живых: {focusedTeamStats.alive} · Киллы:{" "}
                          {focusedTeamStats.kills}
                        </div>
                      </div>
                    </div>
                  )}
                  {focusMode === "player" && focusPlayerId && (
                    <div className="dna-replay-right-context dna-replay-player-strip dnaLabShell--shortFade">
                      <strong>{displayPlayerLabel(focusedPlayerRow || {})}</strong>
                      <span className="dna-replay-player-strip-muted">
                        {formatReplayTime(currentTimeSec)} · киллы {focusedPlayerKills}
                      </span>
                    </div>
                  )}
                  <div className="dna-replay-feed-gate">
                    {!feedUnlockedAfterPlay ? (
                      <div className="dna-replay-gate-msg">
                        Нажмите <strong>Плей</strong> на таймлайне, чтобы разблокировать ленту (или откройте матч
                        заново — лента уже доступна после загрузки).
                      </div>
                    ) : (
                      <EventFeed
                        session={session}
                        currentTimeSec={currentTimeSec}
                        selectedEventId={selectedEventId}
                        eventFilters={eventFilters}
                        onSelectEvent={setSelectedEventId}
                        onCurrentTimeChange={seekCurrentTimeSec}
                        onFocusPoint={handleFocusPoint}
                        isolateFightId={isolateFightId}
                        filterPlayerId={teamGameMode ? null : focusPlayerId || null}
                        filterTeamId={
                          teamGameMode && focusPlayerId
                            ? getTeamIdForPlayer(session, focusPlayerId)
                            : focusTeamId || null
                        }
                        compact
                      />
                    )}
                  </div>
                  <div className="dna-replay-section-title">Выбранное событие</div>
                  {selectedEvent && (
                    <div className="dna-replay-event-card dna-replay-event-card--compact dnaLabShell--shortFade">
                      <div className="dna-replay-event-card-kicker">Выбранное событие</div>
                      <div className="dna-replay-event-card-type">{selectedEvent.type}</div>
                      <div className="dna-replay-event-card-time">{formatReplayTime(selectedEvent.t)}</div>
                      {selectedEvent.actor?.label && (
                        <div className="dna-replay-event-card-row">
                          <span className="dna-replay-event-card-label">Актор</span>
                          <span>{selectedEvent.actor.label}</span>
                        </div>
                      )}
                      {selectedEvent.target?.label && (
                        <div className="dna-replay-event-card-row">
                          <span className="dna-replay-event-card-label">Цель</span>
                          <span>{selectedEvent.target.label}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              className="dna-replay-curtain"
              title={feedCollapsed ? "Развернуть панель" : "Свернуть панель"}
              onClick={() => setFeedCollapsed(!feedCollapsed)}
              aria-expanded={!feedCollapsed}
            >
              {feedCollapsed ? "«" : "»"}
            </button>
          </div>
          </div>
          </div>

          <div className="dna-replay-match-caption" title={toolbarMeta}>
            {toolbarMeta}
          </div>

          <div className="dna-replay-timeline-wrap">
          <Timeline
            variant="replay"
            session={session}
            currentTimeSec={currentTimeSec}
            onCurrentTimeChange={seekCurrentTimeSec}
            selectedEventId={selectedEventId}
            selectedFightId={selectedFightId}
            onSelectEvent={setSelectedEventId}
            onSelectFight={setSelectedFightId}
            onFocusDeath={handleFocusDeath}
            isolateFightId={isolateFightId}
            isPlaying={isPlaying}
            playSpeed={playSpeed}
            onTogglePlayPause={togglePlayPause}
            onPlaySpeedChange={setPlaySpeed}
            onFitView={() => mapCanvasRef.current?.fitToEvents?.()}
            onResetView={() => mapCanvasRef.current?.resetView?.()}
            zonePhaseHint={zonePhaseHint}
            aliveHint={aliveStatsHint}
            focusPlayerId={focusPlayerId}
            focusTeamId={focusTeamId}
            teamGameMode={teamGameMode}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
