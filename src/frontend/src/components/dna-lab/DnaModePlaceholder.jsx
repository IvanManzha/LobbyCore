import React from "react";
import { useTranslation } from "../../contexts/LanguageContext";

/**
 * Placeholder for DNA modes. variant="map" shows DNA Map / Soon.
 */
export default function DnaModePlaceholder({ variant = "default" }) {
  const { t } = useTranslation();
  const isMap = variant === "map";
  const title = isMap ? t("dnaLab.hubMapTitle") : t("dnaLab.modeInDevelopment");
  const subtitle = isMap ? t("dnaLab.hubMapSoon") : t("dnaLab.modeInDevelopmentSub");
  return (
    <div className={`dnaModePlaceholder ${isMap ? "dnaModePlaceholderMap" : ""}`} role="status">
      <h3 className="dnaModePlaceholderTitle">{title}</h3>
      <p className="dnaModePlaceholderSubtitle">{subtitle}</p>
    </div>
  );
}
