import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import {
  DnaStagePlaceholder,
  GenesView,
  GenesMinimalScene,
  DnaLabMapView,
  DnaDevDrawer,
} from '@/widgets/dna-lab';
import { getSeasons, getProfile, getDictionary } from "../services/dnaApi";
import { getPreloadedDnaData } from "../contexts/DnaPreloadContext";
import { useAuth } from "../hooks/useAuth";
import { useDnaLabShell } from "../contexts/DnaLabShellContext";
import { DEVELOPERS } from "../config/app";
import "./DnaLab.css";

const MIN_REQUIRED_MATCHES = 3;

/** Сессионный кеш DNA Lab: один раз за сессию загруженные данные хранятся в памяти.
 * Повторный заход — без запросов. Исключение: refreshTrigger (ручное обновление) или
 * смена playerId/seasonId/useDnaTest. При завершении матча на бэке — нужен ручной Refresh
 * или будущий механизм инвалидации по updatedAt. */
const dnaLabSessionCache = new Map();

function dnaLabCacheKey(playerId, seasonId, useDnaTest) {
  return `${playerId}:${seasonId}:${useDnaTest ? "1" : "0"}`;
}

function clearDnaLabSessionCache(playerId, seasonId, useDnaTest) {
  dnaLabSessionCache.delete(dnaLabCacheKey(playerId, seasonId, useDnaTest));
}

/**
 * DNA Lab — Sprint 0: Shell mode with Stage Placeholder. Sprint 2+: Gene Garden.
 * Uses DnaLabShell when at /dna-lab (Layout renders shell, no sidebar/topbar).
 */
