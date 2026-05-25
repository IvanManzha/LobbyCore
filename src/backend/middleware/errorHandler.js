// src/backend/middleware/errorHandler.js

/**
 * Централизованная обработка ошибок
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Ошибка валидации
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  // Ошибка "Не найдено"
  if (err.status === 404 || err.message.includes('not found')) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message
    });
  }

  // Ошибка "Уже существует"
  if (err.message.includes('already exists') || err.message.includes('already registered')) {
    return res.status(409).json({
      error: 'Conflict',
      message: err.message
    });
  }

  // Общая ошибка сервера
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
}

module.exports = errorHandler;

