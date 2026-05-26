// src/frontend/src/utils/feed.js

/**
 * Фильтрует посты ленты по типу
 * @param {Array} posts - массив постов
 * @param {string} type - 'all' | 'tournament' | 'promo'
 * @returns {Array} отфильтрованный массив
 */
export function filterPostsByType(posts, type) {
  if (!Array.isArray(posts)) return [];
  if (!type || type === 'all') return posts;
  
  return posts.filter(post => post.type === type);
}

/**
 * Сортирует посты по приоритету и дате создания
 * @param {Array} posts - массив постов
 * @returns {Array} отсортированный массив
 */
export function sortPosts(posts) {
  if (!Array.isArray(posts)) return [];
  
  return [...posts].sort((a, b) => {
    // Сначала по приоритету (больший = выше)
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // Затем по дате создания (новые выше)
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
}

/**
 * Форматирует дату для отображения
 * @param {string} dateStr - строка даты
 * @returns {string} отформатированная дата
 */
export function formatFeedDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Форматирует режим турнира для отображения
 * @param {string} mode - режим турнира
 * @returns {string} отформатированный режим
 */
export function formatMode(mode) {
  if (!mode) return '';
  
  const modeLabels = {
    solo: 'Solo',
    duo: 'Duo',
    squad: 'Squad',
    mixed: 'Mixed'
  };
  
  return modeLabels[mode.toLowerCase()] || mode;
}

export default {
  filterPostsByType,
  sortPosts,
  formatFeedDate,
  formatMode
};
