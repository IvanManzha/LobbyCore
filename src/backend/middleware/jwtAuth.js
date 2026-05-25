// src/backend/middleware/jwtAuth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '0'; // 0 = без срока

/**
 * Создать JWT токен для пользователя
 */
function generateToken(payload) {
  if (!JWT_EXPIRES_IN || JWT_EXPIRES_IN === '0' || JWT_EXPIRES_IN === 'none') {
    return jwt.sign(payload, JWT_SECRET);
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Выдать JWT для профиля (для login и Steam exchange)
 */
function issueJwtForProfile(profile) {
  const token = generateToken({
    username: profile.username,
    pubgNick: profile.pubgNick || profile.pubgNickname || profile.username
  });
  return { token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' };
}

/**
 * Проверить JWT токен из заголовка Authorization
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Добавляем данные пользователя в запрос
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Опциональная проверка токена (не блокирует, если токена нет)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }
  
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  optionalAuth,
  issueJwtForProfile,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
