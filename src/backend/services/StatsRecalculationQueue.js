// src/backend/services/StatsRecalculationQueue.js
// Очередь задач для пересчета статистики игроков
// Обрабатывает задачи последовательно, чтобы не перегружать систему

class StatsRecalculationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 1; // Обрабатываем по одной задаче за раз
    this.currentProcessing = 0;
  }

  /**
   * Добавить задачу в очередь
   * @param {string} playerId - ID игрока
   * @param {string|null} tournamentDate - Дата турнира (опционально)
   * @param {string} priority - 'high' (немедленно) или 'normal' (в очередь)
   */
  async enqueue(playerId, tournamentDate = null, priority = 'normal') {
    const task = {
      playerId,
      tournamentDate,
      priority,
      id: `${playerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    if (priority === 'high') {
      // Высокоприоритетные задачи в начало очереди
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }

    // Удаляем дубликаты для того же игрока (оставляем последний добавленный)
    // Это предотвращает множественные пересчеты для одного игрока
    const seen = new Map();
    this.queue = this.queue.filter(t => {
      const key = t.playerId; // Только по playerId, так как recalculateAllPeriods пересчитывает все периоды
      if (seen.has(key)) {
        // Если уже есть задача для этого игрока, удаляем старую
        return false;
      }
      seen.set(key, t);
      return true;
    });

    // Запускаем обработку, если еще не запущена
    this.processQueue();

    return task.id;
  }

  /**
   * Добавить несколько задач в очередь
   * @param {Array<{playerId: string, tournamentDate?: string}>} tasks
   * @param {string} priority
   */
  async enqueueBatch(tasks, priority = 'normal') {
    const taskIds = [];
    for (const task of tasks) {
      const id = await this.enqueue(task.playerId, task.tournamentDate || null, priority);
      taskIds.push(id);
    }
    return taskIds;
  }

  /**
   * Обработать очередь задач
   */
  async processQueue() {
    if (this.processing || this.currentProcessing >= this.maxConcurrent) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.currentProcessing < this.maxConcurrent) {
      const task = this.queue.shift();
      this.currentProcessing++;

      // Обрабатываем задачу асинхронно, не блокируя очередь
      this.processTask(task)
        .then(() => {
          this.currentProcessing--;
          // Продолжаем обработку очереди
          if (this.queue.length > 0) {
            this.processQueue();
          } else {
            this.processing = false;
          }
        })
        .catch(error => {
          console.error(`❌ Ошибка пересчета статистики для ${task.playerId}:`, error);
          this.currentProcessing--;
          // Продолжаем обработку очереди даже при ошибке
          if (this.queue.length > 0) {
            this.processQueue();
          } else {
            this.processing = false;
          }
        });
    }

    if (this.currentProcessing === 0) {
      this.processing = false;
    }
  }

  /**
   * Обработать одну задачу
   * @private
   */
  async processTask(task) {
    const { playerId, tournamentDate } = task;
    const PlayerStatsCacheService = require('./PlayerStatsCacheService');
    const MetricRecordsService = require('./MetricRecordsService');
    const PlayerService = require('./PlayerService');
    const { buildPlayerStats } = require('../../stats');
    const TournamentService = require('./TournamentService');
    
    const queueLength = this.queue.length;
    console.log(`🔄 Пересчет статистики для ${playerId} (очередь: ${queueLength}, обрабатывается: ${this.currentProcessing}/${this.maxConcurrent})`);
    
    try {
      await PlayerStatsCacheService.recalculateAllPeriods(playerId, tournamentDate);
      
      // Обновляем рекорды для all_time
      try {
        const profile = await PlayerService.getPlayerProfile(playerId);
        if (profile) {
          const tournaments = await TournamentService.getAllTournaments();
          const tablesById = {};
          
          // Загружаем таблицы для всех турниров
          await Promise.all(
            tournaments.map(async (tournament) => {
              const tournamentId = tournament?.id || tournament?._id;
              if (!tournamentId) return;
              try {
                tablesById[tournamentId] = await TournamentService.getTournamentTable(tournamentId);
              } catch (err) {
                tablesById[tournamentId] = null;
              }
            })
          );
          
          const pubgNick = profile.pubgNick || profile.username || playerId;
          const stats = buildPlayerStats(
            pubgNick,
            { profile, tournaments, tablesById },
            { scope: 'all_time', includeLive: false, modeFilter: 'all' }
          );
          
          await MetricRecordsService.updateAllRecordsForPlayer(playerId, stats, 'all_time');
        }
      } catch (error) {
        console.error(`⚠️ Ошибка обновления рекордов для ${playerId}:`, error.message);
        // Не прерываем выполнение, это не критично
      }
      
      console.log(`✅ Пересчет завершен для ${playerId} (осталось в очереди: ${this.queue.length})`);
    } catch (error) {
      console.error(`❌ Ошибка пересчета для ${playerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Получить статус очереди
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      currentProcessing: this.currentProcessing,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Очистить очередь
   */
  clear() {
    this.queue = [];
  }
}

// Экспортируем singleton
module.exports = new StatsRecalculationQueue();
