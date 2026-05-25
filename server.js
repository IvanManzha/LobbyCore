require('dotenv').config();
const express = require('express');
const fs   = require('fs');
const path = require('path');

// Импортируем сервисы
const TournamentService = require('./src/backend/services/TournamentService');
const PlayerService = require('./src/backend/services/PlayerService');

const app = express();
const PORT = process.env.PORT || 3100;

// Разбор JSON-тела
app.use(express.json());

const clients = new Set();

// SSE: подписка на изменения таблицы
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

// Статика
app.use(express.static('public'));
app.use('/players', express.static(path.join(__dirname, 'data', 'players')));

// 1) «Активный» (tournament.state === 'В процессе') турнир
app.get('/api/table', async (req, res) => {
  try {
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

// 2) Список всех турниров
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await TournamentService.getAllTournaments();
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3) Таблица конкретного турнира
app.get('/api/tournaments/:id/table', async (req, res) => {
  try {
    const table = await TournamentService.getTournamentTable(req.params.id);
    res.json(table);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 4) Регистрация solo/duo/squad
app.post('/api/register', async (req, res) => {
  try {
  const { tournamentId, playerName } = req.body;
  if (!tournamentId || !playerName) {
    return res.status(400).json({ error: 'tournamentId и playerName обязательны' });
  }

    const teamData = {
      name: playerName,
      players: [playerName],
      isSolo: true
    };

    const team = await TournamentService.addTeamToTournament(tournamentId, teamData);
    res.json({ 
      success: true, 
      message: `Solo: added "${playerName}" with rank ${team.rank}.` 
    });
    broadcastUpdate(tournamentId);
  } catch (error) {
    console.error('Ошибка addTeam:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5) Регистрация команд для mixed
app.post('/api/register-team', async (req, res) => {
  try {
  const { tournamentId, teamName, players } = req.body;
  if (!tournamentId || !teamName || !players) {
    return res.status(400).json({ error: 'tournamentId, teamName и players обязательны' });
  }

  const safeName = teamName.split(/\s+/).join('_');
    const playersArray = typeof players === 'string' 
      ? players.split(',').map(p => p.trim()).filter(Boolean)
      : players;

    if (!Array.isArray(playersArray) || playersArray.length < 2) {
      return res.status(400).json({ error: 'Team must have at least 2 players' });
    }

    const teamData = {
      name: safeName,
      players: playersArray,
      isSolo: false
    };

    const team = await TournamentService.addTeamToTournament(tournamentId, teamData);
    res.json({ 
      success: true, 
      message: `Team "${safeName}" added with rank ${team.rank}.` 
    });
    broadcastUpdate(tournamentId);
  } catch (error) {
    console.error('Ошибка addTeam (mixed):', error);
    res.status(500).json({ error: error.message });
  }
});

// 6) Логин по нику
app.post('/api/auth/login', async (req, res) => {
  try {
  const { pubgId } = req.body;
    if (!pubgId) {
      return res.status(400).json({ error: 'PUBG-ник обязателен' });
    }

    const profile = await PlayerService.getOrCreatePlayerProfile(pubgId);
    res.json({ profile });
  } catch (error) {
    console.error('Ошибка login:', error);
    res.status(500).json({ error: error.message });
  }
});

// === Новый маршрут: регистрация игрока ===
app.post('/api/auth/register', async (req, res) => {
  try {
  const { pubgId } = req.body;
  if (!pubgId) {
    return res.status(400).json({ error: 'PUBG-ник обязателен для регистрации' });
  }

    // Проверяем, существует ли профиль
    const existingProfile = await PlayerService.getPlayerProfile(pubgId);
    if (existingProfile) {
    return res.json({
      success: true,
      message: `Игрок "${pubgId}" уже зарегистрирован`
    });
  }

    // Создаём новый профиль
    const profile = await PlayerService.createPlayerProfile(pubgId);
    res.json({ 
      success: true, 
      message: `✅ Создан файл игрока: ${pubgId}.json` 
    });
  } catch (error) {
    console.error('Ошибка register:', error);
    res.status(500).json({ error: error.message });
    }
});

// =========================================

// 7) update-result
app.post('/api/update-result', async (req, res) => {
  try {
  const { tournamentId, match, placement, kills, teamName } = req.body;
  if (!tournamentId || match == null || placement == null || kills == null || !teamName) {
    return res.status(400).json({ error: 'Неполный набор параметров' });
  }

    await TournamentService.updateMatchResult(tournamentId, {
      match: Number(match),
      teamName,
      placement: Number(placement),
      kills: Number(kills)
    });

    res.json({ success: true });
    broadcastUpdate(tournamentId);
  } catch (error) {
    console.error('updateResult error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8) update-player-kills
app.post('/api/update-player-kills', async (req, res) => {
  try {
  const { tournamentId, teamName, playerName, match, kills } = req.body;
  if (!tournamentId || !teamName || !playerName || match == null || kills == null) {
    return res.status(400).json({ error: 'Неполный набор параметров' });
  }

    await TournamentService.updatePlayerKills(
      tournamentId,
      teamName,
      playerName,
      Number(match),
      Number(kills)
    );

    res.json({ success: true });
    broadcastUpdate(tournamentId);
  } catch (error) {
    console.error('updatePlayerKills error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9) calc-leaderboard
app.post('/api/calc-leaderboard', async (req, res) => {
  try {
  const { tournamentId } = req.body;
    if (!tournamentId) {
      return res.status(400).json({ error: 'tournamentId обязателен' });
    }

    await TournamentService.recalculateLeaderboard(tournamentId);
    res.json({ success: true });
    broadcastUpdate(tournamentId);
  } catch (error) {
    console.error('calcLeaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10) Список всех игроков
app.get('/api/players', async (req, res) => {
  try {
    const players = await PlayerService.getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error('Error reading players:', error);
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
