import React from "react";

/**
 * Inspector for Compare mode: A value, B value, Δ.
 */
export default function GeneInspectorCompare({
  activeGeneKey,
  valueA,
  valueB,
  delta,
  geneLabel,
  dictionaryEntry,
  profileA,
  profileB,
}) {
  const name = dictionaryEntry?.label ?? dictionaryEntry?.name ?? geneLabel ?? activeGeneKey ?? "—";

  return (
    <aside className="dnaGeneInspector dnaGeneInspectorCompare">
      <div className="dnaGeneInspectorCard">
        <div className="dnaGeneInspectorHeader">
          <h2 className="dnaGeneInspectorTitle">{name}</h2>
          <div className="dnaGeneInspectorCompareRow">
            <div className="dnaGeneInspectorCompareCol">
              <span className="dnaGeneInspectorCompareLabel">A</span>
              <span className="dnaGeneInspectorValue dnaMono">{valueA != null ? valueA : "—"}</span>
            </div>
            <div className="dnaGeneInspectorCompareCol">
              <span className="dnaGeneInspectorCompareLabel">B</span>
              <span className="dnaGeneInspectorValue dnaMono">{valueB != null ? valueB : "—"}</span>
            </div>
            {delta != null && (
              <div className={`dnaGeneInspectorCompareDelta ${delta >= 0 ? "up" : "down"}`}>
                Δ {delta >= 0 ? "+" : ""}{delta}
              </div>
            )}
          </div>
        </div>
        {dictionaryEntry?.description && (
          <div className="dnaGeneInspectorSection">
            <p className="dnaGeneInspectorMeaning">{dictionaryEntry.description}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
