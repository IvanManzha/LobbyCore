// src/frontend/src/components/admin/AdminToolsTab.jsx
import React, { useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import Modal from '../Modal';
import './AdminToolsTab.css';

function AdminToolsTab({ onRefetch }) {
  const [loading, setLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleExport = async () => {
    try {
      setLoading('export');
      const data = await adminApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Экспорт скачан');
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка экспорта', true);
    } finally {
      setLoading(null);
    }
  };

  const handleClearConfirm = async () => {
    try {
      setLoading('clear');
      await adminApi.clear();
      showToast('Dev-данные очищены');
      setClearModalOpen(false);
      if (onRefetch) onRefetch();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка очистки', true);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="admin-tools-tab">
      <div className="admin-tools-actions">
        <div className="admin-tools-card">
          <h4 className="admin-tools-card-title">Export JSON</h4>
          <p className="admin-tools-card-desc">Скачать текущие dev-данные (турниры и лента) в виде JSON-файла.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading === 'export'}
          >
            {loading === 'export' ? 'Экспорт...' : 'Export JSON'}
          </button>
        </div>
        <div className="admin-tools-card">
          <h4 className="admin-tools-card-title">Clear dev data</h4>
          <p className="admin-tools-card-desc">Очистить tournaments.dev.json и feed.dev.json до пустых массивов. Необратимо.</p>
          <button
            type="button"
            className="btn btn-secondary admin-tools-clear"
            onClick={() => setClearModalOpen(true)}
            disabled={loading === 'clear'}
          >
            Clear dev data
          </button>
        </div>
      </div>
      {toast && (
        <div className={`admin-feed-toast ${toast.isError ? 'admin-feed-toast--error' : ''}`} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}
      {clearModalOpen && (
        <Modal
          title="Очистить dev-данные?"
          onClose={() => setClearModalOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setClearModalOpen(false)}>Отмена</button>
              <button type="button" className="btn btn-primary admin-tools-clear" onClick={handleClearConfirm} disabled={loading === 'clear'}>
                {loading === 'clear' ? 'Очистка...' : 'Очистить'}
              </button>
            </>
          }
        >
          <p>Турниры и посты ленты в dev-файлах будут удалены. Это действие нельзя отменить.</p>
        </Modal>
      )}
    </div>
  );
}

export default AdminToolsTab;
