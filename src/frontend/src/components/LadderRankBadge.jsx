import React from 'react';
import './LadderRankBadge.css';

function labelToClass(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('master')) return 'master';
  if (s.includes('diamond')) return 'diamond';
  if (s.includes('platinum')) return 'platinum';
  if (s.includes('gold')) return 'gold';
  if (s.includes('silver')) return 'silver';
  if (s.includes('bronze')) return 'bronze';
  return 'default';
}

/**
 * Шильдик ранга Ladder: градиент + название (Bronze, Diamond…).
 */
export default function LadderRankBadge({ label }) {
  const cls = labelToClass(label);
  const text = (label || '').trim() || '—';
  return (
    <span className={`ladder-rank-badge ladder-rank-badge--${cls}`} title={text}>
      <span className="ladder-rank-badge__text">{text}</span>
    </span>
  );
}
