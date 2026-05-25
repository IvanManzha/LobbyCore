// src/backend/services/MetricRecordsService.js
const { db } = require('../../../lib/db');

class MetricRecordsService {
  /**
   * Определяет, является ли новое значение лучше старого для метрики
   */
  isBetterValue(metricId, newValue, oldValue) {
    if (oldValue == null) return true;
    if (newValue == null) return false;

    // Для avg_place: меньше = лучше
    if (metricId === 'avg_place') {
      return newValue < oldValue;
    }

    // Для остальных метрик: больше = лучше
    return newValue > oldValue;
  }

  /**
   * Обновить рекорд для игрока, если новое значение лучше
   * @returns {boolean} true если рекорд был обновлён, false если нет
   */
  async updateRecord(playerId, metricId, value, scope) {
    if (value == null || !Number.isFinite(value)) {
      return false;
    }

    try {
      const existing = await db('metric_records')
        .where({
          metric_id: metricId,
          scope,
          player_id: playerId
        })
        .first();

      if (!existing) {
        // Создаём новую запись
        await db('metric_records').insert({
          metric_id: metricId,
          scope,
          player_id: playerId,
          value,
          updated_at: db.fn.now()
        });
        return true;
      }

      // Проверяем, лучше ли новое значение
      if (this.isBetterValue(metricId, value, existing.value)) {
        await db('metric_records')
          .where({
            metric_id: metricId,
            scope,
            player_id: playerId
          })
          .update({
            value,
            updated_at: db.fn.now()
          });
        return true;
      }

      return false; // Рекорд не обновлён, новое значение не лучше
    } catch (error) {
      console.error(`Ошибка обновления рекорда для ${playerId}, ${metricId}:`, error);
      return false;
    }
  }

  /**
   * Обновить все рекорды игрока после пересчёта статистики
   */
  async updateAllRecordsForPlayer(playerId, stats, scope = 'all_time') {
    if (!stats || !stats.core) {
      return;
    }

    const updates = [];

    // Маппинг метрик из stats в metric_id
    const metricMap = {
      avg_place: 'avg_place',
      kills_per_match: 'kills_per_match',
      winrate: 'winrate',
      top_rate: 'top_rate',
      kd: 'kd'
    };

    // Обновляем core метрики
    for (const metric of stats.core) {
      const metricId = metricMap[metric.id];
      if (metricId && metric.value != null && Number.isFinite(metric.value)) {
        updates.push(
          this.updateRecord(playerId, metricId, metric.value, scope)
        );
      }
    }

    // Обновляем points_per_match из secondary
    if (stats.secondary) {
      const pointsMetric = stats.secondary.find((m) => m.id === 'avg_points');
      if (pointsMetric && pointsMetric.value != null && Number.isFinite(pointsMetric.value)) {
        updates.push(
          this.updateRecord(playerId, 'points_per_match', pointsMetric.value, scope)
        );
      }
    }

    await Promise.all(updates);
  }

  /**
   * Получить все рекорды для метрики и scope (для расчёта перцентилей)
   */
  async getRecordsForPercentile(metricId, scope) {
    try {
      const records = await db('metric_records')
        .where({
          metric_id: metricId,
          scope
        })
        .select('value')
        .orderBy('value', metricId === 'avg_place' ? 'asc' : 'desc');

      return records.map((r) => r.value);
    } catch (error) {
      console.error(`Ошибка получения рекордов для ${metricId}, ${scope}:`, error);
      return [];
    }
  }

  /**
   * Вычислить перцентиль для значения игрока на основе сохранённых рекордов
   */
  async calculatePercentile(playerId, metricId, value, scope) {
    if (value == null || !Number.isFinite(value)) {
      return null;
    }

    try {
      const allValues = await this.getRecordsForPercentile(metricId, scope);

      if (allValues.length === 0) {
        return null;
      }

      // Для avg_place сортируем по возрастанию (меньше = лучше)
      // Для остальных - по убыванию (больше = лучше)
      const sorted = metricId === 'avg_place'
        ? [...allValues].sort((a, b) => a - b)
        : [...allValues].sort((a, b) => b - a);

      // Находим позицию текущего значения
      let rank = -1;
      if (metricId === 'avg_place') {
        // Для avg_place: ищем первое значение >= value (меньше или равно = лучше)
        rank = sorted.findIndex((v) => v >= value);
      } else {
        // Для остальных: ищем первое значение <= value (больше или равно = лучше)
        rank = sorted.findIndex((v) => v <= value);
      }

      // Если не нашли (значение лучше всех), перцентиль = 100
      if (rank === -1) {
        return 100;
      }

      // Вычисляем перцентиль
      const percentile = (rank / sorted.length) * 100;

      // Для avg_place инвертируем результат
      if (metricId === 'avg_place') {
        return Math.round(100 - percentile);
      }

      return Math.round(percentile);
    } catch (error) {
      console.error(`Ошибка вычисления перцентиля для ${playerId}, ${metricId}:`, error);
      return null;
    }
  }
}

module.exports = new MetricRecordsService();
