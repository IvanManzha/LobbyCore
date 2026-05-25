import React, { useMemo, useState } from "react";
import { GENES } from "./mock/dnaMock";
import { useTranslation } from "../../contexts/LanguageContext";

const PINNED_KEY = "dnaPinnedMoments";

function getPinnedIds() {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setPinnedIds(ids) {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
  } catch {}
}

/**
 * Sprint 8: Moments strip — Best peak, Biggest drop, etc. Pin moment.
 */
export default function DnaMomentsStrip({ profile = {}, activeGeneKey, onJumpToMatch }) {
  const { t } = useTranslation();
  const [pinnedIds, setPinnedIdsState] = useState(getPinnedIds);

  const moments = useMemo(() => {
    const list = [];
    const matchHistory = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches ?? [];
    if (!matchHistory.length) return list;

    const geneKey = activeGeneKey || "accuracy";
    const geneLabel = t(`dnaMinimal.gene_${geneKey}_short`) || t(`dnaMinimal.gene_${geneKey}_label`) || geneKey;

    const values = matchHistory
      .map((m, i) => ({
        value: m.geneValues?.[geneKey] != null ? Math.max(0, Math.min(100, Number(m.geneValues[geneKey]))) : null,
        match: m,
        index: i,
      }))
      .filter((x) => x.value != null);

    if (values.length < 2) return list;

    let bestPeak = { value: -1, index: -1, match: null };
    let biggestDrop = { delta: 0, index: -1, match: null };
    let biggestRise = { delta: -Infinity, index: -1, match: null };

    for (let i = 0; i < values.length; i++) {
      if (values[i].value > bestPeak.value) {
        bestPeak = { value: values[i].value, index: i, match: values[i].match };
      }
      if (i > 0) {
        const d = values[i].value - values[i - 1].value;
        if (d < biggestDrop.delta) {
          biggestDrop = { delta: d, index: i, match: values[i].match };
        }
        if (d > biggestRise.delta) {
          biggestRise = { delta: d, index: i, match: values[i].match };
        }
      }
    }

    if (bestPeak.index >= 0) {
      list.push({
        id: `peak-${geneKey}`,
        type: "peak",
        title: "Best peak",
        text: `${geneLabel} ${Math.round(bestPeak.value)}`,
        matchIndex: bestPeak.index,
        match: bestPeak.match,
      });
    }
    if (biggestRise.delta > 10 && biggestRise.index >= 0) {
      list.push({
        id: `rise-${geneKey}`,
        type: "rise",
        title: "Biggest rise",
        text: `+${Math.round(biggestRise.delta)}`,
        matchIndex: biggestRise.index,
        match: biggestRise.match,
      });
    }
    if (biggestDrop.delta < -10 && biggestDrop.index >= 0) {
      list.push({
        id: `drop-${geneKey}`,
        type: "drop",
        title: "Biggest drop",
        text: `${Math.round(biggestDrop.delta)}`,
        matchIndex: biggestDrop.index,
        match: biggestDrop.match,
      });
    }

    return list;
  }, [profile, activeGeneKey, t]);

  const handlePin = (id) => {
    setPinnedIdsState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setPinnedIds(next);
      return next;
    });
  };

  const sortedMoments = useMemo(() => {
    const pinned = moments.filter((m) => pinnedIds.has(m.id));
    const rest = moments.filter((m) => !pinnedIds.has(m.id));
    return [...pinned, ...rest];
  }, [moments, pinnedIds]);

  if (sortedMoments.length === 0) return null;

  return (
    <div className="dnaMomentsStrip">
      <div className="dnaMomentsStripTitle">Moments</div>
      <div className="dnaMomentsStripTrack">
        {sortedMoments.map((m) => (
          <div
            key={m.id}
            className={`dnaMomentCard dnaMomentCard--${m.type} ${pinnedIds.has(m.id) ? "isPinned" : ""}`}
          >
            <button
              type="button"
              className="dnaMomentCardPin"
              onClick={() => handlePin(m.id)}
              title={pinnedIds.has(m.id) ? "Unpin" : "Pin"}
              aria-pressed={pinnedIds.has(m.id)}
            >
              {pinnedIds.has(m.id) ? "📌" : "📍"}
            </button>
            <div
              className="dnaMomentCardContent"
              role="button"
              tabIndex={0}
              onClick={() => onJumpToMatch?.(m.match?.matchId || m.match?.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onJumpToMatch?.(m.match?.matchId || m.match?.id);
                }
              }}
            >
              <span className="dnaMomentCardTitle">{m.title}</span>
              <span className="dnaMomentCardText">{m.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
