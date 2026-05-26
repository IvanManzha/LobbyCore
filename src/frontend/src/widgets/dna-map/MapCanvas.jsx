import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getFitTransform,
  getFitToBoundsTransform,
  focusPoint as getFocusTransform,
} from "../../utils/mapTransform";
import { getMapInfo } from "../../config/pubgMaps";
import { getEventStyle, formatEventTooltip } from "../../utils/eventIcons";
import {
  getEventImportance,
  getEventBaseRadius,
  getReplayZoomTier,
  isEventVisibleInReplayTier,
  getEventTemporalOpacity,
  getFocusDimMultiplier,
  getTeamColor,
  getTrackPositionAtTime,
} from "../../utils/mapReplayVisuals";
import { interpolateZoneAtTime } from "../../utils/mapZoneInterpolation";
import {
  buildPlayerTrackList,
  collectReplayRoster,
  sortedTeamIdsFromRoster,
  getTeamIdForPlayer,
} from "../../utils/replaySessionModel";
import { getPlayerStatusAtTime } from "../../utils/replayPlayerStatus";
import "./MapCanvas.css";

const MAP_IMAGE_CACHE_BUST = "?v=2";
const ZOOM_MAX_REPLAY = 10;

function getReplayRouteStyle(playerId, teamId, focusPlayerId, focusTeamId, hoverPlayerId, zoomInOnly) {
  if (!zoomInOnly) return { opacity: 0.78, widthMul: 1 };
  if (focusPlayerId) {
    if (playerId === focusPlayerId) return { opacity: 1, widthMul: 2.15 };
    if (teamId != null && focusTeamId != null && String(teamId) === String(focusTeamId)) {
      return { opacity: 0.52, widthMul: 1.35 };
    }
    return { opacity: 0.16, widthMul: 0.92 };
  }
  if (focusTeamId) {
    if (teamId != null && String(teamId) === String(focusTeamId)) return { opacity: 0.9, widthMul: 1.6 };
    return { opacity: 0.2, widthMul: 0.88 };
  }
  if (hoverPlayerId) {
    if (playerId === hoverPlayerId) return { opacity: 0.72, widthMul: 1.28 };
    return { opacity: 0.32, widthMul: 0.95 };
  }
  return { opacity: 0.34, widthMul: 0.86 };
}

function getReplayMarkerStyle(playerId, teamId, focusPlayerId, focusTeamId, hoverPlayerId, zoomInOnly) {
  if (!zoomInOnly) return { r: 2300, opacity: 1, ring: false };
  if (focusPlayerId) {
    if (playerId === focusPlayerId) return { r: 4000, opacity: 1, ring: true };
    if (teamId != null && focusTeamId != null && String(teamId) === String(focusTeamId)) {
      return { r: 2700, opacity: 0.88, ring: false };
    }
    return { r: 1650, opacity: 0.4, ring: false };
  }
  if (focusTeamId) {
    if (teamId != null && String(teamId) === String(focusTeamId)) return { r: 2900, opacity: 0.95, ring: false };
    return { r: 1550, opacity: 0.4, ring: false };
  }
  if (hoverPlayerId) {
    if (playerId === hoverPlayerId) return { r: 3200, opacity: 1, ring: true };
    return { r: 1950, opacity: 0.55, ring: false };
  }
  return { r: 2500, opacity: 0.88, ring: false };
}

function isPlayerVisibleInFocus(playerId, teamId, focusPlayerId, focusTeamId, teamGameMode, session) {
  if (focusPlayerId && teamGameMode && session) {
    const ft = getTeamIdForPlayer(session, focusPlayerId);
    if (ft != null && teamId != null) return String(teamId) === String(ft);
  }
  if (focusPlayerId) return playerId === focusPlayerId;
  if (focusTeamId) return teamId != null && String(teamId) === String(focusTeamId);
  return true;
}

