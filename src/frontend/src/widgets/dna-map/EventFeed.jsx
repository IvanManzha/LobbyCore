import React, { useMemo } from "react";
import { getTeamColor } from "../../utils/mapReplayVisuals";
import { collectReplayRoster, sortedTeamIdsFromRoster } from "../../utils/replaySessionModel";
import "./EventFeed.css";

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function actorLabel(actor) {
  return actor?.label ? String(actor.label) : null;
}

function shortType(type) {
  const map = {
    DAMAGE: "Урон",
    HEAL: "Лечение",
    BOOST: "Усиление",
    KILL: "Убийство",
    KNOCK: "Нок",
    DEATH: "Смерть",
    REVIVE: "Поднятие",
    LANDING: "Высадка",
    VEHICLE_ENTER: "Транспорт +",
    VEHICLE_EXIT: "Транспорт -",
    ZONE_DAMAGE: "Зона",
  };
  return map[type] || String(type || "").replace(/_/g, " ");
}

function formatEventLine(ev) {
  const type = ev.type;
  const a = actorLabel(ev.actor);
  const t = actorLabel(ev.target);
  const weapon = ev.weapon ? ` (${ev.weapon})` : "";

  if (type === "LANDING") return `${a || "Игрок"} приземлился`;
  if (type === "KNOCK") return `${a || "Игрок"} нокнул ${t || "цель"}${weapon}`;
  if (type === "KILL") return `${a || "Игрок"} убил ${t || "цель"}${weapon}`;
  if (type === "DEATH") return `${a || "Игрок"} погиб${t ? ` (${t})` : ""}`;
  if (type === "REVIVE") return `${a || "Игрок"} реанимировал ${t || "союзника"}`;
  if (type === "DAMAGE") return `${a || "Игрок"} нанёс урон${t ? ` ${t}` : ""}${weapon}`;
  if (type === "VEHICLE_ENTER") return `${a || "Игрок"} сел в транспорт`;
  if (type === "VEHICLE_EXIT") return `${a || "Игрок"} вышел из транспорта`;
  if (type === "HEAL") return `${a || "Игрок"} использовал лечение`;
  if (type === "BOOST") return `${a || "Игрок"} включил усиление`;
  if (type === "ZONE_DAMAGE") return `${a || "Игрок"} получил урон от зоны`;

  // Generic fallback (human-friendly)
  return `${a || "Игрок"}: ${type.replace(/_/g, " ").toLowerCase()}${t ? ` → ${t}` : ""}${weapon}`;
}

export default function EventFeed({
  session,
  currentTimeSec,
  selectedEventId,
  eventFilters,
  onSelectEvent,
  onCurrentTimeChange,
  onFocusPoint,
  isolateFightId,
  filterTeamId = null,
  filterPlayerId = null,
  title: titleOverride,
  compact = false,
}) {
  const roster = useMemo(() => collectReplayRoster(session), [session]);
  const teamIds = useMemo(() => sortedTeamIdsFromRoster(roster), [roster]);
  const teamColorFor = (teamId) => getTeamColor(teamId, teamIds);

  const filtered = useMemo(() => {
    const events = session?.events ?? [];
    if (!Array.isArray(events) || events.length === 0) return [];
    return events
      .filter((e) => (eventFilters?.[e.type] !== false))
      .filter((e) => (isolateFightId ? e.fightId === isolateFightId : true))
      .filter((e) => {
        if (filterPlayerId) {
          return e.actor?.id === filterPlayerId || e.target?.id === filterPlayerId;
        }
        if (filterTeamId) {
          const a = e.actor?.teamId != null ? String(e.actor.teamId) : null;
          const t = e.target?.teamId != null ? String(e.target.teamId) : null;
          return a === filterTeamId || t === filterTeamId;
        }
        return true;
      })
      .sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  }, [session?.events, eventFilters, isolateFightId, filterTeamId, filterPlayerId]);

  const feedTitle =
    titleOverride ||
    (filterPlayerId ? "События игрока" : filterTeamId ? "События команды" : "События матча");

  const activeIndex = useMemo(() => {
    if (!filtered.length) return -1;
    if (selectedEventId) {
      const idx = filtered.findIndex((e) => e.id === selectedEventId);
      if (idx >= 0) return idx;
    }
    // Fallback: last event with t <= currentTimeSec
    let idx = -1;
    for (let i = 0; i < filtered.length; i++) {
      if ((filtered[i].t ?? 0) <= currentTimeSec) idx = i;
    }
    return idx;
  }, [filtered, selectedEventId, currentTimeSec]);

  const visibleEvents = useMemo(() => {
    if (!filtered.length) return [];
    const start = Math.max(0, activeIndex - 9);
    const end = Math.min(filtered.length, activeIndex + 7);
    return filtered.slice(start, end);
  }, [filtered, activeIndex]);

  const renderCompactNames = (ev) => {
    const actor = ev.actor?.label ? String(ev.actor.label) : "";
    const target = ev.target?.label ? String(ev.target.label) : "";
    const actorColor = teamColorFor(ev.actor?.teamId);
    const targetColor = teamColorFor(ev.target?.teamId);
    return (
      <span className="dna-event-feed-subline">
        {actor ? <span style={{ color: actorColor }}>{actor}</span> : null}
        {actor && target ? <span className="dna-event-feed-arrow"> → </span> : null}
        {target ? <span style={{ color: targetColor }}>{target}</span> : null}
      </span>
    );
  };

  return (
    <div className="dna-event-feed">
      {!compact && <div className="dna-event-feed-title">{feedTitle}</div>}
      {filtered.length === 0 && <div className="dna-event-feed-empty">События не найдены</div>}

      <div className="dna-event-feed-list" role="list">
        {visibleEvents.map((ev) => {
          const isActive = ev.id === selectedEventId;
          return (
            <button
              key={ev.id}
              type="button"
              className={`dna-event-feed-item ${isActive ? "dna-event-feed-item-active" : ""}`}
              onClick={() => {
                onSelectEvent?.(ev.id ?? null);
                onCurrentTimeChange?.(ev.t ?? 0);
                if (ev.x != null && ev.y != null) onFocusPoint?.(ev.x, ev.y);
              }}
              title={`${formatTime(ev.t ?? 0)} • ${ev.type}`}
            >
              <span className="dna-event-feed-dot" aria-hidden />
              <span className="dna-event-feed-time">{formatTime(ev.t ?? 0)}</span>
              <span className="dna-event-feed-main">
                <span className="dna-event-feed-line">{compact ? shortType(ev.type) : formatEventLine(ev)}</span>
                {compact && (ev.actor?.label || ev.target?.label) && (
                  renderCompactNames(ev)
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

