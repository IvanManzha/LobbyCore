import React from "react";
import "./FightsPanel.css";

/**
 * @param {{
 *   fights: import('../../services/dnaMapSessionContract').DnaMapSessionFight[];
 *   selectedFightId: string | null;
 *   onSelectFight: (id: string | null) => void;
 *   isolateFightId: string | null;
 *   onIsolateFight: (id: string | null) => void;
 *   onFocusFight: (f: import('../../services/dnaMapSessionContract').DnaMapSessionFight) => void;
 * }}
 */
export default function FightsPanel({ fights, selectedFightId, onSelectFight, isolateFightId, onIsolateFight, onFocusFight }) {
  if (!fights?.length) return null;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <section className="dna-fights-panel">
      <span className="dna-inspector-label">Файты</span>
      <ul className="dna-fights-list">
        {fights.map((f) => (
          <li key={f.id} className="dna-fights-item">
            <button
              type="button"
              className={`dna-fights-btn ${selectedFightId === f.id ? "dna-fights-btn-active" : ""}`}
              onClick={() => onSelectFight(selectedFightId === f.id ? null : f.id)}
            >
              {formatTime(f.startT)}–{formatTime(f.endT)}
              {f.outcome && ` · ${f.outcome}`}
            </button>
            <button
              type="button"
              className="dna-inspector-btn"
              onClick={() => onFocusFight(f)}
            >
              Focus
            </button>
            <button
              type="button"
              className={`dna-inspector-chip ${isolateFightId === f.id ? "dna-inspector-chip-active" : ""}`}
              onClick={() => onIsolateFight(isolateFightId === f.id ? null : f.id)}
            >
              Isolate
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
