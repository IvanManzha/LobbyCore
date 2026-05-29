import React from "react";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Sprint 8: Help overlay — 3-step quick guide. Shown when Help (?) is clicked in HUD.
 */
export default function DnaHelpOverlay({ onClose }) {
  const { t } = useTranslation();
  const steps = [
    { titleKey: "dnaLab.helpStep1Title", textKey: "dnaLab.helpStep1Text" },
    { titleKey: "dnaLab.helpStep2Title", textKey: "dnaLab.helpStep2Text" },
    { titleKey: "dnaLab.helpStep3Title", textKey: "dnaLab.helpStep3Text" },
  ];

  return (
    <div
      className="dnaHelpOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dna-help-title"
    >
      <div className="dnaHelpOverlayBackdrop" onClick={onClose} aria-hidden />
      <div className="dnaHelpOverlayPanel">
        <div className="dnaHelpOverlayHeader">
          <h3 id="dna-help-title">{t("dnaLab.helpTitle")}</h3>
          <button
            type="button"
            className="dnaHelpOverlayClose"
            onClick={onClose}
            aria-label={t("dnaLab.helpClose")}
          >
            ×
          </button>
        </div>
        <div className="dnaHelpOverlaySteps">
          {steps.map((step, i) => (
            <div key={i} className="dnaHelpOverlayStep">
              <span className="dnaHelpOverlayStepNum">{i + 1}</span>
              <div>
                <h4 className="dnaHelpOverlayStepTitle">{t(step.titleKey)}</h4>
                <p className="dnaHelpOverlayStepText">{t(step.textKey)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="dnaHelpOverlayHotkeys">
          {t("dnaLab.helpHotkeys")}
        </p>
      </div>
    </div>
  );
}
