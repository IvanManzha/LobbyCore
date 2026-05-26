import React from 'react';
import './StatusPill.css';

const statusMap = {
  REG: 'Регистрация',
  LIVE: 'В процессе',
  DONE: 'Завершен'
};

function StatusPill({ status = 'REG' }) {
  const label = statusMap[status] || status;
  return (
    <span className={`status-pill ${status.toLowerCase()}`}>
      <span className="status-led" aria-hidden="true" />
      {label}
    </span>
  );
}

export default StatusPill;
