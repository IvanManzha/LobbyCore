// src/backend/utils/periodUtils.js

/**
 * Получить квартал из даты
 * @param {string|Date} date - Дата в формате YYYY-MM-DD или Date объект
 * @returns {string} Квартал в формате 'YYYY-Q1', 'YYYY-Q2', 'YYYY-Q3', 'YYYY-Q4'
 */
function getQuarterFromDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // getMonth() возвращает 0-11
  
  let quarter;
  if (month >= 1 && month <= 3) {
    quarter = 'Q1';
  } else if (month >= 4 && month <= 6) {
    quarter = 'Q2';
  } else if (month >= 7 && month <= 9) {
    quarter = 'Q3';
  } else {
    quarter = 'Q4';
  }
  
  return `${year}-${quarter}`;
}

/**
 * Получить год из даты
 * @param {string|Date} date - Дата в формате YYYY-MM-DD или Date объект
 * @returns {string} Год в формате 'YYYY'
 */
function getYearFromDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  return dateObj.getFullYear().toString();
}

/**
 * Получить текущий год и квартал
 * @returns {Object} { year: '2025', quarter: '2025-Q1' }
 */
function getCurrentPeriods() {
  const now = new Date();
  return {
    year: getYearFromDate(now),
    quarter: getQuarterFromDate(now)
  };
}

/**
 * Получить год и квартал для указанной даты
 * @param {string|Date} date - Дата в формате YYYY-MM-DD или Date объект
 * @returns {Object} { year: '2025', quarter: '2025-Q1' }
 */
function getPeriodsForDate(date) {
  return {
    year: getYearFromDate(date),
    quarter: getQuarterFromDate(date)
  };
}

/**
 * Проверить, является ли строка валидным периодом
 * @param {string} period - Период для проверки
 * @returns {boolean}
 */
function isValidPeriod(period) {
  if (!period) return false;
  
  // Проверка формата года: YYYY
  if (/^\d{4}$/.test(period)) {
    const year = parseInt(period, 10);
    return year >= 2000 && year <= 2100;
  }
  
  // Проверка формата квартала: YYYY-Q1, YYYY-Q2, YYYY-Q3, YYYY-Q4
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const year = parseInt(period.split('-')[0], 10);
    return year >= 2000 && year <= 2100;
  }
  
  return false;
}

module.exports = {
  getQuarterFromDate,
  getYearFromDate,
  getCurrentPeriods,
  getPeriodsForDate,
  isValidPeriod
};
