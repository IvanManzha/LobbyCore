import React, { useState, useRef } from 'react';
import ChampionPopover from './ChampionPopover';
import './ChampionPill.css';

function ChampionPill({ champion }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const anchorRef = useRef(null);

  if (!champion) return null;

  const togglePopover = () => setPopoverOpen((prev) => !prev);

  return (
    <div className="champion-pill-wrapper" ref={anchorRef}>
      <button
        type="button"
        className="champion-pill"
        onClick={togglePopover}
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
        aria-label={`Чемпион: ${champion.championName} (${champion.championScore}). Открыть подробности`}
      >
        <span className="champion-pill-icon" aria-hidden>
          🏆
        </span>
        <span className="champion-pill-text">
          Champion: {champion.championName}{' '}
          <span className="champion-pill-score">({champion.championScore})</span>
        </span>
      </button>
      {popoverOpen && (
        <ChampionPopover
          champion={champion}
          onClose={() => setPopoverOpen(false)}
          anchorRef={anchorRef}
        />
      )}
    </div>
  );
}

export default ChampionPill;
