// src/frontend/src/components/admin/AdminScenariosTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import './AdminScenariosTab.css';

function AdminScenariosTab({ onRefetch }) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.scenarios.list();
      setPresets(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка загрузки', true);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleRun = async (presetId) => {
    try {
      setRunning(presetId);
      await adminApi.scenarios.run(presetId);
      showToast(`Сценарий «${presetId}» выполнен`);
      if (onRefetch) onRefetch();
      loadPresets();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка запуска', true);
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return <p className="admin-scenarios-loading">Загрузка сценариев...</p>;
  }

  return (
    <div className="admin-scenarios-tab">
      <div className="admin-scenarios-cards">
        {presets.map(preset => (
          <div key={preset.id} className="admin-scenarios-card">
            <h4 className="admin-scenarios-card-title">{preset.name}</h4>
            <p className="admin-scenarios-card-desc">{preset.description}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleRun(preset.id)}
              disabled={running === preset.id}
            >
              {running === preset.id ? 'Запуск...' : 'Запустить'}
            </button>
          </div>
        ))}
      </div>
      {presets.length === 0 && (
        <p className="admin-scenarios-empty">Нет доступных сценариев</p>
      )}
      {toast && (
        <div className={`admin-feed-toast ${toast.isError ? 'admin-feed-toast--error' : ''}`} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default AdminScenariosTab;
