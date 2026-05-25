// src/backend/middleware/auth.js
const { isDevDataMode } = require('../config/dataPaths');

/**
 * Проверка прав администратора
 * Админы задаются через переменную окружения ADMIN_USERS (через запятую)
 * По умолчанию: IVANCHK
 * Теперь использует req.user из JWT токена
 */
function isAdmin(req, res, next) {
  const defaultAdmin = 'ivanchk';
  const adminUsers = (process.env.ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  
  // Получаем логин игрока из JWT токена или из body/query (для обратной совместимости)
  const playerName = req.user?.username || req.user?.playerName || req.body.playerName || req.query.playerName;

  if (!playerName) {
    return res.status(401).json({ error: 'Player name required' });
  }

  if (!adminUsers.includes(playerName.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Admin rights required.' });
  }

  next();
}

/**
 * Проверка прав банкира (доступ к админ-финансам: пополнения, выводы, распределение призов).
 * Банкиры задаются через переменную окружения BANKIR_USERS (через запятую).
 */
function isBankir(req, res, next) {
  const bankirUsers = (process.env.BANKIR_USERS || '')
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);

  if (bankirUsers.length === 0) {
    return res.status(403).json({ error: 'Finance admin is disabled. Set BANKIR_USERS.' });
  }

  const playerName = req.user?.username || req.user?.playerName || req.body.playerName || req.query.playerName;
  if (!playerName) {
    return res.status(401).json({ error: 'Player name required' });
  }

  if (!bankirUsers.includes(playerName.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Bankir rights required.' });
  }

  next();
}

/**
 * Admin Studio доступен только при DEV_DATA=true. Иначе 403.
 */
function requireDevData(req, res, next) {
  if (!isDevDataMode()) {
    return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true to enable.' });
  }
  next();
}

/**
 * Только разработчики (DEVELOPERS через запятую). Для удаления турниров и т.п.
 * Если DEVELOPERS не задан, используются ADMIN_USERS (как у isAdmin).
 */
function isDeveloper(req, res, next) {
  const devList = process.env.DEVELOPERS || process.env.ADMIN_USERS || '';
  const devUsers = devList
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
  // Тот же источник, что в isAdmin: JWT при логине отдаёт username и pubgNick
  const playerName = (req.user?.username || req.user?.pubgNick || req.user?.playerName || '').trim().toLowerCase();
  if (!playerName) {
    return res.status(401).json({ error: 'Авторизация требуется' });
  }
  if (!devUsers.length || !devUsers.includes(playerName)) {
    return res.status(403).json({ error: 'Доступ только для разработчиков' });
  }
  next();
}

module.exports = { isAdmin, isBankir, requireDevData, isDeveloper };
