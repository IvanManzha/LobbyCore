// src/frontend/src/components/admin/AdminLogsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import './AdminLogsTab.css';

function AdminLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.logs.getRecent(100);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatAt = (at) => {
    if (!at) return '—';
    try {
      return new Date(at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return at;
    }
  };

  if (loading) {
    return <p className="admin-logs-loading">Загрузка логов...</p>;
  }

  return (
    <div className="admin-logs-tab">
      <div className="admin-logs-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs}>Обновить</button>
      </div>
      <div className="admin-logs-list">
        {logs.length === 0 ? (
          <p className="admin-logs-empty">Нет записей</p>
        ) : (
          <table className="admin-logs-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, idx) => (
                <tr key={idx}>
                  <td>{formatAt(entry.at)}</td>
                  <td>{entry.userId}</td>
                  <td><code>{entry.action}</code></td>
                  <td>{entry.entityType || '—'}</td>
                  <td>{entry.entityId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminLogsTab;
