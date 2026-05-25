import React, { useEffect } from "react";
import { useTranslation } from "../../contexts/LanguageContext";

const IconStats = () => (
  <svg viewBox="0 0 48 48" className="dnaHubCardSvg" aria-hidden>
    <path fill="currentColor" fillOpacity="0.9" d="M8 36h4V20H8v16zm8 0h4V12h-4v24zm8 0h4V24h-4v12zm8 0h4V16h-4v20z" />
    <path fill="currentColor" fillOpacity="0.4" d="M6 38V10h2v28H6zm4-2V12h2v24h-2zm4 0V14h2v22h-2zm4 0V26h2v10h-2z" />
  </svg>
);

const IconMap = () => (
  <svg viewBox="0 0 48 48" className="dnaHubCardSvg" aria-hidden>
    <path fill="currentColor" fillOpacity="0.9" d="M8 38V14l12 6 12-6 8 4v20l-12-6-12 6-8-4z" />
    <path fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" d="M20 20l8-4 8 4v16l-8 4-8-4z" />
  </svg>
);

/**
 * DNA Hub: lobby with 2 mode cards — Статы, Карта.
 */
export default function DnaHubView({ onSelectMode }) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target?.closest?.("input") || e.target?.closest?.("textarea")) return;
      if (e.key === "1") {
        onSelectMode?.("genes");
      } else if (e.key === "2") {
        onSelectMode?.("map");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onSelectMode]);

  return (
    <div className="dnaHubView">
      <div className="dnaHubCards">
        <button
          type="button"
          className="dnaHubCard"
          onClick={() => onSelectMode?.("genes")}
          aria-label={t("dnaLab.hubStatsTitle")}
        >
          <span className="dnaHubCardIcon" aria-hidden>
            <IconStats />
          </span>
          <span className="dnaHubCardTitle">{t("dnaLab.hubStatsTitle")}</span>
          <span className="dnaHubCardHover">{t("dnaLab.hubStatsHover")}</span>
        </button>

        <button
          type="button"
          className="dnaHubCard dnaHubCardComing"
          onClick={() => onSelectMode?.("map")}
          aria-label={t("dnaLab.hubMapTitle")}
          title={t("dnaLab.hubMapHover")}
        >
          <span className="dnaHubCardIcon" aria-hidden>
            <IconMap />
          </span>
          <span className="dnaHubCardTitle">{t("dnaLab.hubMapTitle")}</span>
          <span className="dnaHubCardStatus">{t("dnaLab.hubMapSoon")}</span>
          <span className="dnaHubCardHover">{t("dnaLab.hubMapHover")}</span>
        </button>
      </div>

      <p className="dnaHubHint">{t("dnaLab.hubHint")}</p>
    </div>
  );
}
