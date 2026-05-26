import React from 'react';
import './StatusLabel.css';

/**
 * Компонент для отображения статуса турнира
 * @param {Object} props
 * @param {string} props.label - текст лейбла
 * @param {'done' | 'live' | 'today' | 'tomorrow' | 'future'} props.variant - вариант стиля
 */
function StatusLabel({ label, variant = 'future' }) {
  return (
    <span className={`feed-status-label feed-status-label--${variant}`}>
      {(variant === 'live' || variant === 'today') && (
        <span className="feed-status-label__dot" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

export default StatusLabel;
