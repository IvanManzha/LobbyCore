import React from 'react';
import './QuickActions.css';

function QuickActions({ actions, title = 'Быстрые действия' }) {
  return (
    <div className="quick-actions">
      {title && <h3 className="quick-actions-title">{title}</h3>}
      <div className="quick-actions-list">
        {actions.map((action, idx) => (
          <button
            key={idx}
            className="quick-action-item"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
