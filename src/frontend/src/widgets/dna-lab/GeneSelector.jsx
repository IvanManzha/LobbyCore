import React from "react";
import { formatGeneValue, formatTrendShort } from "../../utils/dnaFormatting";
import { useTranslation } from "../../contexts/LanguageContext";

/**
 * Row of 8 gene chips. Shows shortLabel, value (or "—"), mini trend. Selected: accent; no data: tooltip.
 */
export default function GeneSelector({ genes = [], profileGenes = [], activeKey, onSelect }) {
  const { t } = useTranslation();
  return (
    <div className="dnaGeneSelectorRow">
      {genes.map((g) => {
        const pg = profileGenes.find((x) => x.key === g.key);
        const value = pg?.value;
        const hasValue = value != null && !Number.isNaN(value);
        const displayValue = hasValue ? formatGeneValue(value) : "—";
        const trend = pg?.trend;
        const trendStr = (typeof trend === "object" ? formatTrendShort(trend, false) : trend != null && trend !== 0 ? formatTrendShort(trend, false) : "") || "";
        const isActive = g.key === activeKey;
        const title = !hasValue ? t("playerPage.insufficientData") : (t(`dnaMinimal.gene_${g.key}_tooltip`) || g.descriptionShort || g.label);
        const shortLabel = t(`dnaMinimal.gene_${g.key}_short`) || t(`dnaMinimal.gene_${g.key}_label`) || g.shortLabel || g.label;

        return (
          <button
            key={g.key}
            type="button"
            className={`dnaGeneChip ${isActive ? "isActive" : ""}`}
            onClick={() => onSelect?.(g.key)}
            title={title}
          >
            <div className="dnaGeneChipTop">
              <span className="dnaGeneName">{shortLabel}</span>
              <span className="dnaGeneValue dnaMono">{displayValue}</span>
              {trendStr && <span className="dnaGeneTrendMini">{trendStr}</span>}
            </div>
            <div className="dnaGeneBar">
              <div
                className="dnaGeneBarFill"
                style={{ width: hasValue ? `${Math.max(0, Math.min(100, value))}%` : "0%" }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
