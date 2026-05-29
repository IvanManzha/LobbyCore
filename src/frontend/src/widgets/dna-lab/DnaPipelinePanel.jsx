import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { postPipeline, getPipelineStatus, postPipelineRetry, syncGenesFromTestDb } from "@/services/dnaApi";

const POLL_INTERVAL_MS = 1500;

/**
 * Pipeline UI — Sync DNA (full pipeline) or Sync genes (from test DB only).
 */
export default function DnaPipelinePanel({
  profile,
  playerIds,
  seasonId,
  onComplete,
  useDnaTest = false,
}) {
  const { t } = useTranslation();
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [syncingGenes, setSyncingGenes] = useState(false);
  const pollRef = useRef(null);

  const matchHistory = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches ?? [];
  const matchIds = matchHistory.map((m) => m.matchId || m.id).filter(Boolean);
  const canRunPipeline = matchIds.length > 0 && Array.isArray(playerIds) && playerIds.length > 0;
  const playerId = profile?.playerId || (playerIds && playerIds[0]);
  // Основная кнопка в UI должна повторять поведение скрипта sync dna:
  // backend POST /dna/sync-genes -> DnaService.syncGenesFromDnaTestDb
  const canSyncGenes = Boolean(playerId);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const data = await getPipelineStatus(jobId);
        setStatus(data);
        if (data.status === "done" || data.status === "failed") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setJobId(null);
          if (data.status === "done" && onComplete) onComplete();
        }
      } catch (e) {
        setError(e?.message || "Failed to get status");
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, onComplete]);

  const handleRetry = async () => {
    const failed = status?.result?.failed;
    if (!failed?.length) return;
    setRetrying(true);
    setError(null);
    try {
      await postPipelineRetry({ matchIds: failed });
      handleRun();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const handleRun = async () => {
    if (!canRunPipeline) return;
    setError(null);
    setStatus(null);
    try {
      const { jobId: id } = await postPipeline({
        matchIds,
        playerIds,
        seasonId: seasonId || "2025",
      });
      setJobId(id);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to start pipeline");
    }
  };

  const handleSyncGenes = async () => {
    if (!canSyncGenes) return;
    setError(null);
    setSyncingGenes(true);
    try {
      await syncGenesFromTestDb(playerId, seasonId || "2025");
      onComplete?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || t("dnaLab.syncGenesFailed"));
    } finally {
      setSyncingGenes(false);
    }
  };

  const isRunning = jobId != null || (status && status.status === "running");

  return (
    <div className="dnaPipelinePanel">
      <button
        type="button"
        className="dnaPipelineBtn"
        onClick={handleSyncGenes}
        disabled={!canSyncGenes || syncingGenes}
        title={canSyncGenes ? "Run sync dna from test DB (same as script)" : "Select a player to sync"}
      >
        {syncingGenes ? t("dnaLab.syncingGenes") : useDnaTest ? t("dnaLab.syncGenes") : t("dnaLab.syncDna")}
      </button>
      {error && <span className="dnaPipelineError">{error}</span>}
      {status?.status === "running" && status?.progress && (
        <div className="dnaPipelineProgress">
          <span className="dnaPipelinePhase">{status.progress.phase}</span>
          <span className="dnaPipelineCount">
            {status.progress.current}/{status.progress.total}
          </span>
          {status.progress.failed?.length > 0 && (
            <span className="dnaPipelineFailed">({status.progress.failed.length} failed)</span>
          )}
        </div>
      )}
      {status?.status === "done" && status?.result && (
        <div className="dnaPipelineDone">
          ingested: {status.result.ingested}, extracted: {status.result.extracted}, recomputed:{" "}
          {status.result.recomputed}
          {status.result.failed?.length > 0 && (
            <>
              <span> ({status.result.failed.length} failed)</span>
              <button
                type="button"
                className="dnaPipelineRetryBtn"
                onClick={handleRetry}
                disabled={retrying}
              >
                Retry failed
              </button>
            </>
          )}
        </div>
      )}
      {status?.status === "failed" && (
        <div className="dnaPipelineFailedMsg">{status.error}</div>
      )}
      <p className="dnaPipelineHint">Кнопка использует тот же backend sync, что и скрипт sync dna.</p>
    </div>
  );
}
