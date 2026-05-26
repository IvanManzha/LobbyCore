import React from 'react';
import { Link } from 'react-router-dom';
import './RowList.css';

function RowList({ headers = [], children }) {
  return (
    <div className="row-list">
      {headers.length > 0 && (
        <div className="row row-header">
          {headers.map((header) => (
            <div key={header}>{header}</div>
          ))}
          <div />
        </div>
      )}
      <div className="row-list-body">
        {children}
      </div>
    </div>
  );
}

function DataRow({ columns = [], action, to, rowClassName, editTo }) {
  const content = (
    <>
      {columns.map((col, idx) => (
        <div key={idx} className="row-cell">
          {col}
        </div>
      ))}
      <div className="row-action">{action}</div>
    </>
  );

  const rowClass = ['row', rowClassName].filter(Boolean).join(' ');

  if (to && editTo) {
    return (
      <div className={`${rowClass} row--with-edit`}>
        <Link to={to} className="row-link row-link--span">
          {content}
        </Link>
        <Link to={editTo} className="row-edit-link" onClick={(e) => e.stopPropagation()}>
          Редактировать
        </Link>
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className={`${rowClass} row-link`}>
        {content}
      </Link>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

export { DataRow };
export default RowList;
