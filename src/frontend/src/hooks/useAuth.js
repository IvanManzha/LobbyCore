// src/frontend/src/hooks/useAuth.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { playerApi, getProfile, isAuthenticated, getToken } from '../services/api';

export function useAuth() {
  const initialProfile = getProfile();
  const hasToken = Boolean(getToken());
  const [user, setUser] = useState(initialProfile);
  const [loading, setLoading] = useState(hasToken);
  const [isAuth, setIsAuth] = useState(hasToken);
  const prevUserRef = useRef(initialProfile);

  // Функция для сравнения пользователей по содержимому, а не по ссылке
  const usersEqual = (user1, user2) => {
    if (user1 === user2) return true;
    if (!user1 || !user2) return user1 === user2;
    const id1 = user1.username || user1.pubgNick || user1._id;
    const id2 = user2.username || user2.pubgNick || user2._id;
    return id1 === id2;
  };

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      if (isAuthenticated() && getToken()) {
        const data = await playerApi.verifyToken();
        const newUser = data.profile;
        const prevUser = prevUserRef.current;
        const userChanged = !usersEqual(prevUser, newUser);
        
        // Обновляем только если пользователь действительно изменился
        if (userChanged || prevUser === null) {
          prevUserRef.current = newUser;
          setUser(newUser);
          setIsAuth(true);
        }
        // Если пользователь не изменился, не обновляем state (избегаем лишних перерендеров)
        return;
      }
      
      // Пользователь не найден - обновляем только если состояние изменилось
      if (prevUserRef.current !== null) {
        prevUserRef.current = null;
        setUser(null);
        setIsAuth(false);
      }
    } catch (error) {
      // Ошибка - обновляем только если состояние изменилось
      if (prevUserRef.current !== null) {
        prevUserRef.current = null;
        setUser(null);
        setIsAuth(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Слушаем события обновления авторизации
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'profile') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Также слушаем кастомное событие для обновления в той же вкладке
    const handleAuthUpdate = () => {
      checkAuth();
    };
    
    window.addEventListener('auth-updated', handleAuthUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-updated', handleAuthUpdate);
    };
  }, [checkAuth]);

  const logout = async () => {
    await playerApi.logout();
    setUser(null);
    setIsAuth(false);
  };

  const refreshAuth = useCallback(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, loading, isAuthenticated: isAuth, logout, refreshAuth };
}
