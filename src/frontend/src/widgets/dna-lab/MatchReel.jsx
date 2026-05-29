import React, { useMemo, useRef, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

const GENE_KEYS = [
  "combat", "pressure", "conversion", "survival",
  "positioning", "recovery", "teamwork",
];

const SHORT_LABEL = {
  combat: "Comb",
  pressure: "Pres",
  conversion: "Conv",
  survival: "Surv",
  positioning: "Pos",
  recovery: "Rec",
  teamwork: "Team",
};

/**
 * Best delta for a match: max gain vs previous match across genes. Returns { geneKey, delta } or null.
 */
function getBestDelta(match, prevMatch, list) {
  if (!match?.geneValues || !list?.length) return null;
  const idx = list.findIndex((m) => (m.matchId || m.id) === (match.matchId || match.id));
  if (idx <= 0) return null;
  const prev = list[idx - 1];
  const prevGV = prev?.geneValues || {};
  let bestKey = null;
  let bestDelta = -Infinity;
  for (const key of GENE_KEYS) {
    const v = match.geneValues?.[key];
    const p = prevGV[key];
    if (v != null && p != null) {
      const d = Number(v) - Number(p);
      if (d > bestDelta) {
        bestDelta = d;
        bestKey = key;
      }
    }
  }
  if (bestKey == null || bestDelta <= 0) return null;
  return { geneKey: bestKey, delta: Math.round(bestDelta) };
}

/**
 * Match Reel: horizontal strip of match cards. #match, data quality dot, best Δ. Active: accent + lift. Snap to center on select.
 */
export default function MatchReel({
  matches = [],
  matchHistory = [],
  selectedMatchId,
  onSelectMatch,
  onPlayPause,
  isPlaying = false,
}) {
  const { t } = useTranslation();
  const source = matchHistory.length ? matchHistory : matches;
  const list = source.slice(0, 15);
  const activeCardRef = useRef(null);

  useEffect(() => {
    if (!selectedMatchId || !activeCardRef.current) return;
    activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedMatchId]);

  if (list.length === 0) {
    return (
      <div className="dnaMatchReelWrap">
        <div className="dnaMatchReelTitle">{t("dnaLab.matchReel")}</div>
        <div className="dnaEmpty">{t("dnaLab.noMatchesInSlice")}</div>
      </div>
    );
  }

  return (
    <div className="dnaMatchReelWrap">
      <div className="dnaMatchReelHeader">
        <span className="dnaMatchReelTitle">{t("dnaLab.matchReel")}</span>
        {onPlayPause && (
          <button
            type="button"
            className={`dnaMatchReelPlayBtn ${isPlaying ? "isPlaying" : ""}`}
            onClick={onPlayPause}
            title={isPlaying ? t("dnaLab.pause") : t("dnaLab.playPause")}
            aria-label={isPlaying ? t("dnaLab.pause") : t("dnaLab.playPause")}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
      </div>
      <div className="dnaMatchReelScroll">
        {list.map((m, index) => {
          const id = m.matchId || m.id;
          const isSelected = id === selectedMatchId;
          const order = m.order != null ? m.order + 1 : index + 1;
          const best = getBestDelta(m, list[index - 1], list);
          const qualityDot = m.hasTelemetry !== false;

          return (
            <button
              key={id}
              ref={isSelected ? activeCardRef : null}
              type="button"
              className={`dnaMatchReelCard ${isSelected ? "isActive" : ""}`}
              onClick={() => onSelectMatch?.(id)}
            >
              <div className="dnaMatchReelCardTop">
                <span className="dnaMatchReelCardNum">#{order}</span>
                <span
                  className={`dnaMatchReelQualityDot ${qualityDot ? "hasData" : "noData"}`}
                  title={qualityDot ? "Data OK" : "Limited data"}
                />
              </div>
              {best && (
                <div className="dnaMatchReelBestDelta">
                  {SHORT_LABEL[best.geneKey] || best.geneKey.slice(0, 4)} +{best.delta}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
