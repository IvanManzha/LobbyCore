import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../contexts/LanguageContext";

const SOUND_PREF_KEY = "dnaSoundEnabled";

/**
 * DNA Lab left HUD: Back, DNA Lab title, Player pill(s), Season pill, Tabs (Genes / Compare),
 * Режимы button, Sound toggle, Reduced motion toggle, Help.
 */
export default function DnaLeftHUD({
  seasonId,
  seasons = [],
  onSeasonChange,
  activeTab = "genes",
  onTabChange,
  onOpenHub,
  isHubActive = false,
  playerName = "Player",
  reducedMotion = false,
  onReducedMotionChange,
  helpOpen = false,
  onHelpToggle,
  shareOpen = false,
  onShareToggle,
  useDnaTest = false,
  onUseDnaTestChange,
}) {
  const { t } = useTranslation();
  const [soundOn, setSoundOn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SOUND_PREF_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(SOUND_PREF_KEY, soundOn ? "1" : "0");
  }, [soundOn]);
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  const initials = (playerName || "P").slice(0, 2).toUpperCase();

  return (
    <aside className="dnaLeftHUD" role="navigation" aria-label={t("dnaLab.leftHudNavAria")}>
      <button
        type="button"
        className="dnaLeftHUDBack"
        onClick={handleBack}
        aria-label={t("dnaLab.leftHudReturn")}
      >
        <span className="dnaLeftHUDBackIcon" aria-hidden>←</span>
        <span className="dnaLeftHUDBackText">{t("dnaLab.leftHudBack")}</span>
      </button>

      <h2 className="dnaLeftHUDTitle">{t("dnaLab.leftHudTitle")}</h2>

      {onOpenHub && (
        <button
          type="button"
          className={`dnaHubModesBtn ${isHubActive ? "isActive" : ""}`}
          onClick={onOpenHub}
          title={t("dnaLab.hubModesTooltip")}
          aria-label={t("dnaLab.hubModesButton")}
          aria-pressed={isHubActive}
        >
          {t("dnaLab.hubModesButton")}
        </button>
      )}

      <div className="dnaLeftHUDContext">
        <div className="dnaLeftHUDPill dnaLeftHUDPlayerPill" title={t("dnaLab.leftHudPlayer")}>
          <span className="dnaLeftHUDAvatar">{initials}</span>
          <span className="dnaLeftHUDNick">{playerName}</span>
        </div>
        <div className="dnaLeftHUDPill dnaLeftHUDSeasonPill">
          <select
            className="dnaLeftHUDSeasonSelect"
            value={seasonId}
            onChange={(e) => onSeasonChange?.(e.target.value)}
            aria-label={t("dnaLab.leftHudSeason")}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>{t("dnaLab.leftHudSeasonOption", { s })}</option>
            ))}
          </select>
        </div>
        {onUseDnaTestChange != null && (
          <label className="dnaLeftHUDTestDbToggle">
            <input
              type="checkbox"
              checked={!!useDnaTest}
              onChange={(e) => onUseDnaTestChange(e.target.checked)}
            />
            <span className="dnaLeftHUDTestDbLabel">{t("dnaLab.leftHudTestDb")}</span>
          </label>
        )}
      </div>

      <div className="dnaLeftHUDTabs">
        <button
          type="button"
          className={`dnaLeftHUDTab ${activeTab === "genes" ? "isActive" : ""}`}
          onClick={() => onTabChange?.("genes")}
        >
          {t("dnaLab.leftHudTabGenes")}
        </button>
        <button
          type="button"
          className={`dnaLeftHUDTab ${activeTab === "squad" ? "isActive" : ""}`}
          onClick={() => onTabChange?.("squad")}
        >
          {t("dnaLab.leftHudTabSquad")}
        </button>
        <button
          type="button"
          className={`dnaLeftHUDTab ${activeTab === "duel" ? "isActive" : ""}`}
          onClick={() => onTabChange?.("duel")}
        >
          {t("dnaLab.leftHudTabDuel")}
        </button>
        <button
          type="button"
          className="dnaLeftHUDTab isDisabled"
          disabled
          aria-disabled="true"
          title={t("dnaLab.leftHudSoon")}
        >
          {t("dnaLab.leftHudTabMap")}
        </button>
      </div>

      <div className="dnaLeftHUDBottom">
        {onShareToggle != null && (
          <button
            type="button"
            className={`dnaLeftHUDShareBtn ${shareOpen ? "isActive" : ""}`}
            onClick={() => onShareToggle?.(!shareOpen)}
            title={t("dnaLab.leftHudShare")}
            aria-label={t("dnaLab.leftHudShare")}
            aria-pressed={shareOpen}
          >
            ↗
          </button>
        )}
        <button
          type="button"
          className={`dnaLeftHUDHelpBtn ${helpOpen ? "isActive" : ""}`}
          onClick={() => onHelpToggle?.(!helpOpen)}
          title={t("dnaLab.leftHudHelp")}
          aria-label={t("dnaLab.leftHudHelp")}
          aria-pressed={helpOpen}
        >
          ?
        </button>
        {onReducedMotionChange != null && (
          <button
            type="button"
            className={`dnaLeftHUDReducedMotionBtn ${reducedMotion ? "isOn" : ""}`}
            onClick={() => onReducedMotionChange((v) => !v)}
            title={reducedMotion ? t("dnaLab.leftHudMotionEnable") : t("dnaLab.leftHudMotionReduce")}
            aria-label={reducedMotion ? t("dnaLab.leftHudMotionEnable") : t("dnaLab.leftHudMotionReduce")}
          >
            <span className="dnaLeftHUDReducedIcon" aria-hidden>⚡</span>
            <span className="dnaLeftHUDReducedLabel">{t("dnaLab.leftHudMotion")}</span>
          </button>
        )}
        <button
          type="button"
          className={`dnaLeftHUDSoundBtn ${soundOn ? "isOn" : ""}`}
          onClick={() => setSoundOn((s) => !s)}
          title={soundOn ? t("dnaLab.leftHudSoundDisable") : t("dnaLab.leftHudSoundEnable")}
        >
          <span className="dnaLeftHUDSoundIcon" aria-hidden>
            {soundOn ? "🔊" : "🔇"}
          </span>
          <span className="dnaLeftHUDSoundLabel">{t("dnaLab.leftHudSound")}</span>
        </button>
      </div>
    </aside>
  );
}
