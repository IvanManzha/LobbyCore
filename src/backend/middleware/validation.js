// src/backend/middleware/validation.js

/**
 * Простая валидация данных
 */
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Валидация регистрации команды
 */
function validateAddTeam(req, res, next) {
  const { name, players, isSolo } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Team name is required and must be a non-empty string'
    });
  }

  if (!isSolo) {
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Players must be an array'
      });
    }

    if (players.length < 2 || players.length > 4) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Team must have 2-4 players'
      });
    }

    // Проверяем, что все игроки - строки
    if (!players.every(p => typeof p === 'string' && p.trim().length > 0)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'All players must be non-empty strings'
      });
    }
  }

  next();
}

/**
 * Проверка даты турнира: реальный календарный день, не в прошлом, год в допустимом диапазоне.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} [todayStr] - сегодня YYYY-MM-DD
 * @returns {string|null} сообщение об ошибке или null если ок
 */
function validateTournamentDateValue(dateStr, todayStr) {
  const today = todayStr || new Date().toISOString().slice(0, 10);
  if (!dateStr || typeof dateStr !== 'string') return 'Date is required';
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const m = dateRegex.exec(dateStr.trim());
  if (!m) return 'Date must be in format YYYY-MM-DD';
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12) return 'Month must be between 1 and 12';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return `Day must be between 1 and ${daysInMonth} for the selected month`;
  if (dateStr < today) return 'Tournament date cannot be in the past';
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 3;
  if (year < currentYear || year > maxYear) return `Year must be between ${currentYear} and ${maxYear}`;
  return null;
}

/**
 * Валидация создания турнира
 */
function validateCreateTournament(req, res, next) {
  const { name, date, type, rounds } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Tournament name is required and must be a non-empty string'
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Tournament name must be less than 100 characters'
    });
  }

  if (!date || typeof date !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Date is required and must be a valid date string (YYYY-MM-DD)'
    });
  }

  // Проверка формата даты
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Date must be in format YYYY-MM-DD'
    });
  }

  const dateError = validateTournamentDateValue(date);
  if (dateError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: dateError
    });
  }

  const validTypes = ['solo', 'duo', 'squad', 'mixed'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Type must be one of: ${validTypes.join(', ')}`
    });
  }

  if (rounds == null || typeof rounds !== 'number' || rounds < 1 || rounds > 100) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Rounds must be a number between 1 and 100'
    });
  }

  // Опциональные поля
  if (req.body.price != null && (typeof req.body.price !== 'number' || req.body.price < 0)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Price must be a non-negative number'
    });
  }

  if (req.body.barrier != null && (typeof req.body.barrier !== 'number' || req.body.barrier < 0)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Barrier must be a non-negative number'
    });
  }

  next();
}

/**
 * Валидация обновления турнира (проверка date в body при наличии)
 */
function validateUpdateTournament(req, res, next) {
  const date = req.body.date;
  if (date == null) return next();
  if (typeof date !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Date must be a string (YYYY-MM-DD)'
    });
  }
  const dateError = validateTournamentDateValue(date);
  if (dateError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: dateError
    });
  }
  next();
}

/**
 * Валидация регистрации аккаунта
 */
function validateRegister(req, res, next) {
  const { password, pubgNick } = req.body;

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Пароль должен быть не менее 6 символов'
    });
  }

  if (!pubgNick || typeof pubgNick !== 'string' || pubgNick.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'PUBG-ник обязателен'
    });
  }

  next();
}

/**
 * Валидация логина игрока
 */
function validateLogin(req, res, next) {
  const { pubgNick, password } = req.body;

  if (!pubgNick || typeof pubgNick !== 'string' || pubgNick.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'PUBG-ник обязателен'
    });
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Пароль обязателен'
    });
  }

  next();
}

/**
 * Валидация обновления профиля
 */
function validateUpdateProfile(req, res, next) {
  const { pubgNick, password, currentPassword } = req.body;
  if (pubgNick != null) {
    if (typeof pubgNick !== 'string' || pubgNick.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'PUBG-ник обязателен'
      });
    }
  }

  if (password != null) {
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Пароль должен быть не менее 6 символов'
      });
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Текущий пароль обязателен'
      });
    }
  }

  next();
}

/**
 * Валидация регистрации на турнир (solo/team)
 */
function validateRegisterTournament(req, res, next) {
  const { kind, teamName } = req.body;

  if (!kind || !['solo', 'team', 'free_agent'].includes(kind)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'kind обязателен и должен быть "solo", "team" или "free_agent"'
    });
  }

  if (kind === 'team') {
    const name = typeof teamName === 'string' ? teamName.trim() : '';
    if (name.length < 2 || name.length > 24) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Название команды: от 2 до 24 символов'
      });
    }
  }

  next();
}

module.exports = {
  ValidationError,
  validateAddTeam,
  validateCreateTournament,
  validateUpdateTournament,
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateRegisterTournament
};
