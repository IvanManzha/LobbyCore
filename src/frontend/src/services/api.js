// src/frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1\/?$/, '') || window.location.origin;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для добавления токена в заголовки
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для обработки ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      removeProfile();
      window.dispatchEvent(new Event('auth-updated'));
    }
    return Promise.reject(error);
  }
);

// Утилиты для работы с токеном
export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

export function getProfile() {
  const profileStr = localStorage.getItem('profile');
  return profileStr ? JSON.parse(profileStr) : null;
}

export function setProfile(profile) {
  localStorage.setItem('profile', JSON.stringify(profile));
}

export function removeProfile() {
  localStorage.removeItem('profile');
}

export function isAuthenticated() {
  return !!getToken();
}

/** Origin бэкенда для Steam (редирект и exchange). В dev без VITE_API_URL = localhost:3100 */
export function getBackendOrigin() {
  if (import.meta.env.VITE_BACKEND_ORIGIN) return String(import.meta.env.VITE_BACKEND_ORIGIN).replace(/\/$/, '');
  if (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).startsWith('http')) return API_ORIGIN;
  if (import.meta.env.DEV) return 'http://localhost:3100';
  return window.location.origin;
}

// Кеширование для GET запросов
const cache = new Map();
const CACHE_TTL = 60000; // 1 минута

function getCacheKey(url, params) {
  return `${url}?${JSON.stringify(params)}`;
}

// Ladder (турнирный рейтинг)
export const ladderApi = {
  getLeaderboard: async (season = null) => {
    const params = season ? { season } : {};
    const response = await api.get('/ladder', { params });
    return response.data;
  }
};

