import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDnaTestLastMatch,
  getDnaMapSession,
  getDnaMapSessionMock,
  getPubgMatches,
  getDnaMapTournaments,
  getDnaMapTournamentMatches,
} from "../../services/dnaApi";
import { DNA_MAP_IMAGE_URLS } from "../../config/pubgMaps";
import { filterTournaments } from "../../utils/testDataFilters";
import { collectReplayRoster, getTeamIdForPlayer, isSoloLikeSession } from "../../utils/replaySessionModel";

const MAP_IMAGE_CACHE_BUST = "?v=2";

function preloadMapImages() {
  DNA_MAP_IMAGE_URLS.forEach((src) => {
    const img = new Image();
    img.src = src + MAP_IMAGE_CACHE_BUST;
  });
}

const DEFAULT_LAYERS = { path: true, events: true, zone: true, fights: true };
const DEFAULT_EVENT_FILTERS = {
  LANDING: true,
  KILL: true,
  KNOCK: true,
  DEATH: true,
  REVIVE: true,
  DAMAGE: true,
  VEHICLE_ENTER: true,
  VEHICLE_EXIT: true,
  HEAL: true,
  BOOST: true,
  ZONE_DAMAGE: true,
};

/**
 * Shared DNA Map Studio state/logic, reusable inside DNA Lab.
 * DNA Lab already guards access; this hook assumes it can run.
 */
