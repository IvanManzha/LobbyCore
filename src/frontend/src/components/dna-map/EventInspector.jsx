import React from "react";
import "./EventInspector.css";

/**
 * @param {{ event: import('../../services/dnaMapSessionContract').DnaMapSessionEvent; onFocusMap: () => void; onJumpNext: () => void }}
 */
export default function EventInspector({ event, onFocusMap, onJumpNext }) {
  if (!event) return null;

  const timeStr = formatTime(event.t);
  const title = `${event.type} — ${timeStr}`;
  const who = event.actor && event.target
    ? `${event.actor.label} → ${event.target.label}`
    : event.actor
      ? event.actor.label
      : event.target
        ? event.target.label
        : "";

  return (
    <div className="dna-event-inspector">
      <div className="dna-event-inspector-title">{title}</div>
      {who && <div className="dna-event-inspector-who">{who}</div>}
      {(event.weapon || event.distanceM != null) && (
        <div className="dna-event-inspector-meta">
          {event.weapon && <span>{event.weapon}</span>}
          {event.distanceM != null && <span>{event.distanceM}m</span>}
        </div>
      )}
      <div className="dna-event-inspector-actions">
        <button type="button" className="dna-event-inspector-btn" onClick={onFocusMap}>
          Focus on map
        </button>
        <button type="button" className="dna-event-inspector-btn" onClick={onJumpNext}>
          Jump to next related
        </button>
      </div>
      {event.fightId && (
        <div className="dna-event-inspector-fight">Fight context: {event.fightId}</div>
      )}
    </div>
  );
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
