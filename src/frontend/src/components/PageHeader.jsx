import React from 'react';
import './PageHeader.css';

function PageHeader({ title, subtitle, primaryAction, secondaryAction }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-header-actions">
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}

export default PageHeader;
