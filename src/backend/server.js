// src/backend/server.js
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET обязателен при NODE_ENV=production');
    process.exit(1);
  }
  if (!process.env.CORS_ORIGIN) {
    console.warn('WARN: CORS_ORIGIN не задан — разрешены только same-origin запросы без заголовка Origin');
  }
}

try {
  require('ts-node/register');
} catch (err) {
  console.warn('ts-node не установлен, TS-модули могут не загрузиться:', err.message);
}
const express = require('express');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');
const MatchMonitorService = require('./services/MatchMonitorService');

const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (для мобильного приложения)
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Статические файлы (старый фронтенд)
app.use(express.static(path.join(__dirname, '../../../public')));
app.use('/players', express.static(path.join(__dirname, '../../../data/players')));

// SSE для real-time обновлений (старый API)
const clients = new Set();
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

function broadcastUpdate(tournamentId) {
  const msg = `event: table-updated\ndata: ${tournamentId}\n\n`;
  for (const client of clients) {
    client.write(msg);
  }
}

// Экспортируем для использования в других модулях
module.exports.broadcastUpdate = broadcastUpdate;

// Steam auth (до /api/v1)
const steamRoutes = require('./auth/steam/steamRoutes');
app.use('/auth/steam', steamRoutes);

// Новый REST API
app.use('/api/v1', apiRoutes);

// Старые API endpoints (для обратной совместимости)
app.get('/api/table', async (req, res) => {
  try {
    const TournamentService = require('./services/TournamentService');
    const tournament = await TournamentService.getActiveTournament();
    if (!tournament) {
      return res.status(404).json({ error: 'Нет турнира в процессе' });
    }
    const table = await TournamentService.getTournamentTable(tournament.id);
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments', async (req, res) => {
  try {
    const TournamentService = require('./services/TournamentService');
    const tournaments = await TournamentService.getAllTournaments();
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournaments/:id/table', async (req, res) => {
  try {
    const TournamentService = require('./services/TournamentService');
    const table = await TournamentService.getTournamentTable(req.params.id);
    res.json(table);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Обработка ошибок
app.use(errorHandler);

// Запуск сервера
if (require.main === module && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api/v1`);

    MatchMonitorService.syncWithActiveTournaments()
      .then(({ liveCount, isRunning }) => {
        if (isRunning) {
          console.log(`🔍 MatchMonitor запущен (${liveCount} турнир(ов) «В процессе»)`);
        } else {
          console.log(
            'ℹ️  MatchMonitor выключен: нет турниров «В процессе» (включится при старте турнира)'
          );
        }
      })
      .catch((err) => {
        console.error('⚠️  MatchMonitor sync при старте сервера:', err.message);
      });
  });
}

// Экспорт для тестирования
module.exports = app;

