// src/frontend/src/utils/feedSort.js

/**
 * Сортировка постов ленты: сначала pinned (priority desc, createdAt desc),
 * затем остальные (priority desc, createdAt desc).
 * @param {Array} posts - массив постов из feed
 * @returns {Array} новый отсортированный массив (не мутирует исходный)
 */
export function sortFeedPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return posts;
  }

  const byPriorityAndDate = (a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    const da = new Date(a.createdAt || 0).getTime();
    const db = new Date(b.createdAt || 0).getTime();
    return db - da;
  };

  const pinned = posts.filter((p) => p.pinned === true).sort(byPriorityAndDate);
  const rest = posts.filter((p) => p.pinned !== true).sort(byPriorityAndDate);

  return [...pinned, ...rest];
}

export default sortFeedPosts;
