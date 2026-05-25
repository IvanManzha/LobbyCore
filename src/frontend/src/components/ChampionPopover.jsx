import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './ChampionPopover.css';

function ChampionPopover({ champion, onClose, anchorRef }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  if (!champion) return null;

  const typeLabel = champion.championType === 'solo' ? 'игрок' : 'команда';

  return (
    <div className="champion-popover" ref={popoverRef} role="dialog" aria-label="Чемпион">
      <div className="champion-popover-title">
        Последний чемпион
        <span className="champion-popover-type">({typeLabel})</span>
      </div>
      <div className="champion-popover-champion">
        {champion.championName}
        {champion.championScore != null && (
          <span className="champion-popover-score"> ({champion.championScore})</span>
        )}
      </div>
      {champion.bestKillName != null && champion.bestKillValue != null && (
        <div className="champion-popover-row">
          <span className="champion-popover-label">Больше всего киллов</span>
          <span className="champion-popover-value">
            {champion.bestKillName} — {champion.bestKillValue}
          </span>
        </div>
      )}
      {champion.top3?.length > 0 && (
        <div className="champion-popover-row">
          <span className="champion-popover-label">Топ-3</span>
          <div className="champion-popover-top3">
            {champion.top3.map((item, i) => (
              <span key={i} className="champion-popover-top3-item">
                {item.rank}. {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <Link
        to={`/tournament/${champion.tournamentId}`}
        className="btn btn-primary champion-popover-cta"
        onClick={onClose}
      >
        Открыть турнир
      </Link>
    </div>
  );
}

export default ChampionPopover;
