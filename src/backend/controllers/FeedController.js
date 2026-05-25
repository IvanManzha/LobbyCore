// src/backend/controllers/FeedController.js
const fs = require('fs').promises;
const { feedPath, tournamentsPath } = require('../config/dataPaths');

class FeedController {
  /**
   * GET /api/v1/feed
   * Возвращает отфильтрованный и отсортированный список постов ленты
   */
  async getFeed(req, res) {
    try {
      // Читаем feed.json
      let feedData = [];
      try {
        const feedContent = await fs.readFile(feedPath, 'utf-8');
        feedData = JSON.parse(feedContent);
      } catch (err) {
        if (err.code === 'ENOENT') {
          // Файл не существует - возвращаем пустой массив
          return res.json([]);
        }
        throw err;
      }

      const now = new Date();

      // Фильтруем посты
      const filteredPosts = feedData.filter(post => {
        // Только опубликованные
        if (post.status !== 'published') return false;

        // Проверяем startAt (если задано, пост виден только после этой даты)
        if (post.startAt) {
          const startAt = new Date(post.startAt);
          if (now < startAt) return false;
        }

        // Проверяем endAt (если задано, пост виден только до этой даты)
        if (post.endAt) {
          const endAt = new Date(post.endAt);
          if (now > endAt) return false;
        }

        return true;
      });

      // Сортируем: priority desc, затем createdAt desc
      const sortedPosts = filteredPosts.sort((a, b) => {
        // Сначала по приоритету (больший приоритет = выше)
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;

        // Затем по дате создания (новые выше)
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      res.json(sortedPosts);
    } catch (error) {
      console.error('Error fetching feed:', error);
      res.status(500).json({ error: 'Failed to load feed' });
    }
  }
}

module.exports = new FeedController();
