import React from "react";
import { useTranslation } from "../../contexts/LanguageContext";
import DnaPipelinePanel from "./DnaPipelinePanel";

/**
 * Dev-only drawer: Sync DNA / Sync genes panel. Triggered by ⟳ icon.
 */
export default function DnaDevDrawer({
  open,
  onClose,
  profile,
  playerIds,
  seasonId,
  onComplete,
  useDnaTest = false,
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <>
      <div
        className="dnaDevDrawerBackdrop"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        role="button"
        tabIndex={0}
        aria-label="Close"
      />
      <div className="dnaDevDrawer" role="dialog" aria-label={useDnaTest ? t("dnaLab.syncGenes") : t("dnaLab.syncDna")}>
        <div className="dnaDevDrawerHeader">
          <span className="dnaDevDrawerTitle">{useDnaTest ? t("dnaLab.syncGenes") : t("dnaLab.syncDna")}</span>
          <button
            type="button"
            className="dnaDevDrawerClose"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="dnaDevDrawerBody">
          <DnaPipelinePanel
            profile={profile}
            playerIds={playerIds}
            seasonId={seasonId}
            onComplete={onComplete}
            useDnaTest={useDnaTest}
          />
        </div>
      </div>
    </>
  );
}