// Турниры
export const tournamentApi = {
  getAll: async () => {
    const cacheKey = getCacheKey('/tournaments');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get('/tournaments');
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  getById: async (id) => {
    const cacheKey = getCacheKey(`/tournaments/${id}`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get(`/tournaments/${id}`);
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  getTable: async (id) => {
    const cacheKey = getCacheKey(`/tournaments/${id}/table`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get(`/tournaments/${id}/table`);
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  getActive: async () => {
    const cacheKey = getCacheKey('/tournaments/active');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get('/tournaments/active');
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  create: async (tournamentData) => {
    const response = await api.post('/tournaments', tournamentData);
    // Инвалидируем кеш
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data.tournament;
  },

  update: async (tournamentId, tournamentData) => {
    const response = await api.put(`/tournaments/${tournamentId}`, tournamentData);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data.tournament;
  },

  addTeam: async (tournamentId, teamData) => {
    const response = await api.post(`/tournaments/${tournamentId}/teams`, teamData);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  removeTeam: async (tournamentId, teamName) => {
    const encoded = encodeURIComponent(teamName);
    const response = await api.delete(`/tournaments/${tournamentId}/teams/${encoded}`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey('/tournaments/active'));
    cache.delete(getCacheKey('/tournaments'));
    return response.data;
  },

  startTournament: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/start`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    cache.delete(getCacheKey('/tournaments'));
    return response.data;
  },

  addRound: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/add-round`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey('/tournaments'));
    return response.data;
  },

  closeTournament: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/close`);
    // Инвалидируем кеш
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    cache.delete(getCacheKey('/tournaments'));
    return response.data;
  },

  recalculateLeaderboard: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/leaderboard/recalculate`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  register: async (tournamentId, { kind, teamName, members }) => {
    const body = { kind, teamName };
    if (members && Array.isArray(members) && members.length > 0) body.members = members;
    const response = await api.post(`/tournaments/${tournamentId}/register`, body);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  withdrawFreeAgent: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/withdraw-free-agent`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  payEntry: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/pay-entry`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  payShare: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/pay-share`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  getLeavePreview: async (tournamentId) => {
    const response = await api.get(`/tournaments/${tournamentId}/leave-preview`);
    return response.data;
  },

  leave: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/leave`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  cancelTournament: async (tournamentId) => {
    const response = await api.post(`/tournaments/${tournamentId}/cancel`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  },

  deleteTournament: async (tournamentId) => {
    const response = await api.delete(`/tournaments/${tournamentId}`);
    cache.delete(getCacheKey(`/tournaments/${tournamentId}`));
    cache.delete(getCacheKey(`/tournaments/${tournamentId}/table`));
    cache.delete(getCacheKey('/tournaments'));
    cache.delete(getCacheKey('/tournaments/active'));
    return response.data;
  }
};

export const financeApi = {
  getWallet: () => api.get('/finance/wallet').then(r => r.data),
  getLedger: (limit = 50) => api.get('/finance/ledger', { params: { limit } }).then(r => r.data),
  getMyTopups: () => api.get('/finance/topups').then(r => r.data),
  getMyCashouts: () => api.get('/finance/cashouts').then(r => r.data),
  createTopup: (amountDC) => api.post('/finance/topup', { amountDC }).then(r => r.data),
  createCashout: (data) => api.post('/finance/cashout/request', data).then(r => r.data),
  transfer: (data) => api.post('/finance/transfer', data).then(r => r.data),
};

// Админ: финансы
export const adminFinanceApi = {
  getTopups: (status = 'pending') => api.get('/admin/finance/topups', { params: { status } }).then(r => r.data),
  getCashouts: (status = 'requested') => api.get('/admin/finance/cashouts', { params: { status } }).then(r => r.data),
  confirmTopup: (id, adminNote) => api.post(`/admin/finance/topup/${id}/confirm`, { adminNote }).then(r => r.data),
  rejectTopup: (id, adminNote) => api.post(`/admin/finance/topup/${id}/reject`, { adminNote }).then(r => r.data),
  markCashoutPaid: (id, adminNote) => api.post(`/admin/finance/cashout/${id}/mark-paid`, { adminNote }).then(r => r.data),
  rejectCashout: (id, adminNote) => api.post(`/admin/finance/cashout/${id}/reject`, { adminNote }).then(r => r.data),
  finalizePayout: (tournamentId) => api.post(`/admin/finance/tournaments/${tournamentId}/payout`).then(r => r.data),
  getPayoutBatches: (status) => api.get('/admin/finance/payout-batches', { params: status ? { status } : {} }).then(r => r.data),
  getPayoutBatch: (id) => api.get(`/admin/finance/payout-batches/${id}`).then(r => r.data),
  markPayoutLinePaid: (batchId, lineId) => api.post(`/admin/finance/payout-batches/${batchId}/lines/${lineId}/mark-paid`).then(r => r.data),
  markPayoutBatchAllPaid: (batchId) => api.post(`/admin/finance/payout-batches/${batchId}/mark-all-paid`).then(r => r.data),
  getFinalFunds: () => api.get('/admin/finance/final-funds').then(r => r.data)
};

export const steamLinkRequestApi = {
  create: (targetPubgNick) => api.post('/steam-link-request', { targetPubgNick }).then(r => r.data),
  list: () => api.get('/admin/steam-link-requests').then(r => r.data),
  approve: (id) => api.post(`/admin/steam-link-requests/${id}/approve`).then(r => r.data),
  reject: (id) => api.post(`/admin/steam-link-requests/${id}/reject`).then(r => r.data)
};

// Игроки
export const playerApi = {
  getAll: async () => {
    const cacheKey = getCacheKey('/players');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get('/players');
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  search: async (query = '') => {
    const params = query && String(query).trim() ? { query: String(query).trim() } : {};
    const response = await api.get('/players', { params });
    return response.data;
  },

  getProfile: async (name) => {
    const cacheKey = getCacheKey(`/players/${name}`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get(`/players/${name}`);
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  getStats: async (name, year = null) => {
    const url = year
      ? `/players/${name}/stats?year=${year}`
      : `/players/${name}/stats`;
    const response = await api.get(url);
    return response.data;
  },

  getChampionships: async (name) => {
    const cacheKey = getCacheKey(`/players/${name}/championships`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get(`/players/${name}/championships`);
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  getCosmetics: async (name) => {
    const response = await api.get(`/players/${encodeURIComponent(name)}/cosmetics`);
    return response.data;
  },

  getMyCosmetics: async () => {
    const response = await api.get('/players/me/cosmetics');
    return response.data;
  },

  updateMyCosmetics: async (loadout) => {
    const response = await api.put('/players/me/cosmetics', loadout);
    return response.data;
  },

  getAvailableYears: async (name) => {
    const cacheKey = getCacheKey(`/players/${name}/years`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get(`/players/${name}/years`);
    const years = Array.isArray(response.data?.years) ? response.data.years : [];
    cache.set(cacheKey, { data: years, timestamp: Date.now() });
    return years;
  },

  getPercentile: async (metric, scope, value, playerId) => {
    const cacheKey = getCacheKey(`/stats/percentile?metric=${metric}&scope=${scope}&value=${value}&playerId=${playerId}`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    try {
      const response = await api.get('/stats/percentile', {
        params: { metric, scope, value, playerId }
      });
      const percentile = response.data?.percentile ?? null;
      cache.set(cacheKey, { data: percentile, timestamp: Date.now() });
      return percentile;
    } catch (error) {
      console.warn(`Не удалось загрузить перцентиль для ${metric}:`, error);
      return null;
    }
  },

  login: async (pubgNick, password) => {
    const response = await api.post('/players/login', { pubgNick, password });
    if (response.data.token) {
      setToken(response.data.token);
    }
    if (response.data.profile) {
      setProfile(response.data.profile);
    }
    // Отправляем событие для обновления состояния авторизации
    window.dispatchEvent(new Event('auth-updated'));
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/players/logout');
    } catch (error) {
      // Игнорируем ошибки при выходе
    } finally {
      removeToken();
      removeProfile();
      // Отправляем событие для обновления состояния авторизации
      window.dispatchEvent(new Event('auth-updated'));
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/players/me');
    if (response.data.profile) {
      setProfile(response.data.profile);
    }
    return response.data;
  },

  verifyToken: async () => {
    try {
      const response = await api.post('/players/verify-token');
      if (response.data.profile) {
        setProfile(response.data.profile);
      }
      return response.data;
    } catch (error) {
      removeToken();
      removeProfile();
      throw error;
    }
  },

  register: async ({ pubgNick, password }) => {
    const response = await api.post('/players/register', { pubgNick, password });
    return response.data;
  },

  updateProfile: async (updates) => {
    const response = await api.put('/players/me', updates);
    if (response.data.token) {
      setToken(response.data.token);
    }
    if (response.data.profile) {
      setProfile(response.data.profile);
    }
    window.dispatchEvent(new Event('auth-updated'));
    return response.data;
  },

  getSteamLinkUrl: async (returnTo = '/settings') => {
    const response = await axios.post(`${getBackendOrigin()}/auth/steam/link-url`, { returnTo }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      }
    });
    return response.data.url;
  }
};

// Статистика (админские операции)
export const statsApi = {
  createYearSnapshot: async (year) => {
    const response = await api.post(`/stats/create-year-snapshot/${year}`);
    cache.clear();
    return response.data;
  },
};

// Лента (Feed)
export const feedApi = {
  getAll: async () => {
    const cacheKey = getCacheKey('/feed');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const response = await api.get('/feed');
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return response.data;
  }
};

// Admin Studio API (requires auth + admin + DEV_DATA)
export const adminApi = {
  getConfig: async () => {
    const response = await api.get('/admin/config');
    return response.data;
  },
  feed: {
    getAll: async () => {
      const response = await api.get('/admin/feed');
      return response.data;
    },
    create: async (post) => {
      const response = await api.post('/admin/feed', post);
      return response.data;
    },
    update: async (id, post) => {
      const response = await api.put(`/admin/feed/${id}`, post);
      return response.data;
    },
    delete: async (id) => {
      const response = await api.delete(`/admin/feed/${id}`);
      return response.data;
    }
  },
  tournaments: {
    getAll: async () => {
      const response = await api.get('/admin/tournaments');
      return response.data;
    },
    getById: async (id) => {
      const response = await api.get(`/admin/tournaments/${id}`);
      return response.data;
    },
    create: async (data) => {
      const response = await api.post('/admin/tournaments', data);
      return response.data;
    },
    update: async (id, data) => {
      const response = await api.put(`/admin/tournaments/${id}`, data);
      return response.data;
    },
    setStatus: async (id, status) => {
      const response = await api.post(`/admin/tournaments/${id}/status`, { status });
      return response.data;
    }
  },
  scenarios: {
    list: async () => {
      const response = await api.get('/admin/scenarios');
      return response.data;
    },
    run: async (presetId) => {
      const response = await api.post('/admin/scenarios/run', { presetId });
      return response.data;
    }
  },
  export: async () => {
    const response = await api.get('/admin/export');
    return response.data;
  },
  clear: async () => {
    const response = await api.post('/admin/clear');
    return response.data;
  },
  logs: {
    getRecent: async (limit = 50) => {
      const response = await api.get('/admin/logs', { params: { limit } });
      return response.data;
    }
  }
};

// SSE для real-time обновлений
export function subscribeToUpdates(callback) {
  const eventSource = new EventSource('/api/stream');

  eventSource.addEventListener('table-updated', (e) => {
    const tournamentId = e.data;
    // Инвалидируем кеш
    cache.clear();
    callback(tournamentId);
  });

  return () => eventSource.close();
}

export default api;

