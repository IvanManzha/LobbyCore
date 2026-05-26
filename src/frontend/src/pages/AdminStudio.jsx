// src/frontend/src/pages/AdminStudio.jsx
import React, { useState, useCallback } from 'react';
import { Tabs } from '@/shared/ui';
import { adminApi } from '@/services/api';
import {
  AdminFeedTab,
  AdminTournamentsTab,
  AdminScenariosTab,
  AdminToolsTab,
  AdminLogsTab,
} from '@/widgets/admin-studio';
import './AdminStudio.css';

const TAB_IDS = {
  FEED: 'feed',
  TOURNAMENTS: 'tournaments',
  SCENARIOS: 'scenarios',
  TOOLS: 'tools',
  LOGS: 'logs'
};

const TABS = [
  { id: TAB_IDS.FEED, label: 'Лента / Баннеры' },
  { id: TAB_IDS.TOURNAMENTS, label: 'Турниры' },
  { id: TAB_IDS.SCENARIOS, label: 'Сценарии' },
  { id: TAB_IDS.TOOLS, label: 'Инструменты' },
  { id: TAB_IDS.LOGS, label: 'Логи' }
];

function AdminStudio() {
  const [activeTab, setActiveTab] = useState(TAB_IDS.FEED);
  const [quickActionLoading, setQuickActionLoading] = useState(null);
  const [quickToast, setQuickToast] = useState(null);

  const showQuickToast = useCallback((message, isError = false) => {
    setQuickToast({ message, isError });
    setTimeout(() => setQuickToast(null), 3000);
  }, []);

  const handleSeedDemo = async () => {
    setQuickActionLoading('seed');
    try {
      await adminApi.scenarios.run('feed_basic');
      showQuickToast('Демо-данные загружены');
      setActiveTab(TAB_IDS.SCENARIOS);
    } catch (err) {
      showQuickToast(err.response?.data?.error || err.message || 'Ошибка', true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleClearDev = () => {
    setActiveTab(TAB_IDS.TOOLS);
  };

  const handleExport = async () => {
    setQuickActionLoading('export');
    try {
      const data = await adminApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showQuickToast('Экспорт скачан');
    } catch (err) {
      showQuickToast(err.response?.data?.error || err.message || 'Ошибка экспорта', true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  return (
    <div className="admin-studio">
        <div className="admin-studio-header">
          <div className="admin-studio-title-row">
            <span className="admin-studio-badge">DEV DATA MODE</span>
          </div>
          <div className="admin-studio-quick-actions">
            <button type="button" className="btn btn-secondary" onClick={handleSeedDemo} disabled={quickActionLoading === 'seed'}>
              {quickActionLoading === 'seed' ? 'Загрузка...' : 'Seed demo data'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClearDev}>
              Clear dev data
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={quickActionLoading === 'export'}>
              {quickActionLoading === 'export' ? 'Экспорт...' : 'Export JSON'}
            </button>
          </div>
        </div>
        {quickToast && (
          <div className={`admin-feed-toast ${quickToast.isError ? 'admin-feed-toast--error' : ''}`} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
            {quickToast.message}
          </div>
        )}

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="admin-studio-content">
          {activeTab === TAB_IDS.FEED && (
            <div className="admin-studio-tab-panel" data-tab="feed">
              <AdminFeedTab />
            </div>
          )}
          {activeTab === TAB_IDS.TOURNAMENTS && (
            <div className="admin-studio-tab-panel" data-tab="tournaments">
              <AdminTournamentsTab />
            </div>
          )}
          {activeTab === TAB_IDS.SCENARIOS && (
            <div className="admin-studio-tab-panel" data-tab="scenarios">
              <AdminScenariosTab />
            </div>
          )}
          {activeTab === TAB_IDS.TOOLS && (
            <div className="admin-studio-tab-panel" data-tab="tools">
              <AdminToolsTab />
            </div>
          )}
          {activeTab === TAB_IDS.LOGS && (
            <div className="admin-studio-tab-panel" data-tab="logs">
              <AdminLogsTab />
            </div>
          )}
        </div>
      </div>
  );
}

export default AdminStudio;