const MapCanvas = forwardRef(function MapCanvas(props, ref) {
  const {
    session,
    currentTimeSec,
    selectedEventId,
    layers,
    eventFilters,
    onSelectEvent,
    onFocusPoint,
    onResetView,
    isolateFightId,
    focusPoint,
    onFocusApplied,
    zoomInOnly = false,
    focusPlayerId = null,
    focusTeamId = null,
    hoverPlayerId = null,
    teamGameMode = false,
    onPlayerMarkerClick,
  } = props;

  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 300 });
  const [viewCenter, setViewCenter] = useState({ x: 153000, y: 153000 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [hoverEventId, setHoverEventId] = useState(null);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const minZoomRef = useRef(1);
  const panRafRef = useRef(null);
  const pendingPanRef = useRef(null);
  const zoomEndTimerRef = useRef(null);

  const worldSize =
    session?.match?.map?.worldSize ??
    getMapInfo(session?.match?.mapName)?.sizeCm ??
    306000;
  const mapImageUrl =
    session?.match?.map?.imageUrl ?? getMapInfo(session?.match?.mapName)?.mapImage;

  const expandBoundsWithZones = useCallback(
    (minX, minY, maxX, maxY) => {
      const snaps = session?.zoneSnapshots;
      if (!Array.isArray(snaps) || snaps.length === 0) return { minX, minY, maxX, maxY };
      let a = minX;
      let b = minY;
      let c = maxX;
      let d = maxY;
      for (const s of snaps) {
        if (s?.safe?.r > 0) {
          a = Math.min(a, s.safe.x - s.safe.r);
          b = Math.min(b, s.safe.y - s.safe.r);
          c = Math.max(c, s.safe.x + s.safe.r);
          d = Math.max(d, s.safe.y + s.safe.r);
        }
        if (s?.next?.r > 0) {
          a = Math.min(a, s.next.x - s.next.r);
          b = Math.min(b, s.next.y - s.next.r);
          c = Math.max(c, s.next.x + s.next.r);
          d = Math.max(d, s.next.y + s.next.r);
        }
      }
      return { minX: a, minY: b, maxX: c, maxY: d };
    },
    [session?.zoneSnapshots]
  );

  const handleResetView = useCallback(() => {
    const list = session ? buildPlayerTrackList(session) : [];
    const flatPts = [];
    list.forEach((entry) => entry.points.forEach((p) => flatPts.push(p)));
    const hasPts = flatPts.length > 0 || session?.events?.length;
    const hasZones = session?.zoneSnapshots?.length;
    if (hasPts || hasZones) {
      const pts = flatPts.length ? flatPts : session?.tracks?.primary || [];
      const evts = session.events || [];
      let minX = worldSize,
        minY = worldSize,
        maxX = 0,
        maxY = 0;
      pts.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      evts.forEach((e) => {
        minX = Math.min(minX, e.x);
        minY = Math.min(minY, e.y);
        maxX = Math.max(maxX, e.x);
        maxY = Math.max(maxY, e.y);
      });
      const zBounds = expandBoundsWithZones(minX, minY, maxX, maxY);
      minX = zBounds.minX;
      minY = zBounds.minY;
      maxX = zBounds.maxX;
      maxY = zBounds.maxY;
      if (minX < maxX || minY < maxY) {
        const t = getFitToBoundsTransform({ minX, minY, maxX, maxY }, containerSize);
        const z = Math.min(1, t.zoom);
        setViewCenter(t.viewCenter);
        setZoom(z);
        minZoomRef.current = z;
        setPan(t.pan);
      } else {
        const t = getFitTransform(worldSize, containerSize);
        setViewCenter(t.viewCenter);
        setZoom(1);
        minZoomRef.current = 1;
        setPan(t.pan);
      }
    } else {
      const t = getFitTransform(worldSize, containerSize);
      setViewCenter(t.viewCenter);
      setZoom(1);
      minZoomRef.current = 1;
      setPan(t.pan);
    }
    onResetView?.();
  }, [session, worldSize, containerSize, onResetView, expandBoundsWithZones]);

  useImperativeHandle(
    ref,
    () => ({
      resetView: handleResetView,
      fitToEvents: handleResetView,
    }),
    [handleResetView]
  );

  useEffect(() => {
    if (!session?.match) return;
    const fit = getFitTransform(worldSize, containerSize);
    setViewCenter(fit.viewCenter);
    setZoom(fit.zoom);
    setPan(fit.pan);
    minZoomRef.current = fit.zoom;
  }, [session?.match?.matchId, worldSize, containerSize.width, containerSize.height]);

  useEffect(() => {
    if (!focusPoint || !containerSize.width) return;
    const t = getFocusTransform(focusPoint);
    setViewCenter(t.viewCenter);
    setZoom(t.zoom);
    setPan(t.pan);
    minZoomRef.current = t.zoom;
    onFocusApplied?.();
  }, [focusPoint, onFocusApplied]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    });
    ro.observe(containerRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    setContainerSize({ width, height });
    return () => ro.disconnect();
  }, []);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      setIsZooming(true);
      if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
      zoomEndTimerRef.current = setTimeout(() => setIsZooming(false), 120);
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => {
        if (zoomInOnly) {
          const lo = minZoomRef.current;
          const hi = ZOOM_MAX_REPLAY;
          const next = z + delta;
          if (delta < 0) {
            return Math.max(lo, next);
          }
          return Math.min(hi, next);
        }
        return Math.max(0.12, Math.min(1, z + delta));
      });
    },
    [zoomInOnly]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const onMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      pendingPanRef.current = {
        x: dragStart.current.panX + e.clientX - dragStart.current.x,
        y: dragStart.current.panY + e.clientY - dragStart.current.y,
      };
      if (panRafRef.current != null) return;
      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        if (pendingPanRef.current) setPan(pendingPanRef.current);
      });
    },
    [isDragging]
  );

  const onMouseUp = useCallback(() => setIsDragging(false), []);
  const onMouseLeave = useCallback(() => setIsDragging(false), []);
  useEffect(() => {
    return () => {
      if (panRafRef.current != null) cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
      pendingPanRef.current = null;
      if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
      zoomEndTimerRef.current = null;
    };
  }, []);

  const roster = useMemo(() => collectReplayRoster(session), [session]);
  const labelByPlayerId = useMemo(() => {
    const out = {};
    roster.forEach((p) => {
      if (p?.id) out[p.id] = String(p.label || p.id);
    });
    return out;
  }, [roster]);
  const sortedTeamIds = useMemo(() => sortedTeamIdsFromRoster(roster), [roster]);
  const playerTracks = useMemo(() => buildPlayerTrackList(session), [session]);

  const styleFocusTeamId = useMemo(() => {
    if (teamGameMode && focusPlayerId && session) {
      const t = getTeamIdForPlayer(session, focusPlayerId);
      if (t != null) return t;
    }
    return focusTeamId;
  }, [teamGameMode, focusPlayerId, focusTeamId, session]);

  const events = session?.events ?? [];
  const fights = session?.fights ?? [];

  /** Момент выбывания (первый DEATH/KILL по цели) — обрезка маршрута после смерти. */
  const eliminationTimeByPlayer = useMemo(() => {
    const m = new Map();
    if (!Array.isArray(events) || events.length === 0) return m;
    for (const e of events) {
      if ((e.type !== "DEATH" && e.type !== "KILL") || !e.target?.id) continue;
      const pid = e.target.id;
      const et = Number(e.t) || 0;
      const prev = m.get(pid);
      if (prev == null || et < prev) m.set(pid, et);
    }
    return m;
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return [];
    return events.filter((e) => eventFilters[e.type] !== false);
  }, [events, eventFilters]);

  const eventsDeduped = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const e of filteredEvents) {
      const key = e.id
        ? `id:${e.id}`
        : `t:${e.t}|type:${e.type}|x:${e.x}|y:${e.y}|a:${e.actor?.id ?? ''}|tgt:${e.target?.id ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }, [filteredEvents]);

  const eventsToShow = useMemo(() => {
    let list = isolateFightId ? eventsDeduped.filter((e) => e.fightId === isolateFightId) : eventsDeduped;
    if (focusPlayerId && teamGameMode && session) {
      const ft = getTeamIdForPlayer(session, focusPlayerId);
      if (ft != null) {
        const tid = String(ft);
        list = list.filter((e) => {
          const a = e.actor?.teamId != null ? String(e.actor.teamId) : null;
          const t = e.target?.teamId != null ? String(e.target.teamId) : null;
          return a === tid || t === tid;
        });
      } else {
        list = list.filter((e) => e.actor?.id === focusPlayerId || e.target?.id === focusPlayerId);
      }
    } else if (focusPlayerId) {
      list = list.filter((e) => e.actor?.id === focusPlayerId || e.target?.id === focusPlayerId);
    } else if (focusTeamId) {
      const tid = String(focusTeamId);
      list = list.filter((e) => {
        const a = e.actor?.teamId != null ? String(e.actor.teamId) : null;
        const t = e.target?.teamId != null ? String(e.target.teamId) : null;
        return a === tid || t === tid;
      });
    }
    return list;
  }, [eventsDeduped, isolateFightId, focusPlayerId, focusTeamId, teamGameMode, session]);

  // Подготовка полилиний треков (тяжелая часть) отдельно от зума:
  // - бинарный поиск конца по времени
  // - ограничение числа точек (даунсемплинг), чтобы SVG не "задыхался" в лейте
  const routeRenderData = useMemo(() => {
    const out = [];
    const t = Number(currentTimeSec) || 0;
    const kk = Math.max(0.000001, (Math.min(containerSize.width, containerSize.height) / worldSize) * zoom);
    const cxx = containerSize.width / 2;
    const cyy = containerSize.height / 2;
    const minXRaw = (0 - cxx - pan.x) / kk + viewCenter.x;
    const maxXRaw = (containerSize.width - cxx - pan.x) / kk + viewCenter.x;
    const minYRaw = (0 - cyy - pan.y) / kk + viewCenter.y;
    const maxYRaw = (containerSize.height - cyy - pan.y) / kk + viewCenter.y;
    const pad = Math.max(4000, worldSize * 0.01 / Math.max(1, zoom));
    const bounds = {
      minX: Math.min(minXRaw, maxXRaw) - pad,
      maxX: Math.max(minXRaw, maxXRaw) + pad,
      minY: Math.min(minYRaw, maxYRaw) - pad,
      maxY: Math.max(minYRaw, maxYRaw) + pad,
    };
    const inside = (p) =>
      p &&
      p.x >= bounds.minX &&
      p.x <= bounds.maxX &&
      p.y >= bounds.minY &&
      p.y <= bounds.maxY;

    for (const entry of playerTracks) {
      const teamId = entry.teamId ?? getTeamIdForPlayer(session, entry.playerId);
      if (!isPlayerVisibleInFocus(entry.playerId, teamId, focusPlayerId, focusTeamId, teamGameMode, session))
        continue;

      const track = Array.isArray(entry.points) ? entry.points : [];
      if (track.length < 2) continue;

      let tRoute = t;
      if (zoomInOnly) {
        const elim = eliminationTimeByPlayer.get(entry.playerId);
        if (elim != null && tRoute > elim) tRoute = elim;
      }

      let endIdx = -1;
      let lo = 0;
      let hi = track.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const mt = Number(track[mid]?.t) || 0;
        if (mt <= tRoute) {
          endIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (endIdx < 1) continue;

      const count = endIdx + 1;
      const maxPoints = zoomInOnly ? 780 : 820;
      const step = count > maxPoints ? Math.ceil(count / maxPoints) : 1;

      const points = [];
      let kept = 0;
      let prevInside = false;
      for (let i = 0; i <= endIdx; i += step) {
        const p = track[i];
        if (!p) continue;
        const inNow = inside(p);
        if (inNow || prevInside) {
          points.push(`${p.x},${p.y}`);
          kept += 1;
        }
        prevInside = inNow;
      }
      // Обязательно добавляем последнюю точку текущего времени.
      if (step > 1) {
        const last = track[endIdx];
        if (last && (inside(last) || points.length > 0)) {
          points.push(`${last.x},${last.y}`);
          kept += 1;
        }
      }
      if (points.length < 2 || kept < 2) continue;

      out.push({
        playerId: entry.playerId,
        teamId,
        pathStr: points.join(" "),
      });
    }
    return out;
  }, [
    playerTracks,
    session,
    currentTimeSec,
    focusPlayerId,
    focusTeamId,
    teamGameMode,
    zoomInOnly,
    zoom,
    containerSize.width,
    containerSize.height,
    worldSize,
    pan.x,
    pan.y,
    viewCenter.x,
    viewCenter.y,
    eliminationTimeByPlayer,
  ]);

  // Оптимизация: один проход по events для статуса жизни (а не сортировка/фильтрация на каждого игрока).
  const lifeStatusByPlayer = useMemo(() => {
    const tMax = Number(currentTimeSec) || 0;
    if (!Array.isArray(events) || events.length === 0) return new Map();

    const dead = new Set();
    const knocked = new Set();

    for (const e of events) {
      const et = Number(e?.t) || 0;
      if (et > tMax) break;
      const pidTarget = e?.target?.id;

      if (e.type === "DEATH" && pidTarget) {
        dead.add(pidTarget);
        knocked.delete(pidTarget);
      } else if (e.type === "KILL" && pidTarget) {
        dead.add(pidTarget);
        knocked.delete(pidTarget);
      } else if (e.type === "KNOCK" && pidTarget) {
        if (!dead.has(pidTarget)) knocked.add(pidTarget);
      } else if (e.type === "REVIVE" && pidTarget) {
        knocked.delete(pidTarget);
      }
    }

    const out = new Map();
    for (const pid of dead) out.set(pid, "dead");
    for (const pid of knocked) if (!out.has(pid)) out.set(pid, "knocked");
    return out;
  }, [events, currentTimeSec]);

  /** Мёртвые — ниже по z-order (рисуем раньше), живые/нок — сверху. */
  const playerMarkerRenderItems = useMemo(() => {
    const out = [];
    for (const entry of playerTracks) {
      const pos = getTrackPositionAtTime(entry.points, currentTimeSec);
      if (!pos) continue;
      const teamId = entry.teamId ?? getTeamIdForPlayer(session, entry.playerId);
      if (!isPlayerVisibleInFocus(entry.playerId, teamId, focusPlayerId, focusTeamId, teamGameMode, session))
        continue;
      const life = lifeStatusByPlayer.get(entry.playerId) || "alive";
      out.push({ entry, pos, teamId, life });
    }
    out.sort((a, b) => {
      const da = a.life === "dead" ? 0 : 1;
      const db = b.life === "dead" ? 0 : 1;
      return da - db;
    });
    return out;
  }, [playerTracks, currentTimeSec, session, focusPlayerId, focusTeamId, teamGameMode, lifeStatusByPlayer]);

  const k = (Math.min(containerSize.width, containerSize.height) / worldSize) * zoom;
  const cx = containerSize.width / 2;
  const cy = containerSize.height / 2;
  const transform = `translate(${cx + pan.x},${cy + pan.y}) scale(${k}) translate(${-viewCenter.x},${-viewCenter.y})`;
  const strokeBase = Math.max(0.5, (worldSize * 0.00045) * Math.max(1, 1 / zoom));

  const zoomTier = zoomInOnly ? getReplayZoomTier(zoom, minZoomRef.current, ZOOM_MAX_REPLAY) : "near";

  const zoneVisual =
    layers.zone && session?.zoneSnapshots?.length > 0
      ? interpolateZoneAtTime(session.zoneSnapshots, currentTimeSec)
      : null;

  const rootClass = `dna-map-canvas${zoomInOnly ? " dna-map-canvas--replay" : ""}`;
  const renderHeavyLayers = !isDragging && !isZooming;
  const renderGpuHeavyEffects = !isDragging && !isZooming;
  const renderRoutes = !isDragging && !isZooming;

  const eventsForRender = useMemo(() => {
    if (!Array.isArray(eventsToShow) || eventsToShow.length === 0) return [];
    if (!zoomInOnly) return eventsToShow;
    const horizonSec = zoom >= 4 ? 75 : zoom >= 2 ? 140 : 260;
    const tNow = Number(currentTimeSec) || 0;
    let list = eventsToShow.filter((ev) => Math.abs((Number(ev?.t) || 0) - tNow) <= horizonSec);
    if (selectedEventId && !list.some((e) => e.id === selectedEventId)) {
      const selected = eventsToShow.find((e) => e.id === selectedEventId);
      if (selected) list = [...list, selected];
    }
    const hardLimit = zoom >= 4 ? 180 : 300;
    if (list.length > hardLimit) {
      list = list.slice(Math.max(0, list.length - hardLimit));
    }
    return list;
  }, [eventsToShow, zoomInOnly, zoom, currentTimeSec, selectedEventId]);


  return (
    <div
      ref={containerRef}
      className={rootClass}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <svg
        className="dna-map-canvas-svg"
        width={containerSize.width}
        height={containerSize.height}
        viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="dnaMapCalm" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.45 0 0 0 0.04  0 0.48 0 0 0.04  0 0 0.52 0 0.06  0 0 0 1 0"
            />
          </filter>
          <filter id="dnaRouteGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dnaPlayerGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={transform}>
          {mapImageUrl && (
            <g filter={zoomInOnly ? "url(#dnaMapCalm)" : undefined}>
              <image
                href={`${mapImageUrl}${MAP_IMAGE_CACHE_BUST}`}
                x={0}
                y={0}
                width={worldSize}
                height={worldSize}
                preserveAspectRatio="xMidYMid meet"
                opacity={zoomInOnly ? 0.92 : 1}
              />
            </g>
          )}
          {!mapImageUrl && (
            <rect
              x={0}
              y={0}
              width={worldSize}
              height={worldSize}
              fill={zoomInOnly ? "#0a0c10" : "var(--surface2)"}
            />
          )}

          {layers.zone && zoneVisual && zoneVisual.safe?.r > 0 && (
            <g pointerEvents="none" opacity={zoomInOnly ? 0.9 : 0.82}>
              <path
                d={`M 0 0 H ${worldSize} V ${worldSize} H 0 Z M ${zoneVisual.safe.x} ${zoneVisual.safe.y} m -${zoneVisual.safe.r},0 a ${zoneVisual.safe.r},${zoneVisual.safe.r} 0 1,0 ${zoneVisual.safe.r * 2},0 a ${zoneVisual.safe.r},${zoneVisual.safe.r} 0 1,0 -${zoneVisual.safe.r * 2},0`}
                fill="rgba(125, 211, 252, 0.18)"
                fillRule="evenodd"
              />
              <circle
                cx={zoneVisual.safe.x}
                cy={zoneVisual.safe.y}
                r={zoneVisual.safe.r}
                fill="none"
                stroke="rgba(147, 197, 253, 0.55)"
                strokeWidth={strokeBase * 2.4}
              />
              {zoneVisual.next && zoneVisual.next.r > 0 && (
                <circle
                  cx={zoneVisual.next.x}
                  cy={zoneVisual.next.y}
                  r={zoneVisual.next.r}
                  fill="none"
                  stroke="rgba(125, 211, 252, 0.95)"
                  strokeWidth={strokeBase * 2}
                  strokeDasharray={`${strokeBase * 6} ${strokeBase * 4}`}
                />
              )}
            </g>
          )}

          {renderRoutes &&
            layers.path &&
            routeRenderData.map((entry) => {
              const teamId = entry.teamId;
              const color =
                session?.entities?.primary?.id === entry.playerId && session?.entities?.primary?.color
                  ? session.entities.primary.color
                  : session?.entities?.secondary?.id === entry.playerId && session?.entities?.secondary?.color
                    ? session.entities.secondary.color
                    : getTeamColor(teamId, sortedTeamIds);
              const rs = getReplayRouteStyle(
                entry.playerId,
                teamId,
                focusPlayerId,
                styleFocusTeamId,
                hoverPlayerId,
                zoomInOnly
              );
              const hasReplayFocus = Boolean(focusPlayerId || focusTeamId);
              const isDeadRoute = lifeStatusByPlayer.get(entry.playerId) === "dead";
              let routeGroupOpacity = rs.opacity;
              if (zoomInOnly && isDeadRoute && !hasReplayFocus) {
                routeGroupOpacity *= 0.56;
              }
              const w = strokeBase * rs.widthMul;
              return (
                <g
                  key={`route-${entry.playerId}`}
                  opacity={routeGroupOpacity}
                  filter={zoomInOnly && renderGpuHeavyEffects ? "url(#dnaRouteGlow)" : undefined}
                >
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth={w * 1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.22}
                    points={entry.pathStr}
                  />
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth={w}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={entry.pathStr}
                  />
                </g>
              );
            })}

          {renderHeavyLayers &&
            layers.fights &&
            fights.map((f) => (
              <ellipse
                key={f.id}
                cx={f.centroid.x}
                cy={f.centroid.y}
                rx={15000}
                ry={10000}
                fill="none"
                stroke="rgba(56,189,248,0.5)"
                strokeWidth={strokeBase * 2}
                opacity={zoomInOnly ? 0.35 : 0.5}
              />
            ))}

          {renderHeavyLayers &&
            layers.events &&
            eventsForRender.map((ev, idx) => {
              const imp = getEventImportance(ev.type);
              if (zoomInOnly && !isEventVisibleInReplayTier(zoomTier, ev.type, imp)) return null;

              const REPLAY_DEATH_KILL_ON_MAP_SEC = 22;
              if (
                zoomInOnly &&
                (ev.type === "DEATH" || ev.type === "KILL") &&
                ev.id !== selectedEventId
              ) {
                const evT = Number(ev.t) || 0;
                const tNow = Number(currentTimeSec) || 0;
                if (Math.abs(evT - tNow) > REPLAY_DEATH_KILL_ON_MAP_SEC) return null;
              }

              const style = getEventStyle(ev.type);
              const baseR = getEventBaseRadius(imp);
              const rOuter = baseR * (imp === "high" ? 0.96 : imp === "medium" ? 0.82 : 0.66) * (1.05 / Math.max(0.92, zoom * 0.6));
              const rInner = rOuter * 0.55;

              let op =
                getEventTemporalOpacity(ev.t, currentTimeSec, selectedEventId, ev.id) *
                getFocusDimMultiplier(ev, focusPlayerId, focusTeamId, {
                  teamGameMode,
                  session,
                });
              if (ev.t > currentTimeSec + 0.15) op *= 0.12;
              if (op < 0.04) return null;

              const isSel = selectedEventId === ev.id;
              const isHover = hoverEventId === ev.id;
              const scale = isSel ? 1.35 : isHover ? 1.12 : 1;
              const ringOpacity = Math.min(1, op + (isSel ? 0.2 : 0));

              return (
                <g
                  key={ev.id ? `ev-${ev.id}-${idx}` : `ev-idx-${idx}`}
                  className="dna-map-event-marker"
                  style={{ cursor: "pointer", opacity: ringOpacity }}
                  transform={`translate(${ev.x},${ev.y}) scale(${scale}) translate(${-ev.x},${-ev.y})`}
                  onClick={() => onSelectEvent(ev.id)}
                  onMouseEnter={() => zoomInOnly && setHoverEventId(ev.id)}
                  onMouseLeave={() => zoomInOnly && setHoverEventId(null)}
                  onKeyDown={(e) => e.key === "Enter" && onSelectEvent(ev.id)}
                  role="button"
                  tabIndex={0}
                >
                  <title>{formatEventTooltip(ev)}</title>
                  <circle
                    cx={ev.x}
                    cy={ev.y}
                    r={rOuter}
                    fill="rgba(8,10,16,0.82)"
                    stroke={style.color}
                    strokeWidth={strokeBase * (isSel ? 4 : 2.8)}
                    opacity={op}
                    filter={zoomInOnly && renderGpuHeavyEffects ? "url(#dnaPlayerGlow)" : undefined}
                  />
                  <circle
                    cx={ev.x}
                    cy={ev.y}
                    r={rInner}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={strokeBase * 1.8}
                    opacity={op * 0.9}
                  />
                  <text
                    x={ev.x}
                    y={ev.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#f8fafc"
                    stroke="rgba(0,0,0,0.85)"
                    strokeWidth={Math.max(1.5, rInner * 0.12)}
                    paintOrder="stroke fill"
                    fontSize={rInner * 1.05}
                    fontWeight="700"
                    opacity={op}
                  >
                    {style.symbol}
                  </text>
                </g>
              );
            })}

          {renderHeavyLayers &&
            layers.path &&
            playerMarkerRenderItems.map(({ entry, pos, teamId, life }) => {
              const isDead = life === "dead";
              const color =
                session?.entities?.primary?.id === entry.playerId && session?.entities?.primary?.color
                  ? session.entities.primary.color
                  : session?.entities?.secondary?.id === entry.playerId && session?.entities?.secondary?.color
                    ? session.entities.secondary.color
                    : getTeamColor(teamId, sortedTeamIds);
              const ms = getReplayMarkerStyle(
                entry.playerId,
                teamId,
                focusPlayerId,
                styleFocusTeamId,
                hoverPlayerId,
                zoomInOnly
              );
              const kSafe = Math.max(k, 1e-6);
              const rMark = ms.r;
              const markerStrokeW = zoomInOnly ? Math.max(0.55, 1.05 / kSafe) : strokeBase * 3.2;
              const labelStrokeW = zoomInOnly ? Math.max(0.45, 0.82 / kSafe) : Math.max(650, ms.r * 0.16);
              const labelFontWorld = focusTeamId || focusPlayerId
                ? Math.max(1800, ms.r * 0.62)
                : Math.max(2450, ms.r * 0.88);
              const groupOpacity = ms.opacity * (isDead ? 0.38 : 1);
              const fillOpacity = isDead ? 0.42 : 0.94;
              const strokeColor = isDead ? "rgba(15,23,42,0.35)" : "#0b1220";
              return (
                <g
                  key={`pm-${entry.playerId}`}
                  filter={zoomInOnly && renderGpuHeavyEffects && !isDead ? "url(#dnaPlayerGlow)" : undefined}
                  opacity={groupOpacity}
                  style={{ cursor: zoomInOnly && onPlayerMarkerClick ? "pointer" : undefined }}
                  onPointerDown={(e) => {
                    if (!zoomInOnly || !onPlayerMarkerClick) return;
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    if (!zoomInOnly || !onPlayerMarkerClick) return;
                    e.stopPropagation();
                    onPlayerMarkerClick(entry.playerId);
                  }}
                  role={zoomInOnly && onPlayerMarkerClick ? "button" : undefined}
                  tabIndex={zoomInOnly && onPlayerMarkerClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!zoomInOnly || !onPlayerMarkerClick) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPlayerMarkerClick(entry.playerId);
                    }
                  }}
                >
                  <title>{labelByPlayerId[entry.playerId] || entry.playerId}</title>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={rMark}
                    fill={color}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={markerStrokeW}
                  />
                  {ms.ring && !isDead && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={rMark + strokeBase * 18}
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.55)"
                      strokeWidth={strokeBase * 2.2}
                      opacity={0.95}
                    />
                  )}
                  <text
                    x={pos.x}
                    y={pos.y - rMark - Math.max(1400, ms.r * 0.55)}
                    textAnchor="middle"
                    fill={color}
                    stroke="rgba(0,0,0,0.9)"
                    strokeWidth={labelStrokeW}
                    paintOrder="stroke fill"
                    fontSize={labelFontWorld}
                    fontWeight="700"
                    opacity={Math.min(1, ms.opacity + 0.1)}
                  >
                    {focusTeamId || focusPlayerId
                      ? labelByPlayerId[entry.playerId] || entry.playerId
                      : (labelByPlayerId[entry.playerId] || entry.playerId).slice(0, 1)}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
      {!zoomInOnly && (
        <div className="dna-map-canvas-toolbar">
          <button type="button" className="dna-map-canvas-btn" onClick={handleResetView}>
            Reset view
          </button>
          <button type="button" className="dna-map-canvas-btn" onClick={handleResetView}>
            Fit to events
          </button>
        </div>
      )}
    </div>
  );
});

export default MapCanvas;