export function useDnaMapStudio({
  initialPrimaryId = "",
  initialUseDnaTest = false,
  devTools = false,
  autoLoadLastMatch = true,
  replayViewerMode = false,
} = {}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [primaryId, setPrimaryId] = useState(initialPrimaryId);
  const [secondaryId, setSecondaryId] = useState("");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedFightId, setSelectedFightId] = useState(null);
  const [isolateFightId, setIsolateFightId] = useState(null);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [eventFilters, setEventFilters] = useState(DEFAULT_EVENT_FILTERS);
  const [useDnaTest, setUseDnaTest] = useState(initialUseDnaTest);

  useEffect(() => {
    setUseDnaTest(initialUseDnaTest);
  }, [initialUseDnaTest]);
  const [sourceFile, setSourceFile] = useState(false);
  const [fileStoreMatches, setFileStoreMatches] = useState([]);
  const [loadingFileStoreList, setLoadingFileStoreList] = useState(false);
  const [devMatchId, setDevMatchId] = useState("");
  const [devPlayerId, setDevPlayerId] = useState(initialPrimaryId);
  const [focusPoint, setFocusPoint] = useState(null);

  // Premium selection: tournament -> match
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [loadingTournamentMatches, setLoadingTournamentMatches] = useState(false);
  /** Последний matchId из test DB (getDnaTestLastMatch) — для быстрого теста без выбора турнира */
  const [lastTestMatchId, setLastTestMatchId] = useState("");
  const [loadingLastTestMatch, setLoadingLastTestMatch] = useState(false);

  /** @type {'select' | 'immersing' | 'replay'} */
  const [replayPhase, setReplayPhase] = useState(() => (replayViewerMode ? "select" : "replay"));
  const [feedUnlockedAfterPlay, setFeedUnlockedAfterPlay] = useState(false);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  /** @type {'events' | 'player' | 'team' | 'eventDetail'} */
  const [rightPanelMode, setRightPanelMode] = useState("events");
  const [focusTeamId, setFocusTeamId] = useState(null);
  const [focusPlayerId, setFocusPlayerId] = useState(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  const feedUnlockRef = useRef(false);

  const effectiveDnaTest = useDnaTest;

  // В реплее ограничиваем “доступный” таймлайн до момента смерти фокусируемого игрока/команды.
  const effectiveReplayDurationSec = useMemo(() => {
    const baseDuration = session?.match?.durationSec ?? 1200;
    if (!replayViewerMode) return baseDuration;
    if (!focusPlayerId && !focusTeamId) return baseDuration;
    const evs = Array.isArray(session?.events) ? session.events : [];
    if (!evs.length) return baseDuration;

    if (focusPlayerId) {
      if (!isSoloLikeSession(session)) {
        const tid = focusTeamId ?? getTeamIdForPlayer(session, focusPlayerId);
        if (tid != null) {
          const rosterEarly = collectReplayRoster(session);
          const memberIdsEarly = rosterEarly
            .filter((p) => p.teamId != null && String(p.teamId) === String(tid))
            .map((p) => p.id)
            .filter(Boolean);
          if (memberIdsEarly.length > 0) {
            const memberSetEarly = new Set(memberIdsEarly);
            const deathMaxByPlayerEarly = new Map();
            for (const e of evs) {
              if (e.type !== "DEATH") continue;
              const pid = e.target?.id;
              if (!pid || !memberSetEarly.has(pid)) continue;
              const t = Number(e.t) || 0;
              const prev = deathMaxByPlayerEarly.get(pid);
              if (prev == null || t > prev) deathMaxByPlayerEarly.set(pid, t);
            }
            const allDeadEarly = memberIdsEarly.every((pid) => deathMaxByPlayerEarly.has(pid));
            if (allDeadEarly) {
              const valsEarly = Array.from(deathMaxByPlayerEarly.values());
              if (valsEarly.length) return Math.max(...valsEarly);
            }
          }
        }
      }
      const deathTs = evs.filter((e) => e.type === "DEATH" && e.target?.id === focusPlayerId).map((e) => Number(e.t) || 0);
      return deathTs.length ? Math.max(...deathTs) : baseDuration;
    }

    // Команда: считаем окончанием, когда умерли все игроки команды.
    const roster = collectReplayRoster(session);
    const memberIds = roster
      .filter((p) => p.teamId != null && String(p.teamId) === String(focusTeamId))
      .map((p) => p.id)
      .filter(Boolean);
    if (!memberIds.length) return baseDuration;
    const memberSet = new Set(memberIds);
    const deathMaxByPlayer = new Map();
    for (const e of evs) {
      if (e.type !== "DEATH") continue;
      const pid = e.target?.id;
      if (!pid || !memberSet.has(pid)) continue;
      const t = Number(e.t) || 0;
      const prev = deathMaxByPlayer.get(pid);
      if (prev == null || t > prev) deathMaxByPlayer.set(pid, t);
    }
    const allDead = memberIds.every((pid) => deathMaxByPlayer.has(pid));
    if (!allDead) return baseDuration;
    const vals = Array.from(deathMaxByPlayer.values());
    return vals.length ? Math.max(...vals) : baseDuration;
  }, [session, replayViewerMode, focusPlayerId, focusTeamId]);

  useEffect(() => {
    if (!replayViewerMode) return;
    if (currentTimeSec > effectiveReplayDurationSec) {
      setIsPlaying(false);
      setCurrentTimeSec(effectiveReplayDurationSec);
    }
  }, [replayViewerMode, currentTimeSec, effectiveReplayDurationSec]);

  const loadSession = useCallback(
    async (overrideMatchId, overridePrimary, overrideSecondary, optionsOverride) => {
      const id = (overrideMatchId ?? matchId ?? devMatchId)?.trim();
      const prim = overridePrimary ?? primaryId ?? devPlayerId;
      const sec = overrideSecondary ?? (compareEnabled ? secondaryId : "");
      if (!id) {
        setError("Выберите матч или загрузите последний матч.");
        return false;
      }
      setLoading(true);
      setError(null);
      const options = optionsOverride ?? (sourceFile ? { source: "file" } : { useDnaTest: effectiveDnaTest });
      try {
        const data = await getDnaMapSession(id, prim, sec, "player", options);
        setSession(data);
        setMatchId(id);
        setPrimaryId(prim);
        if (compareEnabled && sec) setSecondaryId(sec);
        setCurrentTimeSec(0);
        setSelectedEventId(null);
        setSelectedFightId(null);
        return true;
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || "Не удалось загрузить сессию.";
        setError(msg);
        try {
          const mockData = getDnaMapSessionMock(id, prim, sec);
          setSession(mockData);
          setMatchId(id);
          setPrimaryId(prim);
          if (sec) setSecondaryId(sec);
          setCurrentTimeSec(0);
          setError(null);
          return true;
        } catch (_) {
          setSession(null);
          return false;
        }
      } finally {
        setLoading(false);
      }
    },
    [matchId, primaryId, secondaryId, compareEnabled, effectiveDnaTest, sourceFile, devMatchId, devPlayerId]
  );

  const loadFileStoreMatches = useCallback(async () => {
    setLoadingFileStoreList(true);
    try {
      const list = await getPubgMatches();
      setFileStoreMatches(Array.isArray(list) ? list : []);
    } catch (_e) {
      setFileStoreMatches([]);
    } finally {
      setLoadingFileStoreList(false);
    }
  }, []);

  const handleFileStoreMatchSelect = useCallback(
    (selectedMatchId) => {
      if (!selectedMatchId) return;
      setSourceFile(true);
      setMatchId(selectedMatchId);
      loadSession(selectedMatchId, primaryId, compareEnabled ? secondaryId : "", { source: "file" });
    },
    [loadSession, primaryId, secondaryId, compareEnabled]
  );

  const loadLastMatch = useCallback(async () => {
    try {
      const last = await getDnaTestLastMatch();
      if (last?.matchId) {
        setDevMatchId(last.matchId);
        setError(null);
        await loadSession(last.matchId, devPlayerId || primaryId, compareEnabled ? secondaryId : "");
      } else {
        setError("Нет матча в тестовой БД. Запустите fetch_Last_Match_To_DnaTest.js");
      }
    } catch (_e) {
      setError("Не удалось загрузить последний матч.");
    }
  }, [loadSession, devPlayerId, primaryId, secondaryId, compareEnabled]);

  useEffect(() => {
    preloadMapImages();
  }, []);

  useEffect(() => {
    if (!autoLoadLastMatch || replayViewerMode) return;
    loadLastMatch();
  }, [autoLoadLastMatch, replayViewerMode, loadLastMatch]);

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true);
    try {
      const list = await getDnaMapTournaments({ useDnaTest: effectiveDnaTest });
      let arr = Array.isArray(list) ? list : [];
      if (effectiveDnaTest && replayViewerMode && devTools) {
        const testOnly = arr.filter(
          (t) =>
            String(t.name || "")
              .trim()
              .toLowerCase() === "test" || String(t.id || "").toLowerCase() === "test"
        );
        arr = testOnly.length > 0 ? testOnly : arr;
      } else {
        arr = filterTournaments(arr);
      }
      setTournaments(arr);
    } catch (_e) {
      setTournaments([]);
    } finally {
      setLoadingTournaments(false);
    }
  }, [effectiveDnaTest, replayViewerMode, devTools]);

  const fetchLastTestMatchMeta = useCallback(async () => {
    if (!replayViewerMode || !effectiveDnaTest || !devTools) return;
    setLoadingLastTestMatch(true);
    try {
      const last = await getDnaTestLastMatch();
      if (last?.matchId) {
        setLastTestMatchId(String(last.matchId));
        setError(null);
      }
    } catch (_e) {
      setLastTestMatchId("");
    } finally {
      setLoadingLastTestMatch(false);
    }
  }, [replayViewerMode, effectiveDnaTest, devTools]);

  useEffect(() => {
    fetchLastTestMatchMeta();
  }, [fetchLastTestMatchMeta]);

  const applyLastTestMatchFromTestDb = useCallback(() => {
    if (!lastTestMatchId?.trim()) {
      setError("Нет последнего матча в test DB.");
      return;
    }
    setMatchId(lastTestMatchId.trim());
    setSession(null);
    setCurrentTimeSec(0);
    setSelectedEventId(null);
    setSelectedFightId(null);
    setIsolateFightId(null);
    setFocusPoint(null);
    setError(null);
    setIsPlaying(false);
    feedUnlockRef.current = false;
    setFeedUnlockedAfterPlay(false);
    setReplayPhase("select");
  }, [lastTestMatchId]);

  const loadTournamentMatches = useCallback(async (tournamentId) => {
    if (!tournamentId) {
      setTournamentMatches([]);
      return;
    }
    setLoadingTournamentMatches(true);
    try {
      const list = await getDnaMapTournamentMatches(tournamentId, { useDnaTest: effectiveDnaTest });
      setTournamentMatches(Array.isArray(list) ? list : []);
    } catch (_e) {
      setTournamentMatches([]);
    } finally {
      setLoadingTournamentMatches(false);
    }
  }, [effectiveDnaTest]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const resetReplayUiState = useCallback(() => {
    setReplayPhase("select");
    feedUnlockRef.current = false;
    setFeedUnlockedAfterPlay(false);
    setFeedCollapsed(false);
    setRightPanelMode("events");
    setFocusTeamId(null);
    setFocusPlayerId(null);
    setPlayerSearchQuery("");
  }, []);

  const handleTournamentChange = useCallback(
    async (tournamentId) => {
      setSelectedTournamentId(tournamentId);
      setTournamentMatches([]);
      setMatchId("");
      setSession(null);
      setCurrentTimeSec(0);
      setSelectedEventId(null);
      setSelectedFightId(null);
      setIsolateFightId(null);
      setFocusPoint(null);
      setError(null);
      setIsPlaying(false);
      if (replayViewerMode) {
        resetReplayUiState();
      }
      await loadTournamentMatches(tournamentId);
    },
    [loadTournamentMatches, replayViewerMode, resetReplayUiState]
  );

  useEffect(() => {
    if (!replayViewerMode) return;
    if (tournaments.length !== 1) return;
    if (selectedTournamentId) return;
    const tid = tournaments[0]?.id;
    if (!tid) return;
    handleTournamentChange(String(tid));
  }, [replayViewerMode, tournaments, selectedTournamentId, handleTournamentChange]);

  const handleTournamentMatchSelect = useCallback(
    async (nextMatchId) => {
      if (!nextMatchId) return;
      setMatchId(nextMatchId);
      setSession(null);
      setCurrentTimeSec(0);
      setSelectedEventId(null);
      setSelectedFightId(null);
      setIsolateFightId(null);
      setFocusPoint(null);
      setError(null);
      setIsPlaying(false);

      if (replayViewerMode) {
        feedUnlockRef.current = false;
        setFeedUnlockedAfterPlay(false);
        setReplayPhase("select");
        return;
      }

      await loadSession(nextMatchId, primaryId, compareEnabled ? secondaryId : "");
    },
    [loadSession, primaryId, compareEnabled, secondaryId, replayViewerMode]
  );

  const enterReplayMatch = useCallback(async () => {
    if (!matchId?.trim()) return;
    setReplayPhase("immersing");
    setIsPlaying(false);
    setError(null);
    feedUnlockRef.current = false;
    setFeedUnlockedAfterPlay(false);
    setFeedCollapsed(false);

    await new Promise((r) => setTimeout(r, 1100));

    const ok = await loadSession(matchId, primaryId, compareEnabled ? secondaryId : "");
    if (!ok) {
      setReplayPhase("select");
      return;
    }
    feedUnlockRef.current = true;
    setFeedUnlockedAfterPlay(true);
    setReplayPhase("replay");
  }, [matchId, primaryId, secondaryId, compareEnabled, loadSession]);

  /** Выйти из реплея к выбору матча (турнир сохраняется). */
  const backToMatchSelection = useCallback(() => {
    setSession(null);
    setMatchId("");
    setCurrentTimeSec(0);
    setSelectedEventId(null);
    setSelectedFightId(null);
    setIsolateFightId(null);
    setIsPlaying(false);
    setReplayPhase("select");
    feedUnlockRef.current = false;
    setFeedUnlockedAfterPlay(false);
    setFeedCollapsed(false);
    setRightPanelMode("events");
    setFocusTeamId(null);
    setFocusPlayerId(null);
    setPlayerSearchQuery("");
  }, []);

  const resetReplayFocus = useCallback(() => {
    setFocusTeamId(null);
    setFocusPlayerId(null);
    setPlayerSearchQuery("");
    setFocusPoint(null);
  }, []);

  const deathEvent = useMemo(() => session?.events?.find((e) => e.type === "DEATH"), [session?.events]);

  const handleFocusDeath = useCallback(() => {
    if (deathEvent) {
      setCurrentTimeSec(deathEvent.t);
      setSelectedEventId(deathEvent.id);
    }
  }, [deathEvent]);

  const handleFocusPoint = useCallback((x, y) => {
    setFocusPoint({ x, y });
  }, []);

  // ===== Player controls (play / pause / speed) =====
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const advanceAccSecRef = useRef(0);
  const PLAY_TICK_SEC = 1.1; // меньше частота setState → меньше лагов

  const seekCurrentTimeSec = useCallback((t) => {
    setIsPlaying(false);
    setCurrentTimeSec(t);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!session?.match) return;
    setIsPlaying((p) => {
      const next = !p;
      if (replayViewerMode && !p && next && !feedUnlockRef.current) {
        feedUnlockRef.current = true;
        setFeedUnlockedAfterPlay(true);
      }
      return next;
    });
  }, [session?.match, replayViewerMode]);

  useEffect(() => {
    if (!isPlaying) return;
    const durationSec = effectiveReplayDurationSec;
    if (!durationSec) return;

    lastTsRef.current = null;
    advanceAccSecRef.current = 0;

    const tick = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      advanceAccSecRef.current += dtSec * playSpeed;

      if (advanceAccSecRef.current >= PLAY_TICK_SEC) {
        const steps = Math.floor(advanceAccSecRef.current / PLAY_TICK_SEC);
        const advanceSec = steps * PLAY_TICK_SEC;
        advanceAccSecRef.current -= steps * PLAY_TICK_SEC;

        setCurrentTimeSec((prev) => {
          const next = Math.min(durationSec, (prev ?? 0) + advanceSec);
          if (next >= durationSec) setIsPlaying(false);
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      advanceAccSecRef.current = 0;
    };
  }, [isPlaying, playSpeed, effectiveReplayDurationSec, session?.match?.durationSec]);

  // Auto-highlight event at current time (so map has "active marker" while playing).
  const sortedSessionEvents = useMemo(() => {
    const evts = session?.events ?? [];
    if (!Array.isArray(evts) || evts.length === 0) return [];
    return [...evts].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  }, [session?.events]);

  useEffect(() => {
    if (!sortedSessionEvents.length) return;
    let lo = 0;
    let hi = sortedSessionEvents.length - 1;
    let best = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const e = sortedSessionEvents[mid];
      if ((e.t ?? 0) <= currentTimeSec) {
        best = e;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const nextId = best?.id ?? null;
    setSelectedEventId((prev) => (prev === nextId ? prev : nextId));
  }, [sortedSessionEvents, currentTimeSec]);

  return {
    session,
    loading,
    error,
    currentTimeSec,
    setCurrentTimeSec,
    seekCurrentTimeSec,
    isPlaying,
    playSpeed,
    togglePlayPause,
    setPlaySpeed,
    selectedEventId,
    selectedFightId,
    setSelectedEventId,
    setSelectedFightId,
    compareEnabled,
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
    secondaryId,
    setMatchId,
    setPrimaryId,
    setSecondaryId,
    setCompareEnabled,
    useDnaTest,
    setUseDnaTest,
    devTools,
    effectiveDnaTest,
    devMatchId,
    devPlayerId,
    setDevMatchId,
    setDevPlayerId,
    loadLastMatch,
    loadSession,
    sourceFile,
    setSourceFile,
    fileStoreMatches,
    loadingFileStoreList,
    loadFileStoreMatches,
    handleFileStoreMatchSelect,
    isolateFightId,
    setIsolateFightId,

    // Premium selection
    tournaments,
    loadingTournaments,
    selectedTournamentId,
    tournamentMatches,
    loadingTournamentMatches,
    onTournamentChange: handleTournamentChange,
    onTournamentMatchSelect: handleTournamentMatchSelect,

    // Replay viewer (DNA Lab → Карта)
    replayViewerMode,
    replayPhase,
    feedUnlockedAfterPlay,
    feedCollapsed,
    setFeedCollapsed,
    rightPanelMode,
    setRightPanelMode,
    focusTeamId,
    setFocusTeamId,
    focusPlayerId,
    setFocusPlayerId,
    playerSearchQuery,
    setPlayerSearchQuery,
    enterReplayMatch,
    backToMatchSelection,
    resetReplayFocus,

    lastTestMatchId,
    loadingLastTestMatch,
    applyLastTestMatchFromTestDb,
  };
}