export default function DnaLab() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const shell = useDnaLabShell();

  const isDeveloper = useMemo(() => {
    if (!user) return false;
    const key = (user.pubgNick || user.username || "").trim().toLowerCase();
    return DEVELOPERS.length > 0 && DEVELOPERS.includes(key);
  }, [user]);

  const seasonId = shell?.seasonId ?? "2025";
  const setSeasonId = shell?.setSeasonId;

  useEffect(() => {
    if (authLoading === false && !isDeveloper) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isDeveloper, navigate]);

  const [profile, setProfile] = useState(null);
  const [dictionary, setDictionary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const playerId = user?.pubgNick || user?.username || "me";
  const [seasons, setSeasons] = useState(["2025", "2026"]);
  const useDnaTest = shell?.useDnaTest ?? false;

  useEffect(() => {
    let cancelled = false;
    getSeasons()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.seasons) && res.seasons.length > 0) {
          setSeasons(res.seasons);
          if (setSeasonId && res.seasons.length > 0) {
            setSeasonId((prev) => (res.seasons.includes(prev) ? prev : res.seasons[0]));
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [setSeasonId]);

  useEffect(() => {
    let cancelled = false;
    const key = dnaLabCacheKey(playerId, seasonId, useDnaTest);

    // Сессионный кеш: при повторном заходе используем кеш без запросов (если не ручной Refresh)
    if (refreshTrigger === 0) {
      const cached = dnaLabSessionCache.get(key);
      if (cached?.profile) {
        setProfile(cached.profile);
        setDictionary(Array.isArray(cached.dictionary) ? cached.dictionary : []);
        setLoading(false);
        setError(null);
        return;
      }
    }

    const preloaded = getPreloadedDnaData(playerId, seasonId, useDnaTest);
    if (preloaded?.profile && refreshTrigger === 0) {
      setProfile(preloaded.profile);
      setDictionary(Array.isArray(preloaded.dictionary) ? preloaded.dictionary : []);
      setLoading(false);
      setError(null);
      dnaLabSessionCache.set(key, { profile: preloaded.profile, dictionary: preloaded.dictionary || [] });
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, dictRes] = await Promise.all([
          getProfile(playerId, seasonId, { useDnaTest }),
          getDictionary(),
        ]);
        if (!cancelled) {
          setProfile(profileRes);
          setDictionary(Array.isArray(dictRes) ? dictRes : []);
          dnaLabSessionCache.set(key, { profile: profileRes, dictionary: Array.isArray(dictRes) ? dictRes : [] });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || "Failed to load DNA data");
          setProfile({
            playerId,
            seasonId,
            coreScore: null,
            confidence: "low",
            coverage: { matchesTotal: 0, telemetryMatches: 0 },
            genes: [],
            matches: [],
            matchHistory: [],
            reasons: { perGene: {} },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [playerId, seasonId, useDnaTest, refreshTrigger]);

  const [selectedGeneKey, setSelectedGeneKey] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const prevFocusModeRef = useRef(shell?.focusMode ?? null);

  useEffect(() => {
    const next = shell?.focusMode ?? null;
    if (prevFocusModeRef.current !== null && next === null) {
      setSelectedGeneKey(null);
    }
    prevFocusModeRef.current = next;
  }, [shell?.focusMode]);

  useEffect(() => {
    const list = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches;
    if (list?.length && selectedMatchId == null) {
      const last = list[list.length - 1];
      setSelectedMatchId(last?.matchId ?? last?.id ?? null);
    }
  }, [profile?.matches, profile?.matchHistory, selectedMatchId]);

  const activeTab = shell?.activeTab ?? "genes";

  const onSelectMatch = (matchId) => setSelectedMatchId(matchId);

  const safeProfile = profile || {
    playerId,
    seasonId,
    coreScore: null,
    confidence: "low",
    coverage: { matchesTotal: 0, telemetryMatches: 0 },
    genes: [],
    matches: [],
    matchHistory: [],
  };

  const matchesTotal = safeProfile?.coverage?.matchesTotal ?? safeProfile?.matches?.length ?? 0;
  const hasEnoughData = matchesTotal >= MIN_REQUIRED_MATCHES;
  const matchesNeeded = Math.max(0, MIN_REQUIRED_MATCHES - matchesTotal);
  const telemetryMatches = safeProfile?.coverage?.telemetryMatches ?? matchesTotal;
  const isPartialCoverage = matchesTotal > 0 && telemetryMatches < matchesTotal;

  const stageStatus = useMemo(() => {
    if (loading && !profile) return "loading";
    if (matchesTotal === 0) return "empty";
    if (isPartialCoverage) return "partial";
    return "ready";
  }, [loading, profile, matchesTotal, isPartialCoverage]);

  // Sprint 8: Share context (stable deps to avoid infinite loop)
  const setShareContext = shell?.setShareContext;
  useEffect(() => {
    if (!setShareContext) return;
    const prof = profile || {
      playerId,
      seasonId,
      coreScore: null,
      genes: [],
      matchHistory: [],
    };
    const geneValue =
      prof?.genes?.find((g) => g.key === selectedGeneKey)?.value ?? null;
    setShareContext({
      profile: prof,
      activeGeneKey: selectedGeneKey,
      geneValue,
    });
  }, [setShareContext, profile, selectedGeneKey, playerId, seasonId]);

  const scrubberMatches = safeProfile?.matchHistory?.length
    ? safeProfile.matchHistory
    : safeProfile?.matches ?? [];
  useEffect(() => {
    if (scrubberMatches.length < 2 || activeTab !== "genes") return;
    const handle = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (
        e.target?.closest?.("input") ||
        e.target?.closest?.("textarea") ||
        e.target?.closest?.("select")
      )
        return;
      const idx = scrubberMatches.findIndex((m) => (m.matchId || m.id) === selectedMatchId);
      if (idx < 0) return;
      const nextIdx =
        e.key === "ArrowLeft"
          ? Math.max(0, idx - 1)
          : Math.min(scrubberMatches.length - 1, idx + 1);
      const next = scrubberMatches[nextIdx];
      if (next) setSelectedMatchId(next.matchId || next.id);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [scrubberMatches, selectedMatchId, activeTab]);

  const pipelinePlayerIds = useMemo(() => [playerId], [playerId]);
  const pipelineProfile = useMemo(() => safeProfile, [safeProfile]);

  const [devDrawerOpen, setDevDrawerOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="dnaLabPage dnaLabPageShell">
        <DnaStagePlaceholder status="loading" />
      </div>
    );
  }

  if (!isDeveloper) {
    return (
      <div className="dnaLabPage dnaLabPageShell">
        <div className="dnaLabRedirect">Перенаправление…</div>
      </div>
    );
  }

  if (activeTab === "map") {
    return (
      <div className="dnaLabPage dnaLabPageShell">
        <DnaLabMapView />
      </div>
    );
  }

  if (hasEnoughData && stageStatus === "ready") {
    const dnaMinimal = shell?.dnaMinimal && shell?.activeTab === "genes";
    return (
      <div className="dnaLabPage dnaLabPageShell">
        <button
          type="button"
          className="dnaDevDrawerToggle"
          onClick={() => setDevDrawerOpen(true)}
          title={useDnaTest ? t("dnaLab.syncGenes") : t("dnaLab.syncDna")}
        >
          ⟳
        </button>
        {!dnaMinimal && loading && profile && (
          <div className="dnaLabUpdatingBadge" aria-live="polite">
            Updating…
          </div>
        )}
        {dnaMinimal ? (
          <GenesMinimalScene
            profile={safeProfile}
            dictionary={dictionary}
            activeGeneKey={selectedGeneKey}
            onSelectGene={setSelectedGeneKey}
            selectedMatchId={selectedMatchId}
            onSelectMatch={onSelectMatch}
            focusMode={shell?.focusMode ?? null}
            onFocusModeChange={shell?.setFocusMode}
            seasonId={seasonId}
            seasons={shell?.seasons ?? ["2025", "2026"]}
            onSeasonChange={shell?.setSeasonId}
          />
        ) : (
          <GenesView
            profile={safeProfile}
            dictionary={dictionary}
            activeGeneKey={selectedGeneKey}
            onSelectGene={setSelectedGeneKey}
            selectedMatchId={selectedMatchId}
            onSelectMatch={onSelectMatch}
            inspectorOpen={shell?.inspectorOpen}
            onToggleInspector={() => shell?.setInspectorOpen?.((o) => !o)}
          />
        )}
        <DnaDevDrawer
          open={devDrawerOpen}
          onClose={() => setDevDrawerOpen(false)}
          profile={pipelineProfile}
          playerIds={pipelinePlayerIds}
          seasonId={seasonId}
          useDnaTest={useDnaTest}
          onComplete={() => {
            setRefreshTrigger((x) => x + 1);
            setDevDrawerOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="dnaLabPage dnaLabPageShell">
      <div className="dnaLabStageArea">
        <DnaStagePlaceholder status={stageStatus} />
      </div>
      <button
        type="button"
        className="dnaLabInspectorHint"
        disabled
        title="Coming soon"
        aria-label="Inspector coming soon"
      >
        i
      </button>
    </div>
  );
}
