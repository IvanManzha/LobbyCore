import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Stage Placeholder: loading / ready / empty / partial.
 * Sprint 0: compact console-style block, not a large card.
 */
export default function DnaStagePlaceholder({ status = "loading" }) {
  const { t } = useTranslation();
  if (status === "loading") {
    return (
      <div className="dnaStagePlaceholder" role="status" aria-live="polite">
        <h3 className="dnaStagePlaceholderTitle">{t("dnaLab.stageAnalyzing")}</h3>
        <p className="dnaStagePlaceholderSubtitle">{t("dnaLab.stageAnalyzingSub")}</p>
        <div className="dnaStagePlaceholderStatus">
          <span className="dnaStagePlaceholderPulse" aria-hidden />
          <span>{t("dnaLab.stageInitializing")}</span>
        </div>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="dnaStagePlaceholder" role="status">
        <h3 className="dnaStagePlaceholderTitle">{t("dnaLab.stageNoDna")}</h3>
        <p className="dnaStagePlaceholderSubtitle">
          {t("dnaLab.stageEmptySub")}
        </p>
        <Link to="/tournaments" className="dnaStagePlaceholderCTA">
          {t("dnaLab.stageGoTournaments")}
        </Link>
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="dnaStagePlaceholder" role="status">
        <h3 className="dnaStagePlaceholderTitle">{t("dnaLab.stageAnalyzing")}</h3>
        <p className="dnaStagePlaceholderSubtitle">{t("dnaLab.stageAnalyzingSub")}</p>
        <div className="dnaStagePlaceholderStatus">
          <span className="dnaStagePlaceholderBadge dnaStagePlaceholderBadgePartial">{t("dnaLab.stagePartialCoverage")}</span>
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className="dnaStagePlaceholder" role="status">
      <h3 className="dnaStagePlaceholderTitle">{t("dnaLab.stageAnalyzing")}</h3>
      <p className="dnaStagePlaceholderSubtitle">{t("dnaLab.stageAnalyzingSub")}</p>
      <div className="dnaStagePlaceholderStatus dnaStagePlaceholderStatusReady">
        {t("dnaLab.stageReady")}
      </div>
      <p className="dnaStagePlaceholderHint">{t("dnaLab.stageOpenGenes")}</p>
    </div>
  );
}
