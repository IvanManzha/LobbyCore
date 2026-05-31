import { getTranslation } from '../i18n';

/** pathname -> i18n key (pageTitle.*) */
const ROUTE_KEYS = {
  '/': 'pageTitle.dashboard',
  '/dashboard': 'pageTitle.dashboard',
  '/feed': 'pageTitle.feed',
  '/tournaments': 'pageTitle.tournaments',
  '/schedule': 'pageTitle.tournaments',
  '/create': 'pageTitle.createTournament',
  '/create-tournament': 'pageTitle.createTournament',
  '/login': 'pageTitle.login',
  '/register': 'pageTitle.register',
  '/settings': 'pageTitle.settings',
  '/settings/plaque': 'pageTitle.plaqueEditor',
  '/finance': 'pageTitle.finance',
  '/admin/studio': 'pageTitle.adminStudio',
  '/admin/finance': 'pageTitle.adminFinance',
  '/dna-lab': 'pageTitle.dnaLab',
};

const ROUTE_PREFIX_KEYS = [
  { prefix: '/tournament/', key: 'pageTitle.tournament' },
  { prefix: '/player/', key: 'pageTitle.player' },
  { prefix: '/admin/', key: 'pageTitle.adminStudio' },
];

/**
 * Get page title for current pathname and language.
 * @param {string} pathname - location.pathname
 * @param {string} lang - 'ru' | 'en'
 * @returns {string}
 */
export function getPageTitle(pathname, lang = 'ru') {
  const key = ROUTE_KEYS[pathname];
  if (key) return getTranslation(lang, key);
  for (const { prefix, key: k } of ROUTE_PREFIX_KEYS) {
    if (pathname.startsWith(prefix)) return getTranslation(lang, k);
  }
  return getTranslation(lang, 'pageTitle.dashboard');
}
