import React, { useCallback, useMemo, useRef } from "react";
import { getEventStyle } from "@/shared/lib/replay/eventIcons";
import { getEventImportance } from "@/shared/lib/replay/mapReplayVisuals";
import { collectReplayRoster, getTeamIdForPlayer } from "@/shared/lib/replay/replaySessionModel";
import "./Timeline.css";

function eventMatchesReplayFocus(ev, focusPlayerId, focusTeamId, teamGameMode, session) {
  if (focusPlayerId && teamGameMode && session) {
    const ft = getTeamIdForPlayer(session, focusPlayerId);
    if (ft != null) {
      const tid = String(ft);
      const a = ev.actor?.teamId != null ? String(ev.actor.teamId) : null;
      const t = ev.target?.teamId != null ? String(ev.target.teamId) : null;
      return a === tid || t === tid;
    }
  }
  if (focusPlayerId) {
    return ev.actor?.id === focusPlayerId || ev.target?.id === focusPlayerId;
  }
  if (focusTeamId) {
    const fs = String(focusTeamId);
    const a = ev.actor?.teamId != null ? String(ev.actor.teamId) : null;
    const t = ev.target?.teamId != null ? String(ev.target.teamId) : null;
    return a === fs || t === fs;
  }
  return false;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TYPES_SKIP_TIMELINE_MARKERS = new Set(["HEAL", "BOOST"]);

const SPEED_PRESETS = [0.5, 1, 2];

export default function Timeline(props) {
  const {
    variant = "default",
    session,
    currentTimeSec,
    onCurrentTimeChange,
    selectedEventId,
    selectedFightId,
    onSelectEvent,
    onSelectFight,
    onFocusDeath,
    isolateFightId,
    isPlaying,
    playSpeed,
    onTogglePlayPause,
    onPlaySpeedChange,
    zonePhaseHint,
    aliveHint,
    onFitView,
    onResetView,
    focusPlayerId = null,
    focusTeamId = null,
    teamGameMode = false,
  } = props;

  const trackRef = useRef(null);
  const durationSec = session?.match?.durationSec ?? 1200;
  const events = session?.events ?? [];
  const fights = session?.fights ?? [];
  /** Маркеры хила/буста на шкале не показываем — слишком шумно для тактического реплея. */
  const eventsForTimeline = useMemo(
    () => events.filter((e) => !TYPES_SKIP_TIMELINE_MARKERS.has(e.type)),
    [events]
  );
  const filteredEvents = useMemo(
    () => (isolateFightId ? eventsForTimeline.filter((e) => e.fightId === isolateFightId) : eventsForTimeline),
    [eventsForTimeline, isolateFightId]
  );

  const roster = useMemo(() => collectReplayRoster(session), [session]);
  const effectiveDurationSec = useMemo(() => {
    if (variant !== "replay") return durationSec;
    if (!focusPlayerId && !focusTeamId) return durationSec;

    const evs = Array.isArray(events) ? events : [];
    if (focusPlayerId) {
      if (teamGameMode && session) {
        const tidFocus = getTeamIdForPlayer(session, focusPlayerId);
        if (tidFocus != null) {
          const memberIds = roster
            .filter((p) => p.teamId != null && String(p.teamId) === String(tidFocus))
            .map((p) => p.id)
            .filter(Boolean);
          if (memberIds.length > 0) {
            const memberSet = new Set(memberIds);
            const deathMaxByPlayer = new Map();
            for (const e of evs) {
              if (e.type !== "DEATH") continue;
              const tid = e.target?.id;
              if (!tid || !memberSet.has(tid)) continue;
              const t = Number(e.t) || 0;
              const prev = deathMaxByPlayer.get(tid);
              if (prev == null || t > prev) deathMaxByPlayer.set(tid, t);
            }
            const allDead = memberIds.every((pid) => deathMaxByPlayer.has(pid));
            if (allDead) {
              const vals = Array.from(deathMaxByPlayer.values());
              return vals.length ? Math.max(...vals) : durationSec;
            }
          }
        }
      }
      const deathTs = evs
        .filter((e) => e.type === "DEATH" && e.target?.id === focusPlayerId)
        .map((e) => Number(e.t) || 0);
      return deathTs.length ? Math.max(...deathTs) : durationSec;
    }
    if (focusTeamId) {
      const memberIds = roster
        .filter((p) => p.teamId != null && String(p.teamId) === String(focusTeamId))
        .map((p) => p.id)
        .filter(Boolean);
      if (memberIds.length === 0) return durationSec;
      const memberSet = new Set(memberIds);
      const deathMaxByPlayer = new Map();
      for (const e of evs) {
        if (e.type !== "DEATH") continue;
        const tid = e.target?.id;
        if (!tid || !memberSet.has(tid)) continue;
        const t = Number(e.t) || 0;
        const prev = deathMaxByPlayer.get(tid);
        if (prev == null || t > prev) deathMaxByPlayer.set(tid, t);
      }
      const allDead = memberIds.every((pid) => deathMaxByPlayer.has(pid));
      if (!allDead) return durationSec;
      const vals = Array.from(deathMaxByPlayer.values());
      return vals.length ? Math.max(...vals) : durationSec;
    }
    return durationSec;
  }, [variant, durationSec, events, focusPlayerId, focusTeamId, roster, teamGameMode, session]);

  const handleTrackClick = useCallback(
    (e) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = rect.width > 0 ? (x / rect.width) * effectiveDurationSec : 0;
      onCurrentTimeChange(Math.max(0, Math.min(effectiveDurationSec, t)));
    },
    [effectiveDurationSec, onCurrentTimeChange]
  );

  const handleScrubberDrag = useCallback(
    (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const move = (ev) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
        const t = rect.width > 0 ? (x / rect.width) * effectiveDurationSec : 0;
        onCurrentTimeChange(Math.max(0, Math.min(effectiveDurationSec, t)));
      };
      move(e);
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [effectiveDurationSec, onCurrentTimeChange]
  );

  const hasFocus = Boolean(focusPlayerId || focusTeamId);

  const isReplay = variant === "replay";
  const eventsForMarkers = useMemo(() => {
    if (!isReplay || !hasFocus) return [];
    return filteredEvents
      .filter((e) => eventMatchesReplayFocus(e, focusPlayerId, focusTeamId, teamGameMode, session))
      .filter((e) => (Number(e.t) || 0) <= effectiveDurationSec)
      .filter((e) => {
        const imp = getEventImportance(e.type);
        return imp === "high" || imp === "medium";
      })
      .sort((a, b) => a.t - b.t);
  }, [filteredEvents, isReplay, hasFocus, focusPlayerId, focusTeamId, teamGameMode, session, effectiveDurationSec]);

  // Быстрые prev/next по отсортированному массиву событий.
  const prevNext = useMemo(() => {
    if (!eventsForMarkers.length) return { prev: null, next: null };
    const t = Number(currentTimeSec) || 0;
    let lo = 0;
    let hi = eventsForMarkers.length - 1;
    let prev = null;
    let next = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const mt = Number(eventsForMarkers[mid]?.t) || 0;
      if (mt < t) {
        prev = eventsForMarkers[mid];
        lo = mid + 1;
      } else if (mt >= t) {
        next = eventsForMarkers[mid];
        hi = mid - 1;
      }
    }
    // next уже минимальный >= t по бинарному поиску, prev — максимальный < t
    return { prev, next };
  }, [eventsForMarkers, currentTimeSec]);

  const prevEvent = prevNext.prev;
  const nextEvent = prevNext.next;

  const deathEvent = useMemo(() => {
    if (!eventsForMarkers.length) return null;
    let lastDeath = null;
    for (const e of eventsForMarkers) {
      if (e.type === "DEATH") lastDeath = e;
    }
    return lastDeath;
  }, [eventsForMarkers]);

  // Для “не replay” вариантов — оставляем старую логику контролов.
  const defaultControlEvents = useMemo(() => {
    return [...filteredEvents]
      .filter((e) => {
        const imp = getEventImportance(e.type);
        return imp === "high" || imp === "medium";
      })
      .sort((a, b) => a.t - b.t);
  }, [filteredEvents]);

  const defaultPrevNext = useMemo(() => {
    if (!defaultControlEvents.length) return { prev: null, next: null };
    const t = Number(currentTimeSec) || 0;
    let lo = 0;
    let hi = defaultControlEvents.length - 1;
    let prev = null;
    let next = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const mt = Number(defaultControlEvents[mid]?.t) || 0;
      if (mt < t) {
        prev = defaultControlEvents[mid];
        lo = mid + 1;
      } else if (mt >= t) {
        next = defaultControlEvents[mid];
        hi = mid - 1;
      }
    }
    return { prev, next };
  }, [defaultControlEvents, currentTimeSec]);

  const defaultDeathEvent = useMemo(() => {
    const ev = Array.isArray(events) ? events.find((e) => e.type === "DEATH") : null;
    return ev ?? null;
  }, [events]);

  const prevEventForControls = isReplay ? prevEvent : defaultPrevNext.prev;
  const nextEventForControls = isReplay ? nextEvent : defaultPrevNext.next;
  const deathEventForControls = isReplay ? deathEvent : defaultDeathEvent;

  const scrubberLeft =
    effectiveDurationSec > 0
      ? (Math.min(currentTimeSec, effectiveDurationSec) / effectiveDurationSec) * 100
      : 0;
  const canPlay = Boolean(session?.match);

  const trackClassName = `dna-timeline-track${isReplay ? " dna-timeline-track--replay" : ""}`;

  const trackInner = (
    <>
      <div className="dna-timeline-track-inner">
        {(isReplay ? hasFocus : true) && fights.length > 0 && (
          <div className="dna-timeline-row dna-timeline-fights">
            {fights.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`dna-timeline-fight-seg ${selectedFightId === f.id ? "dna-timeline-fight-seg-active" : ""}`}
                style={{
                  left: effectiveDurationSec > 0 ? `${(f.startT / effectiveDurationSec) * 100}%` : "0%",
                  width:
                    effectiveDurationSec > 0 ? `${((f.endT - f.startT) / effectiveDurationSec) * 100}%` : "0%",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFight(f.id);
                  onCurrentTimeChange(f.startT);
                }}
              >
                Fight
              </button>
            ))}
          </div>
        )}
        <div className="dna-timeline-row dna-timeline-events">
          {isReplay
            ? hasFocus &&
              eventsForMarkers.map((ev) => {
                const style = getEventStyle(ev.type);
                const left = effectiveDurationSec > 0 ? (ev.t / effectiveDurationSec) * 100 : 0;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className={`dna-timeline-marker ${selectedEventId === ev.id ? "dna-timeline-marker-active" : ""}`}
                    style={{
                      left: `${left}%`,
                      backgroundColor: style.color,
                    }}
                    title={`${formatTime(ev.t)} ${ev.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev.id);
                      onCurrentTimeChange(ev.t);
                    }}
                  >
                    {style.symbol}
                  </button>
                );
              })
            : filteredEvents.map((ev) => {
                const style = getEventStyle(ev.type);
                const left = durationSec > 0 ? (ev.t / durationSec) * 100 : 0;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className={`dna-timeline-marker ${selectedEventId === ev.id ? "dna-timeline-marker-active" : ""}`}
                    style={{
                      left: `${left}%`,
                      backgroundColor: style.color,
                    }}
                    title={`${formatTime(ev.t)} ${ev.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev.id);
                      onCurrentTimeChange(ev.t);
                    }}
                  >
                    {style.symbol}
                  </button>
                );
              })}
        </div>
      </div>
      <div
        className="dna-timeline-scrubber"
        style={{ left: `${scrubberLeft}%` }}
        onMouseDown={handleScrubberDrag}
        role="presentation"
      />
    </>
  );

  const metaRow =
    (zonePhaseHint || aliveHint) && (
      <div className={`dna-timeline-replay-meta ${isReplay ? "dna-timeline-replay-meta--replay" : ""}`}>
        {zonePhaseHint && <span className="dna-timeline-meta-item">{zonePhaseHint}</span>}
        {aliveHint && <span className="dna-timeline-meta-item">{aliveHint}</span>}
      </div>
    );

  if (isReplay) {
    return (
      <div className="dna-timeline dna-timeline--replay">
        {metaRow}
        <div className="dna-timeline-replay-grid">
          <div className="dna-timeline-replay-left">
            <span className="dna-timeline-current dna-timeline-current--replay">{formatTime(currentTimeSec)}</span>
            <button
              type="button"
              className="dna-timeline-ctrl-btn dna-timeline-ctrl-btn--replay"
              onClick={() => onTogglePlayPause?.()}
              disabled={!canPlay}
              aria-pressed={isPlaying}
              title={isPlaying ? "Пауза" : "Плей"}
            >
              {isPlaying ? "Пауза" : "Плей"}
            </button>
            <div className="dna-timeline-speed dna-timeline-speed--replay">
              {SPEED_PRESETS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  className={`dna-timeline-ctrl-btn dna-timeline-speed-btn dna-timeline-ctrl-btn--replay ${
                    Number(playSpeed) === sp ? "dna-timeline-speed-btn-active" : ""
                  }`}
                  onClick={() => onPlaySpeedChange?.(sp)}
                  disabled={!canPlay}
                >
                  {sp === 0.5 ? "0.5×" : `${sp}×`}
                </button>
              ))}
            </div>
          </div>

          <div className="dna-timeline-replay-center">
            <div className="dna-timeline-time dna-timeline-time--replay">
              <span>{formatTime(0)}</span>
              <span>{formatTime(effectiveDurationSec)}</span>
            </div>
            <div
              ref={trackRef}
              className={trackClassName}
              onClick={handleTrackClick}
              role="slider"
              aria-valuenow={currentTimeSec}
              aria-valuemin={0}
              aria-valuemax={effectiveDurationSec}
              tabIndex={0}
            >
              {trackInner}
            </div>
          </div>

          <div className="dna-timeline-replay-right">
            {hasFocus && prevEventForControls && (
              <button
                type="button"
                className="dna-timeline-ctrl-btn dna-timeline-ctrl-btn--replay"
                onClick={() => {
                  onSelectEvent(prevEventForControls.id);
                  onCurrentTimeChange(prevEventForControls.t);
                }}
              >
                Пред.
              </button>
            )}
            {hasFocus && nextEventForControls && (
              <button
                type="button"
                className="dna-timeline-ctrl-btn dna-timeline-ctrl-btn--replay"
                onClick={() => {
                  onSelectEvent(nextEventForControls.id);
                  onCurrentTimeChange(nextEventForControls.t);
                }}
              >
                След.
              </button>
            )}
            {hasFocus && deathEventForControls && (
              <button
                type="button"
                className="dna-timeline-ctrl-btn dna-timeline-ctrl-btn--replay"
                onClick={() => {
                  onSelectEvent(deathEventForControls.id);
                  onCurrentTimeChange(deathEventForControls.t);
                  onFocusDeath?.();
                }}
                title="Перейти к смерти"
              >
                Смерть
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dna-timeline">
      <div className="dna-timeline-time">
        <span>{formatTime(0)}</span>
        <span>{formatTime(durationSec)}</span>
      </div>
      <div
        ref={trackRef}
        className={trackClassName}
        onClick={handleTrackClick}
        role="slider"
        aria-valuenow={currentTimeSec}
        aria-valuemin={0}
        aria-valuemax={durationSec}
        tabIndex={0}
      >
        {trackInner}
      </div>
      <div className="dna-timeline-controls">
        <span className="dna-timeline-current">{formatTime(currentTimeSec)}</span>
        <button
          type="button"
          className="dna-timeline-ctrl-btn"
          onClick={() => onTogglePlayPause?.()}
          disabled={!canPlay}
          aria-pressed={isPlaying}
          title={isPlaying ? "Пауза" : "Плей"}
        >
          {isPlaying ? "Пауза" : "Плей"}
        </button>
        <div className="dna-timeline-speed">
          {SPEED_PRESETS.map((sp) => (
            <button
              key={sp}
              type="button"
              className={`dna-timeline-ctrl-btn dna-timeline-speed-btn ${Number(playSpeed) === sp ? "dna-timeline-speed-btn-active" : ""}`}
              onClick={() => onPlaySpeedChange?.(sp)}
              disabled={!canPlay}
            >
              {sp === 0.5 ? "0.5x" : `${sp}x`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="dna-timeline-ctrl-btn"
          onClick={() => onCurrentTimeChange(Math.max(0, currentTimeSec - 5))}
        >
          −5с
        </button>
        <button
          type="button"
          className="dna-timeline-ctrl-btn"
          onClick={() => onCurrentTimeChange(Math.min(durationSec, currentTimeSec + 5))}
        >
          +5с
        </button>
        {prevEventForControls && (
          <button
            type="button"
            className="dna-timeline-ctrl-btn"
            onClick={() => {
              onSelectEvent(prevEventForControls.id);
              onCurrentTimeChange(prevEventForControls.t);
            }}
          >
            Пред. событие
          </button>
        )}
        {nextEventForControls && (
          <button
            type="button"
            className="dna-timeline-ctrl-btn"
            onClick={() => {
              onSelectEvent(nextEventForControls.id);
              onCurrentTimeChange(nextEventForControls.t);
            }}
          >
            След. событие
          </button>
        )}
        {deathEventForControls && (
          <button
            type="button"
            className="dna-timeline-ctrl-btn"
            onClick={() => {
              onSelectEvent(deathEventForControls.id);
              onCurrentTimeChange(deathEventForControls.t);
              onFocusDeath?.();
            }}
          >
            Фокус смерти
          </button>
        )}
        {(zonePhaseHint || aliveHint) && (
          <span className="dna-timeline-replay-meta">
            {zonePhaseHint && <span className="dna-timeline-meta-item">{zonePhaseHint}</span>}
            {aliveHint && <span className="dna-timeline-meta-item">{aliveHint}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
