import React, { useState } from "react";
import { formatGeneValue } from "@/shared/lib/dnaFormatting";
import { GENES } from "./mock/dnaMock";
import { useTranslation } from "@/contexts/LanguageContext";

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
 * Gene Garden for Compare: two nodes per stem (A orange, B cold).
 */
export default function GeneGardenDual({
  genes = [],
  profileGenesA = [],
  profileGenesB = [],
  activeKey,
  onSelectGene,
}) {
  const { t } = useTranslation();
  const [hoveredKey, setHoveredKey] = useState(null);

  const geneList = genes.length ? genes : GENES.map((g) => ({
    ...g,
    shortLabel: SHORT_LABELS[g.key] || g.label?.slice(0, 4) || g.key,
  }));

  return (
    <div className="geneGarden geneGardenDual">
      {geneList.map((g) => {
        const pgA = profileGenesA.find((x) => x.key === g.key);
        const pgB = profileGenesB.find((x) => x.key === g.key);
        const valueA = pgA?.value;
        const valueB = pgB?.value;
        const hasA = valueA != null && !Number.isNaN(valueA);
        const hasB = valueB != null && !Number.isNaN(valueB);
        const delta = hasA && hasB ? Math.round(valueA - valueB) : null;
        const advantageA = delta != null && delta > 0;
        const advantageB = delta != null && delta < 0;

        const isActive = g.key === activeKey;
        const isHovered = g.key === hoveredKey;

        return (
          <div
            key={g.key}
            className={`geneGardenStem geneGardenStemDual ${isActive ? "isActive" : ""} ${isHovered ? "isHovered" : ""}`}
            onMouseEnter={() => setHoveredKey(g.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => onSelectGene?.(g.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelectGene?.(g.key)}
          >
            <span className="geneGardenLabel">
              {t(`dnaMinimal.gene_${g.key}_short`) || t(`dnaMinimal.gene_${g.key}_label`) || g.shortLabel || g.label?.slice(0, 4)}
            </span>
            <div className="geneGardenTrack geneGardenTrackDual">
              <div className="geneGardenLine" />
              {hasA && (
                <div
                  className="geneGardenNodeDual geneGardenNodeA"
                  style={{ left: `${Math.max(0, Math.min(100, valueA))}%` }}
                />
              )}
              {hasB && (
                <div
                  className="geneGardenNodeDual geneGardenNodeB"
                  style={{ left: `${Math.max(0, Math.min(100, valueB))}%` }}
                />
              )}
              {hasA && hasB && (
                <div
                  className={`geneGardenAdvantageBar ${advantageA ? "advA" : "advB"}`}
                  style={{
                    left: `${Math.min(valueA, valueB)}%`,
                    width: `${Math.abs(valueA - valueB)}%`,
                  }}
                />
              )}
            </div>
            {(isHovered || isActive) && (
              <div className="geneGardenTooltip">
                <span>A {hasA ? formatGeneValue(valueA) : "—"} | B {hasB ? formatGeneValue(valueB) : "—"}</span>
                {delta != null && <span className={delta >= 0 ? "up" : "down"}>Δ {delta >= 0 ? "+" : ""}{delta}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
