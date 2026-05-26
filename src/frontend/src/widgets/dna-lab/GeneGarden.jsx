import React, { useState } from "react";
import { useTranslation } from "../../contexts/LanguageContext";
import { formatGeneValue, formatTrendShort } from "../../utils/dnaFormatting";
import { GENES } from "./mock/dnaMock";

const SHORT_LABELS = {
  accuracy: "AIM",
  tactics: "TAC",
  aggression: "AGR",
  survival: "SUR",
  positioning: "POS",
  teamwork: "TMW",
  resource: "RES",
  composure: "COM",
};

/**
 * Gene Garden: 8 horizontal stems, label left, line 0–100, node at value.
 * Hover: tooltip (value, Δ). Active: accent highlight.
 */
export default function GeneGarden({
  genes = [],
  profileGenes = [],
  activeKey,
  onSelectGene,
  topGeneKey = null,
  bottomGeneKey = null,
}) {
  const { t } = useTranslation();
  const [hoveredKey, setHoveredKey] = useState(null);

  const geneList = genes.length ? genes : GENES.map((g) => ({
    ...g,
    shortLabel: SHORT_LABELS[g.key] || g.label?.slice(0, 4) || g.key,
  }));

  return (
    <div className="geneGarden">
      {geneList.map((g) => {
        const pg = profileGenes.find((x) => x.key === g.key);
        const value = pg?.value;
        const hasValue = value != null && !Number.isNaN(value);
        const displayValue = hasValue ? formatGeneValue(value) : "—";
        const trend = pg?.trend;
        const trendNum = typeof trend === "object" ? trend?.delta : trend;
        const trendStr = trendNum != null && trendNum !== 0 ? formatTrendShort(trend, false) : "";
        const isActive = g.key === activeKey;
        const isHovered = g.key === hoveredKey;
        const isTop = g.key === topGeneKey;
        const isLow = g.key === bottomGeneKey && topGeneKey !== bottomGeneKey;

        return (
          <div
            key={g.key}
            className={`geneGardenStem ${isActive ? "isActive" : ""} ${isHovered ? "isHovered" : ""}`}
            onMouseEnter={() => setHoveredKey(g.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => onSelectGene?.(g.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelectGene?.(g.key)}
          >
            <span className="geneGardenLabel">
              {/* Короткий ключ всегда на английском */}
              {SHORT_LABELS[g.key] || g.shortLabel || g.key}
              {isTop && <span className="geneGardenBadge geneGardenBadgeTop">{t("dnaLab.badgeTop")}</span>}
              {isLow && <span className="geneGardenBadge geneGardenBadgeLow">{t("dnaLab.badgeLow")}</span>}
            </span>
            <div className="geneGardenTrack">
              <div className="geneGardenLine" />
              <div
                className="geneGardenNode"
                style={{ left: hasValue ? `${Math.max(0, Math.min(100, value))}%` : "50%" }}
              />
            </div>
            {(isHovered || isActive) && (
              <div className="geneGardenTooltip">
                <span className="geneGardenTooltipRow">
                  <span>{t(`dnaMinimal.gene_${g.key}_label`) || g.label || g.key}</span>
                  <span className="dnaMono">{displayValue}</span>
                  {trendStr && <span className={trendNum > 0 ? "up" : "down"}>{trendStr}</span>}
                </span>
                {t(`dnaMinimal.gene_${g.key}_tooltip`) && (
                  <p className="geneGardenTooltipDesc">{t(`dnaMinimal.gene_${g.key}_tooltip`)}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
