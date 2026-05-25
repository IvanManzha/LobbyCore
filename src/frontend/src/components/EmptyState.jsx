import React from 'react';
import './EmptyState.css';

function EmptyState({ title, description, primaryAction, secondaryAction, footnote }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {description && <div className="empty-description">{description}</div>}
      <div className="empty-actions">
        {secondaryAction}
        {primaryAction}
      </div>
      {footnote && <div className="empty-footnote">{footnote}</div>}
    </div>
  );
}

export default EmptyState;
