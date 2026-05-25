import ru from './ru';
import en from './en';

const translations = { ru, en };

/**
 * Get translation string by language and dot-separated key.
 * @param {string} lang - 'ru' | 'en'
 * @param {string} key - e.g. 'nav.dashboard'
 * @param {Object} [params] - optional interpolation: { year: 2025 } for "Срез за {year}"
 * @returns {string}
 */
export function getTranslation(lang, key, params = {}) {
  const dict = translations[lang] || translations.ru;
  const value = key.split('.').reduce((obj, k) => obj?.[k], dict);
  const str = typeof value === 'string' ? value : key;
  if (Object.keys(params).length === 0) return str;
  return Object.entries(params).reduce((s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), str);
}

export { ru, en };
