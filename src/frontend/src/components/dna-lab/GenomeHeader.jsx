import React from "react";
import { formatUpdatedAgo, formatConfidence } from "../../utils/dnaFormatting";
import { useTranslation } from "../../contexts/LanguageContext";
import DnaTierBadge from "./DnaTierBadge";

/**
 * Lab Header: title, subtitle (season + updated), core score, confidence pill, season selector, view mode (Genome | Helix | Compare).
 */
export default function GenomeHeader({
  seasonId,
  seasons = [],
  onSeasonChange,
  updatedAt,
  coreScore,
  confidence,
  dnaTier,
  viewMode = "genome",
  onViewModeChange,
  useDnaTest,
  onUseDnaTestChange,
  useTestDbLabel,
}) {
  const { t } = useTranslation();
  const label = useTestDbLabel ?? t("dnaLab.useTestDb");
  const updatedLabel = formatUpdatedAgo(updatedAt);
  const confidenceLabel = formatConfidence(confidence);
  const coreDisplay = coreScore != null && !Number.isNaN(coreScore) ? String(Math.round(coreScore)) : "—";
  const isCoreNumber = coreScore != null && !Number.isNaN(coreScore);

  return (
    <header className="dnaLabHeader">
      <div className="dnaLabHeaderLeft">
        <h1 className="dnaLabTitle">{t("dnaLab.leftHudTitle")}</h1>
        <div className="dnaLabSubtitle">
          <span className="dnaMono">{seasonId}</span>
          {updatedLabel && <span className="dnaLabUpdated"> • {updatedLabel}</span>}
        </div>
      </div>

      <div className="dnaLabHeaderRight">
        {onUseDnaTestChange != null && (
          <label className="dnaLabToggleRow">
            <input
              type="checkbox"
              checked={!!useDnaTest}
              onChange={(e) => onUseDnaTestChange(e.target.checked)}
              aria-label={label}
            />
            <span className="dnaLabToggleLabel">{label}</span>
          </label>
        )}
        <div className="dnaSeasonRow">
          <span className="dnaSeasonLabel">{t("dnaLab.seasonLabel")}</span>
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              className={`dnaSeasonChip ${seasonId === s ? "isActive" : ""}`}
              onClick={() => onSeasonChange?.(s)}
              title={t("dnaLab.seasonDataTitle", { s })}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="dnaTabRow">
          <button
            type="button"
            className={`dnaTab ${viewMode === "genome" ? "isActive" : ""}`}
            onClick={() => onViewModeChange?.("genome")}
          >
            {t("dnaLab.tabGenome")}
          </button>
          <button
            type="button"
            className={`dnaTab ${viewMode === "helix" ? "isActive" : ""}`}
            onClick={() => onViewModeChange?.("helix")}
          >
            {t("dnaLab.tabHelix")}
          </button>
          <button
            type="button"
            className="dnaTab dnaTabDisabled"
            disabled
            title={t("dnaLab.comingSoon")}
          >
            {t("dnaLab.leftHudTabCompare")}
          </button>
        </div>
        <div className="dnaStatPill">
          <div className="dnaStatLabel">{t("dnaLab.coreScoreLabel")}</div>
          <div className={`dnaStatValue dnaMono ${!isCoreNumber ? "dnaStatValueEmpty" : ""}`}>
            {coreDisplay}
            {dnaTier != null && <DnaTierBadge tier={dnaTier} />}
          </div>
        </div>
        <div className="dnaConfidencePill" data-confidence={confidenceLabel.toLowerCase()}>
          {confidenceLabel}
        </div>
      </div>
    </header>
  );
}
