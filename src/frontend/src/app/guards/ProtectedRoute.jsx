// src/frontend/src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { playerApi, isAuthenticated, getToken } from '@/services/api';

function ProtectedRoute({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated() || !getToken()) {
        setIsValid(false);
        setIsLoading(false);
        return;
      }

      try {
        // Проверяем валидность токена
        await playerApi.verifyToken();
        setIsValid(true);
      } catch (error) {
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <div className="loading">Проверка авторизации...</div>;
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
