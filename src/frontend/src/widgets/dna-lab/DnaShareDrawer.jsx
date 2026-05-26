import React, { useState } from "react";
import { useTranslation } from "../../contexts/LanguageContext";

/**
 * Sprint 8: Share drawer — Gene, Snapshot, Compare card types; "Show numbers" toggle.
 */
export default function DnaShareDrawer({ open, onClose, profile = {}, activeGeneKey, geneValue }) {
  const { t } = useTranslation();
  const [showNumbers, setShowNumbers] = useState(true);
  const [cardType, setCardType] = useState("gene");

  if (!open) return null;

  const geneLabel = activeGeneKey ? (t(`dnaMinimal.gene_${activeGeneKey}_label`) || profile?.genes?.find((g) => g.key === activeGeneKey)?.label) : (profile?.genes?.find((g) => g.key === activeGeneKey)?.label || activeGeneKey || "—");
  const coreScore = profile?.coreScore ?? 0;
  const valueA = geneValue ?? profile?.genes?.find((g) => g.key === activeGeneKey)?.value ?? 0;

  const shareCards = [
    {
      id: "gene",
      label: "Gene",
      preview: (
        <div className="dnaShareCardPreview dnaShareCard--gene">
          <div className="dnaShareCardGeneLabel">{geneLabel}</div>
          {showNumbers && <div className="dnaShareCardGeneValue">{Math.round(valueA)}</div>}
        </div>
      ),
    },
    {
      id: "snapshot",
      label: "Snapshot",
      preview: (
        <div className="dnaShareCardPreview dnaShareCard--snapshot">
          <div className="dnaShareCardSnapshotTitle">{t("dnaLab.snapshotTitle")}</div>
          {showNumbers && <div className="dnaShareCardSnapshotScore">{Math.round(coreScore)}</div>}
        </div>
      ),
    },
  ];

  return (
    <div className="dnaShareDrawerOverlay" role="dialog" aria-modal="true" aria-labelledby="dna-share-title">
      <div className="dnaShareDrawerBackdrop" onClick={onClose} aria-hidden />
      <div className="dnaShareDrawer">
        <div className="dnaShareDrawerHeader">
          <h3 id="dna-share-title">{t("dnaLab.shareTitle")}</h3>
          <button type="button" className="dnaShareDrawerClose" onClick={onClose} aria-label={t("dnaLab.helpClose")}>
            ×
          </button>
        </div>
        <div className="dnaShareDrawerTypes">
          {shareCards.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`dnaShareDrawerTypeBtn ${cardType === c.id ? "isActive" : ""}`}
              onClick={() => setCardType(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="dnaShareDrawerToggle">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
          />
          <span>{t("dnaLab.shareShowNumbers")}</span>
        </label>
        <div className="dnaShareDrawerPreview">
          {shareCards.find((c) => c.id === cardType)?.preview}
        </div>
        <p className="dnaShareDrawerHint">{t("dnaLab.shareHint")}</p>
      </div>
    </div>
  );
}
