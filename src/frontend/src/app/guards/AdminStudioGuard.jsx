// src/frontend/src/components/AdminStudioGuard.jsx
import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

const adminUsersFromEnv = () => {
  const defaultAdmin = 'ivanchk';
  return (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
};

const devDataEnabled = () => import.meta.env.VITE_DEV_DATA === 'true';

function AdminStudioGuard({ children }) {
  const { user, loading } = useAuth();
  const adminUsers = useMemo(adminUsersFromEnv, []);
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return adminUsers.includes(userKey);
  }, [user, adminUsers]);
  const devMode = devDataEnabled();

  if (loading) {
    return (
      <div className="admin-studio-loading">Проверка доступа...</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-studio-denied">
          <h2>Доступ запрещён</h2>
          <p>Только администраторы могут открыть эту страницу.</p>
        </div>
    );
  }

  if (!devMode) {
    return (
      <div className="admin-studio-denied">
          <h2>Admin Studio отключён</h2>
          <p>Включите режим dev (VITE_DEV_DATA=true) для доступа.</p>
        </div>
    );
  }

  return children;
}

export default AdminStudioGuard;
