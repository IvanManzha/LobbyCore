/**
 * Валидация даты турнира (YYYY-MM-DD).
 * Возвращает errorKey для i18n (t(errorKey, params)).
 * @param {string} dateStr - строка даты YYYY-MM-DD
 * @param {string} [todayStr] - сегодня в формате YYYY-MM-DD
 * @returns {{ valid: boolean, errorKey?: string, params?: Object }}
 */
export function validateTournamentDate(dateStr, todayStr) {
  const today = todayStr || new Date().toISOString().split('T')[0];
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, errorKey: 'dateValidation.required' };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    return { valid: false, errorKey: 'dateValidation.invalidFormat' };
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, errorKey: 'dateValidation.invalidMonth' };
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, errorKey: 'dateValidation.invalidDay', params: { max: daysInMonth } };
  }
  const dateObj = new Date(year, month - 1, day);
  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return { valid: false, errorKey: 'dateValidation.invalidFormat' };
  }

  if (dateStr < today) {
    return { valid: false, errorKey: 'dateValidation.past' };
  }

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 3;
  if (year < currentYear || year > maxYear) {
    return { valid: false, errorKey: 'dateValidation.yearRange', params: { min: currentYear, max: maxYear } };
  }

  return { valid: true };
}

/**
 * Возвращает сегодня в формате YYYY-MM-DD для атрибута min
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}
