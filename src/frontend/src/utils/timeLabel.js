// src/frontend/src/utils/timeLabel.js

/**
 * Вычисляет временной лейбл для турнира
 * @param {Object} tournament - объект турнира с полями state, date
 * @param {Date} now - текущая дата (по умолчанию new Date())
 * @returns {{ label: string, variant: 'done' | 'live' | 'today' | 'tomorrow' | 'future' }}
 */
export function computeTimeLabel(tournament, now = new Date()) {
  if (!tournament) {
    return { label: 'Неизвестно', variant: 'future' };
  }

  const state = tournament.state || '';
  
  // Проверяем завершённость
  if (state === 'DONE' || state === 'Турнир окончен' || state.toLowerCase().includes('окончен')) {
    return { label: 'Завершён', variant: 'done' };
  }

  // Проверяем, идёт ли сейчас
  if (state === 'LIVE' || state === 'В процессе' || state.toLowerCase().includes('процесс')) {
    return { label: 'В процессе', variant: 'live' };
  }

  // Если есть дата начала, вычисляем оставшееся время
  const startDateStr = tournament.date || tournament.startDate;
  if (!startDateStr) {
    return { label: 'Скоро', variant: 'future' };
  }

  const startDate = new Date(startDateStr);
  
  // Если дата некорректна
  if (isNaN(startDate.getTime())) {
    return { label: 'Скоро', variant: 'future' };
  }

  // Нормализуем даты к началу дня для корректного сравнения
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tournamentDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  const diffMs = tournamentDay - todayStart;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Если турнир уже начался (прошлая дата) - считаем что в процессе
  if (diffDays < 0) {
    return { label: 'В процессе', variant: 'live' };
  }

  if (diffDays === 0) {
    return { label: 'Сегодня', variant: 'today' };
  }

  if (diffDays === 1) {
    return { label: 'Завтра', variant: 'tomorrow' };
  }

  // Склонение для дней
  const daysWord = getDaysWord(diffDays);
  return { label: `Через ${diffDays} ${daysWord}`, variant: 'future' };
}

/**
 * Вычисляет состояние баннера для CTA и отображения
 * @param {Object} tournament - объект турнира с полями state, date
 * @param {Date} now - текущая дата (по умолчанию new Date())
 * @returns {'DONE' | 'LIVE' | 'TODAY' | 'UPCOMING' | 'UNKNOWN'}
 */
export function computeBannerState(tournament, now = new Date()) {
  if (!tournament) return 'UNKNOWN';

  const state = (tournament.state || '').trim();

  if (state === 'DONE' || state === 'Турнир окончен' || state.toLowerCase().includes('окончен')) {
    return 'DONE';
  }

  if (state === 'LIVE' || state === 'В процессе' || state.toLowerCase().includes('процесс')) {
    return 'LIVE';
  }

  const startDateStr = tournament.date || tournament.startDate;
  if (!startDateStr) return 'UNKNOWN';

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return 'UNKNOWN';

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tournamentDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const diffMs = tournamentDay - todayStart;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'LIVE';
  if (diffDays === 0) return 'TODAY';
  return 'UPCOMING';
}

/**
 * Возвращает правильное склонение слова "день"
 */
function getDaysWord(n) {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'дней';
  }

  if (lastOne === 1) {
    return 'день';
  }

  if (lastOne >= 2 && lastOne <= 4) {
    return 'дня';
  }

  return 'дней';
}

export default computeTimeLabel;
