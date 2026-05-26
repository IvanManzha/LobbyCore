// src/frontend/src/utils/registration.js

/**
 * Правила регистрации по турниру (derived от type или tournament.rules.registration)
 * @param {Object} tournament
 * @returns {{ enabled: boolean, allowSolo: boolean, allowTeams: boolean, allowFreeAgents: boolean }}
 */
export function getRegistrationRules(tournament) {
  if (!tournament) return { enabled: false, allowSolo: false, allowTeams: false, allowFreeAgents: false };
  const r = tournament.rules?.registration;
  const type = (tournament.type || '').toLowerCase();
  const defaultFreeAgents = type === 'solo' ? false : ['duo', 'squad', 'mixed'].includes(type);
  if (r && typeof r.enabled === 'boolean') {
    return {
      enabled: r.enabled,
      allowSolo: !!r.allowSolo,
      allowTeams: !!r.allowTeams,
      allowFreeAgents: typeof r.allowFreeAgents === 'boolean' ? r.allowFreeAgents : defaultFreeAgents
    };
  }
  if (type === 'solo') {
    return { enabled: true, allowSolo: true, allowTeams: false, allowFreeAgents: false };
  }
  if (['duo', 'squad', 'mixed'].includes(type)) {
    return { enabled: true, allowSolo: false, allowTeams: true, allowFreeAgents: true };
  }
  return { enabled: true, allowSolo: false, allowTeams: true, allowFreeAgents: defaultFreeAgents };
}

/** Единый список коротких названий месяцев (один стиль склонения для всех) */
export const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/**
 * Форматирует ISO дату/время для отображения: DD.MM.YYYY, HH:MM
 */
export function formatStartAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

/**
 * Дата турнира для колонки «Дата»: DD.MM.YYYY (tabular)
 */
export function formatTournamentDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr || '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Блок дедлайна регистрации для REG: countdown + короткая дата.
 * @param {Object} tournament - турнир с startAt (deadline)
 * @param {Function} [t] - i18n t(key); если не передан — русские строки по умолчанию
 * @returns {{ countdown: string, shortDate: string } | null}
 */
export function getRegistrationDeadlineDisplay(tournament, t) {
  const iso = tournament?.startAt;
  if (!iso) return null;
  const end = new Date(iso);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const day = end.getDate();
  const monthIdx = end.getMonth();
  const hours = String(end.getHours()).padStart(2, '0');
  const minutes = String(end.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  const todayLabel = t ? t('feed.today') : 'Сегодня';
  const tomorrowLabel = t ? t('feed.tomorrow') : 'Завтра';
  const closedLabel = t ? t('feed.closed') : 'Закрыта';
  const closesInLabel = t ? t('feed.closesIn') : 'Закроется через';
  const daysSuffix = t ? t('feed.days') : 'д';
  const hoursSuffix = t ? t('feed.hours') : 'ч';

  const today = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const isToday = end.getDate() === today && end.getMonth() === todayMonth && end.getFullYear() === todayYear;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = end.getDate() === tomorrow.getDate() && end.getMonth() === tomorrow.getMonth() && end.getFullYear() === tomorrow.getFullYear();

  let shortDate;
  if (isToday) shortDate = `${todayLabel} ${timeStr}`;
  else if (isTomorrow) shortDate = tomorrowLabel;
  else shortDate = `${day} ${MONTH_SHORT[monthIdx]}, ${timeStr}`;

  if (diff <= 0) {
    return { countdown: closedLabel, shortDate };
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const countdown = days > 0 ? `${closesInLabel} ${days}${daysSuffix} ${hoursLeft}${hoursSuffix}` : `${closesInLabel} ${hoursLeft}${hoursSuffix}`;
  return { countdown, shortDate };
}

/**
 * Регистрация закрыта по времени/статусу?
 * Учитывает startAt (время авто-перехода в «В процессе») и дату турнира.
 */
export function isRegistrationClosed(tournament) {
  if (!tournament) return true;
  const state = tournament.state || '';
  if (state === 'Турнир окончен' || state === 'DONE') return true;
  if (state === 'В процессе') return true;
  const startDate = tournament.startAt || tournament.startedAt || tournament.date;
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime()) && new Date() >= start) return true;
  }
  return false;
}

/**
 * Находит регистрацию текущего игрока в турнире (entries или freeAgents)
 * @param {Object} tournament - объект турнира с полем registration.entries и registration.freeAgents
 * @param {string} currentPlayerId - ник/username текущего пользователя
 * @returns {{ kind: string, teamName?: string, entry: Object } | null}
 */
export function getMyRegistration(tournament, currentPlayerId) {
  if (!currentPlayerId) return null;

  const cur = (currentPlayerId || '').trim().toLowerCase();
  const entries = tournament?.registration?.entries || [];
  const entry = entries.find((e) => {
    if (e.kind === 'solo') return (e.playerId || '').trim().toLowerCase() === cur;
    if (e.kind === 'team') {
      const cap = (e.captainId || '').trim().toLowerCase();
      const inMembers = e.members && e.members.some((m) => (String(m || '').trim().toLowerCase()) === cur);
      return cap === cur || inMembers;
    }
    return false;
  });
  if (entry) {
    return {
      kind: entry.kind,
      teamName: entry.kind === 'team' ? entry.name : undefined,
      entry
    };
  }

  const freeAgents = tournament?.registration?.freeAgents || [];
  const faEntry = freeAgents.find((fa) => (fa.playerId || '').trim().toLowerCase() === cur && fa.status !== 'withdrawn');
  if (faEntry) {
    return { kind: 'free_agent', entry: faEntry };
  }

  return null;
}

/**
 * Количество активных свободных агентов в турнире
 * @param {Object} tournament
 * @returns {number}
 */
export function getFreeAgentsCount(tournament) {
  const freeAgents = tournament?.registration?.freeAgents || [];
  return freeAgents.filter((fa) => fa.status !== 'withdrawn').length;
}

export default getMyRegistration;
