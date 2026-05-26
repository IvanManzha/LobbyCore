import React, { useMemo, useCallback, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "../../contexts/LanguageContext";
import GeneGardenMinimal from "./GeneGardenMinimal";
import DnaInsightCarousel from "./DnaInsightCarousel";
import { GENES } from "./mock/dnaMock";
import DnaTierBadge from "./DnaTierBadge";
import TierExplanationModal from "./TierExplanationModal";
import ArchetypeExplanationModal from "./ArchetypeExplanationModal";

/** 3-буквенные аббревиатуры метрик (единый набор по всему DNA Lab) */
const SHORT_LABELS = {
  accuracy: "AIM",
  tactics: "TAC",
  aggression: "AGR",
  survival: "SUR",
  positioning: "POS",
  teamwork: "TMW",
  resource: "RES",
  composure: "COM",
};

const HINT_SEEN_KEY = "dnaMinimalHintSeen";
const HINT_DURATION_MS = 2600;

/**
 * Genes Minimal Scene: Gene Garden (left) + Core Score (center).
 * Idle: no panels. Focus: gene panel or core panel on right; score moves up, garden narrows.
 */
export default function GenesMinimalScene({
  profile = {},
  dictionary = [],
  activeGeneKey,
  onSelectGene,
  selectedMatchId,
  onSelectMatch,
  focusMode = null,
  onFocusModeChange,
  seasonId = "2025",
  seasons = [],
  onSeasonChange,
}) {
  const profileGenesBase = profile.genes ?? [];
  const matchHistory = profile.matchHistory ?? [];
  const selectedMatch = selectedMatchId
    ? matchHistory.find((m) => (m.matchId || m.id) === selectedMatchId)
    : null;
  const profileGenes = useMemo(() => profileGenesBase, [profileGenesBase]);

  const genes = useMemo(() => {
    return GENES.map((g) => {
      const dict = dictionary.find((d) => (d.id || d.key) === g.key);
      const pg = profileGenesBase.find((x) => x.key === g.key);
      return {
        ...g,
        label: pg?.label ?? dict?.label ?? dict?.name ?? g.label,
        shortLabel: SHORT_LABELS[g.key] ?? pg?.shortLabel ?? dict?.shortLabel ?? g.label?.slice(0, 4) ?? g.key?.slice(0, 4),
      };
    });
  }, [dictionary, profileGenesBase]);

  const geneInProfile = profileGenes.find((g) => g.key === activeGeneKey);
  const geneInBase = profileGenesBase.find((g) => g.key === activeGeneKey);
  const geneValue = geneInProfile?.value ?? null;

  const geneTrend = useMemo(() => {
    if (selectedMatch && matchHistory?.length >= 2 && activeGeneKey) {
      const idx = matchHistory.findIndex((m) => (m.matchId || m.id) === selectedMatchId);
      if (idx > 0) {
        const curr = matchHistory[idx]?.geneValues?.[activeGeneKey];
        const prev = matchHistory[idx - 1]?.geneValues?.[activeGeneKey];
        if (curr != null && prev != null) {
          const delta = Math.round((Number(curr) - Number(prev)) * 10) / 10;
          return { delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
        }
      }
      return null;
    }
    return geneInBase?.trend ?? null;
  }, [selectedMatch, selectedMatchId, matchHistory, activeGeneKey, geneInBase?.trend]);

  const confidence = profile.confidence ?? geneInProfile?.confidence;
  const activeGene = genes.find((g) => g.key === activeGeneKey);
  const geneLabel = activeGene?.label ?? geneInProfile?.label ?? activeGeneKey;
  const dictionaryEntry = useMemo(
    () => dictionary.find((d) => (d.id || d.key) === activeGeneKey),
    [dictionary, activeGeneKey]
  );

  const coreScore = profile?.coreScore;
  const hasCoreScore = coreScore != null && !Number.isNaN(coreScore);
  const coreDisplay = hasCoreScore ? String(Math.round(coreScore)) : "—";
  const dnaTier = profile?.dnaTier ?? null;
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [archetypeModalState, setArchetypeModalState] = useState({ open: false, mode: "why-this" });
  const dominantTrait = profile?.dominantTrait ?? null;
  const { strongestKeys, weakestKeys } = useMemo(() => {
    const withValues = (profile.genes ?? []).filter((g) => g.value != null && !Number.isNaN(g.value));
    if (withValues.length < 2) return { strongestKeys: [], weakestKeys: [] };
    const sorted = [...withValues].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return {
      strongestKeys: sorted.slice(0, 2).map((g) => g.key),
      weakestKeys: sorted.slice(-2).reverse().map((g) => g.key),
    };
  }, [profile.genes]);
  const strongestLabels = strongestKeys.map((k) => genes.find((g) => g.key === k)?.label ?? k);
  const weakestLabels = weakestKeys.map((k) => genes.find((g) => g.key === k)?.label ?? k);

  const lastClosedGeneRef = useRef(null);
  const flyoutRef = useRef(null);
  const rightAreaRef = useRef(null);
  const unfocusingDeltaRef = useRef(null);

  const closeFocus = useCallback(() => {
    onFocusModeChange?.(null);
  }, [onFocusModeChange]);

  const handleGeneSelect = useCallback(
    (key) => {
      if (lastClosedGeneRef.current === key) {
        lastClosedGeneRef.current = null;
        return;
      }
      if (focusMode === "gene" && key === activeGeneKey) {
        lastClosedGeneRef.current = key;
        closeFocus();
        onSelectGene?.(null);
        setTimeout(() => {
          lastClosedGeneRef.current = null;
        }, 180);
      } else {
        onSelectGene?.(key);
        onFocusModeChange?.("gene");
      }
    },
    [focusMode, activeGeneKey, closeFocus, onSelectGene, onFocusModeChange]
  );

  const handleScoreClick = useCallback(() => {
    if (focusMode === "core") {
      const flyoutEl = flyoutRef.current;
      const rightEl = rightAreaRef.current;
      const flyoutRect = flyoutEl?.getBoundingClientRect();
      const rightRect = rightEl?.getBoundingClientRect();
      if (flyoutRect && rightRect) {
        const parentCenterX = rightRect.left + rightRect.width / 2;
        const parentCenterY = rightRect.top + rightRect.height / 2;
        const flyoutCenterX = flyoutRect.left + flyoutRect.width / 2;
        const flyoutCenterY = flyoutRect.top + flyoutRect.height / 2;
        unfocusingDeltaRef.current = {
          x: flyoutCenterX - parentCenterX,
          y: flyoutCenterY - parentCenterY,
        };
      }
      closeFocus();
    } else {
      onFocusModeChange?.("core");
    }
  }, [focusMode, closeFocus, onFocusModeChange]);

  const isFocus = focusMode !== null;
  const { t } = useTranslation();
  const [hintVisible, setHintVisible] = useState(false);

  useLayoutEffect(() => {
    if (isFocus || !unfocusingDeltaRef.current) return;
    const el = flyoutRef.current;
    const delta = unfocusingDeltaRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
    const id = requestAnimationFrame(() => {
      el.style.transition = "";
      el.style.transform = "";
      unfocusingDeltaRef.current = null;
    });
    return () => cancelAnimationFrame(id);
  }, [isFocus]);

  useEffect(() => {
    const seen = typeof sessionStorage !== "undefined" && sessionStorage.getItem(HINT_SEEN_KEY) === "1";
    if (!seen) {
      setHintVisible(true);
      const tId = setTimeout(() => {
        setHintVisible(false);
        try { sessionStorage.setItem(HINT_SEEN_KEY, "1"); } catch (_) {}
      }, HINT_DURATION_MS);
      return () => clearTimeout(tId);
    }
  }, []);

  useEffect(() => {
    if (!hintVisible) return;
    const onKey = (e) => {
      if (e.key === "Escape") setHintVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hintVisible]);

  useEffect(() => {
    let hideTimer = null;
    const onH = (e) => {
      if (e.key === "h" || e.key === "H") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (hideTimer) clearTimeout(hideTimer);
          setHintVisible(true);
          hideTimer = setTimeout(() => setHintVisible(false), HINT_DURATION_MS);
        }
      }
    };
    window.addEventListener("keydown", onH);
    return () => {
      window.removeEventListener("keydown", onH);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const handleSceneClick = useCallback(
    (e) => {
      if (!focusMode) return;
      const target = e.target;
      // Не сворачиваем по клику внутри контента карусели или самого core score-блока
      if (target.closest(".dnaInsightCarouselInner")) return;
      if (target.closest(".dnaMinimalScoreFlyout")) return;
      onFocusModeChange?.(null);
      onSelectGene?.(null);
    },
    [focusMode, onFocusModeChange, onSelectGene]
  );

  return (
    <div
      className={`dnaMinimalScene ${isFocus ? "isFocus" : ""}`}
      onClick={handleSceneClick}
      role="presentation"
    >
      <div className="dnaMinimalSceneGarden">
        <GeneGardenMinimal
          genes={genes}
          profileGenes={profileGenes}
          matchHistory={matchHistory}
          selectedMatchId={selectedMatchId}
          activeKey={activeGeneKey}
          focusMode={focusMode}
          onSelectGene={handleGeneSelect}
          playerId={profile?.playerId}
          seasonId={seasonId}
        />
      </div>
      <div className="dnaMinimalSceneRightArea" ref={rightAreaRef}>
        <div ref={flyoutRef} className={`dnaMinimalScoreFlyout ${isFocus ? "isFocus" : ""}`}>
          {isFocus && <span className="dnaMinimalScoreLabel">{t("dnaMinimal.scoreLabel")}</span>}
          <button
            type="button"
            className="dnaMinimalScoreButton"
            onClick={handleScoreClick}
            aria-label={t("dnaMinimal.breakdown")}
            title={t("dnaMinimal.scoreTooltip")}
          >
            <span className={`dnaMinimalScoreValue ${!isFocus ? "dnaMinimalScoreValue--center" : ""}`}>
              {coreDisplay}
              {dnaTier != null && (
                <span
                  className="dnaMinimalScoreTier"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTierModalOpen(true);
                  }}
                >
                  <DnaTierBadge tier={dnaTier} />
                </span>
              )}
            </span>
          </button>
          {!isFocus && dominantTrait && (
            <p className="dnaMinimalScoreArchetypeCompact" aria-live="polite">
              <button
                type="button"
                className="dnaMinimalArchetypeTrigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setArchetypeModalState({ open: true, mode: "what-is" });
                }}
              >
                {t("dnaMinimal.archetypeLabel")}
              </button>
              {": "}
              <strong>
                <button
                  type="button"
                  className="dnaMinimalArchetypeTrigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchetypeModalState({ open: true, mode: "why-this" });
                  }}
                >
                  {dominantTrait}
                </button>
              </strong>
            </p>
          )}
          {!isFocus && (
            <p className="dnaMinimalScoreBreakdownCompact">{t("dnaMinimal.breakdown")}</p>
          )}
          {isFocus && dominantTrait && (
            <div className="dnaMinimalArchetypeBlock dnaMinimalArchetypeBlock--expanded" aria-live="polite">
              <div className="dnaMinimalArchetypeRow">
                <button
                  type="button"
                  className="dnaMinimalArchetypeTrigger dnaMinimalArchetypeLabel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchetypeModalState({ open: true, mode: "what-is" });
                  }}
                >
                  {t("dnaMinimal.archetypeLabel")}:
                </button>
                <button
                  type="button"
                  className="dnaMinimalArchetypeTrigger dnaMinimalArchetypeValue"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchetypeModalState({ open: true, mode: "why-this" });
                  }}
                >
                  {dominantTrait}
                </button>
              </div>
            </div>
          )}
        </div>
        {!isFocus && <div className="dnaMinimalSceneScoreSpacer" aria-hidden="true" />}
        {isFocus && (
          <div className="dnaMinimalSceneCarouselBlock">
            <DnaInsightCarousel
              mode={focusMode === "core" ? "core" : "gene"}
              geneKey={activeGeneKey}
              genePayload={
                focusMode === "gene"
                  ? {
                      geneValue,
                      geneTrend,
                      geneLabel,
                      dictionaryEntry,
                      confidence,
                      reasons: profile.reasons ?? {},
                      coverage: profile.coverage ?? {},
                      profile,
                    }
                  : undefined
              }
              coreData={focusMode === "core" ? { profile, genes, profileGenes } : undefined}
            />
          </div>
        )}
      </div>
      {hintVisible && (
        <div className="dnaMinimalSceneHint" role="status" aria-live="polite">
          <p className="dnaMinimalSceneHintText">{t("dnaMinimal.hintLine")}</p>
        </div>
      )}
      <div className="dnaMinimalSceneScreenHint" role="region" aria-label={t("dnaMinimal.statsScreenHintTitle")}>
        <p className="dnaMinimalSceneScreenHintTitle">{t("dnaMinimal.statsScreenHintTitle")}</p>
        <p className="dnaMinimalSceneScreenHintText">{t("dnaMinimal.statsScreenHintText")}</p>
      </div>
      <TierExplanationModal open={tierModalOpen} onClose={() => setTierModalOpen(false)} />
      <ArchetypeExplanationModal
        open={archetypeModalState.open}
        onClose={() => setArchetypeModalState((prev) => ({ ...prev, open: false }))}
        archetype={dominantTrait}
        mode={archetypeModalState.mode}
      />
    </div>
  );
}
