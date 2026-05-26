import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../contexts/LanguageContext";

/**
 * DNA Lab minimal HUD: Back (top-left) + Stats | Map (centered).
 * Hotkeys: 1=Stats, 2=Map, Esc=Back.
 */
export default function DnaMiniHUD({ activeTab = "genes", onTabChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);

  const tabs = [
    { id: "genes", key: "hubStatsTitle", hotkey: "1" },
    { id: "map", key: "hubMapTitle", hotkey: "2" },
  ];

  return (
    <div className="dnaMiniHUD" role="navigation" aria-label="DNA Lab navigation">
      <button
        type="button"
        className="dnaMiniHUDBack"
        onClick={handleBack}
        aria-label={t("dnaMinimal.back")}
      >
        <span className="dnaMiniHUDBackIcon" aria-hidden>←</span>
        <span className="dnaMiniHUDBackText">{t("dnaMinimal.back")}</span>
      </button>

      <div className="dnaMiniHUDTabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`dnaMiniHUDTab ${activeTab === tab.id ? "isActive" : ""}`}
            onClick={() => onTabChange?.(tab.id)}
            title={`${t(`dnaLab.${tab.key}`)} (${tab.hotkey})`}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {t(`dnaLab.${tab.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
