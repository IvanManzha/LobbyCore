// src/frontend/src/utils/feedCover.js

const COVER_BASE_PATH = '/assets/feed/covers';

const MODE_COVERS = {
  solo: `${COVER_BASE_PATH}/cover_solo.svg`,
  duo: `${COVER_BASE_PATH}/cover_duo.svg`,
  squad: `${COVER_BASE_PATH}/cover_squad.svg`,
  mixed: `${COVER_BASE_PATH}/cover_mixed.svg`,
};

const DEFAULT_COVER = `${COVER_BASE_PATH}/cover_default.svg`;

/**
 * Возвращает URL обложки по умолчанию для указанного режима турнира
 * @param {string} mode - режим турнира: solo, duo, squad, mixed
 * @returns {string} URL обложки
 */
export function getDefaultTournamentCover(mode) {
  if (!mode) return DEFAULT_COVER;
  
  const normalizedMode = mode.toLowerCase().trim();
  return MODE_COVERS[normalizedMode] || DEFAULT_COVER;
}

/**
 * Получает финальный URL обложки для карточки турнира
 * Приоритет: post.image.url -> tournament.cover -> дефолт по режиму
 * @param {Object} post - пост ленты
 * @param {Object} tournament - данные турнира
 * @returns {string} URL обложки
 */
export function resolveTournamentCover(post, tournament) {
  // 1. Картинка из поста
  if (post?.image?.url) {
    return post.image.url;
  }

  // 2. Обложка турнира
  if (tournament?.cover?.url) {
    return tournament.cover.url;
  }
  if (tournament?.cover && typeof tournament.cover === 'string') {
    return tournament.cover;
  }

  // 3. Дефолт по режиму
  const mode = tournament?.type || tournament?.mode;
  return getDefaultTournamentCover(mode);
}

/**
 * Получает alt текст для изображения
 */
export function resolveCoverAlt(post, tournament) {
  if (post?.image?.alt) {
    return post.image.alt;
  }
  if (tournament?.name) {
    return tournament.name;
  }
  return 'Tournament';
}

export default getDefaultTournamentCover;
