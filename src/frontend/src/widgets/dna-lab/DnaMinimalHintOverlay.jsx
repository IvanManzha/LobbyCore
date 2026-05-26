import React, { useEffect } from "react";

/**
 * Minimal mode hint overlay. Shown on H key for 2 seconds.
 * "Hover gene • Click to focus • Esc back • D details • ← → scrub"
 */
export default function DnaMinimalHintOverlay({ onClose, onShowFullUI }) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(), 2000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="dnaMinimalHintOverlay"
      role="status"
      aria-live="polite"
    >
      <div className="dnaMinimalHintBackdrop" onClick={onClose} aria-hidden />
      <div className="dnaMinimalHintPanel">
        <p className="dnaMinimalHintText">
          Hover gene • Click to focus • Esc back • D details • ← → scrub
        </p>
        <button
          type="button"
          className="dnaMinimalHintFullBtn"
          onClick={onShowFullUI}
        >
          Show full UI
        </button>
      </div>
    </div>
  );
}
