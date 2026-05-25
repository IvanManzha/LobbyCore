// src/backend/controllers/TournamentController.js
const TournamentService = require('../services/TournamentService');
const { filterTournaments } = require('../../shared/testDataFilters');
const FinanceService = require('../services/FinanceService');
const LadderService = require('../services/LadderService');
const PlayerService = require('../services/PlayerService');
const { db } = require('../../../lib/db');

const defaultAdmin = 'ivanchk';
const getAdminUsers = () =>
  (process.env.ADMIN_USERS || defaultAdmin)
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

/**
 * Enrich each team in table.teams with ladder_rank_label, dominant_trait,
 * rating_value (текущий числовой Ladder) и rating_delta (из истории по этому турниру).
 */
async function enrichTableTeamsWithLadderAndArchetype(table, seasonId, tournamentMeta = null) {
  if (!table?.teams?.length) return;
  const tournamentId = table.tournament?.id || tournamentMeta?.id || null;
  for (const team of table.teams) {
    const mainPlayerId = (team.players && team.players[0]) || team.name;
    if (!mainPlayerId) continue;
    const normalized = PlayerService.normalizeUsername(mainPlayerId);
    if (!normalized) continue;
    try {
      const ladder = await LadderService.getLadderForPlayer(normalized, seasonId);
      if (ladder) {
        team.ladder_rank_label = ladder.ladder_rank_label ?? null;
      }

      const members = Array.isArray(team.players) && team.players.length > 0 ? team.players : [mainPlayerId];
      let ratingValue = 0;
      let ratingDelta = 0;
      let hasAnyRating = false;
      let hasAnyDelta = false;
      for (const member of members) {
        const pid = PlayerService.normalizeUsername(member);
        if (!pid) continue;
        const current = await LadderService.getLadderForPlayer(pid, seasonId);
        if (current && current.ladder_rating != null) {
          ratingValue += Number(current.ladder_rating) || 0;
          hasAnyRating = true;
        }
        if (tournamentId) {
          const h = await db('player_ladder_history')
            .whereRaw('LOWER(player_id) = ?', [pid])
            .where('season_id', seasonId)
            .where('tournament_id', tournamentId)
            .first('delta');
          if (h && h.delta != null) {
            ratingDelta += Number(h.delta) || 0;
            hasAnyDelta = true;
          }
        }
      }
      team.rating_value = hasAnyRating ? Math.round(ratingValue) : null;
      team.rating_delta = hasAnyDelta ? Math.round(ratingDelta * 10) / 10 : null;

      // Используем ту же логику, что и в PlayerController (DNA Lab/profile),
      // чтобы архетип в турнирной таблице совпадал с профилем игрока.
      let profile = await PlayerService.getPlayerProfile(normalized);
      if (!profile) {
        const byPubg = await PlayerService.findPlayerByPubgNick(mainPlayerId);
        profile = byPubg?.profile || null;
      }
      if (profile) {
        await PlayerService.enrichWithDnaArchetypeFromLab(profile);
        if (profile.dominant_trait != null) team.dominant_trait = profile.dominant_trait;
        if (profile.dnaTier != null) {
          team.dna_tier = profile.dnaTier;
        } else if (profile.dna_rating != null) {
          const dnaEngine = require('../services/dna/dnaEngine');
          team.dna_tier = dnaEngine.computeDnaTier(profile.dna_rating);
        }
      } else {
        // Фолбэк, если профиль отсутствует в players/*.json.
        const row = await db('player_profiles')
          .whereRaw('LOWER(player_id) = ?', [normalized])
          .first('dominant_trait', 'dna_rating');
        if (row?.dominant_trait) team.dominant_trait = row.dominant_trait;
        if (row?.dna_rating != null) {
          const dnaEngine = require('../services/dna/dnaEngine');
          team.dna_tier = dnaEngine.computeDnaTier(row.dna_rating);
        }
      }
    } catch (_) {
      team.ladder_rank_label = team.ladder_rank_label ?? null;
      team.dominant_trait = team.dominant_trait ?? null;
      team.dna_tier = team.dna_tier ?? null;
      team.rating_value = team.rating_value ?? null;
      team.rating_delta = team.rating_delta ?? null;
    }
  }
}

class TournamentController {
  /**
   * GET /api/v1/tournaments
   * Получить список всех турниров.
   * Для завершённых турниров без registration подставляем участников из table.json,
   * чтобы фильтр «Мои» на фронте показывал турниры, в которых участвовал игрок.
   */
  async getAllTournaments(req, res) {
    try {
      const tournaments = await TournamentService.getAllTournaments();
      const isDone = (t) => t.state === 'Турнир окончен' || t.state === 'DONE';
      for (const t of tournaments) {
        if (isDone(t) && (!t.registration?.entries || t.registration.entries.length === 0)) {
          try {
            const table = await TournamentService.getTournamentTable(t.id);
            if (table?.teams?.length) {
              t.registration = t.registration || {};
              t.registration.entries = table.teams.map((team) => {
                const players = team.players || (team.name ? [team.name] : []);
                if (players.length <= 1) {
                  return { kind: 'solo', playerId: players[0] || team.name };
                }
                return { kind: 'team', name: team.name, members: players, captainId: players[0] };
              });
            }
          } catch (_) { /* ignore */ }
        }
      }
      const includeTest = req.query.includeTest === '1' || req.query.includeTest === 'true';
      res.json(includeTest ? tournaments : filterTournaments(tournaments));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/tournaments/:id
   * Получить турнир по ID
   */
  async getTournamentById(req, res) {
    try {
      const { id } = req.params;
      let tournament = await TournamentService.getTournamentById(id);

      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      tournament = FinanceService.enrichTournamentWithPayoutSummary(tournament);

      res.json(tournament);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/tournaments/:id/table
   * Получить таблицу турнира. Для турнира на регистрации (REG) подставляем
   * команды/игроков из registration.entries, чтобы они отображались в таблице и вкладке «Игроки».
   */
  async getTournamentTable(req, res) {
    try {
      const { id } = req.params;
      const table = await TournamentService.getTournamentTable(id);
      const tournament = await TournamentService.getTournamentById(id);
      const state = tournament?.state || '';
      const isReg = state !== 'В процессе' && state !== 'Турнир окончен' && state !== 'DONE';
      if (tournament && isReg) {
        const allEntries = tournament.registration?.entries || [];
        const entries = allEntries;
        if (entries.length > 0) {
          table.teams = await Promise.all(entries.map(async (e, i) => {
            let players;
            let name;
            if (e.kind === 'solo') {
              name = e.playerId;
              players = [e.playerId];
            } else {
              players = Array.isArray(e.members) && e.members.length > 0
                ? e.members
                : (e.captainId ? [e.captainId] : []);
              name = (e.name || '').trim() || `Команда ${i + 1}`;
            }
            const budget = await TournamentService.calculateBudgets(players).catch(() => players.map(() => 1));
            const totalRating = budget.reduce((a, b) => a + b, 0);
            return {
              name,
              players,
              results: [],
              totalPoints: 0,
              rank: i + 1,
              budget,
              totalRating
            };
          }));
        }
      }
      if (tournament) {
        require('ts-node/register');
        const { buildTournamentLeaderboard } = require('../../stats');
        table.leaderboard = buildTournamentLeaderboard(tournament, table);
      }
      const seasonId = (tournament?.date && String(tournament.date).substring(0, 4)) || String(new Date().getFullYear());
      await enrichTableTeamsWithLadderAndArchetype(table, seasonId, tournament);
      res.json(table);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/tournaments/active
   * Получить релевантный турнир для дашборда (LIVE → REG → последний DONE)
   */
  async getActiveTournament(req, res) {
    try {
      const tournament = await TournamentService.getRelevantTournament();

      if (!tournament) {
        return res.status(404).json({ error: 'No active tournament' });
      }

      const table = await TournamentService.getTournamentTable(tournament.id);
      // Фронт определяет статус (REG/LIVE/DONE) по table.tournament.state — подмешиваем актуальный турнир
      table.tournament = { ...table.tournament, ...tournament, id: table.tournament.id || tournament.id };
      require('ts-node/register');
      const { buildTournamentLeaderboard } = require('../../stats');
      table.leaderboard = buildTournamentLeaderboard(tournament, table);
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/teams
   * Добавить команду в турнир
   */
  async addTeam(req, res) {
    try {
      const { id } = req.params;
      const { name, players, isSolo } = req.body;

      // Валидация
      if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      if (!isSolo && (!players || !Array.isArray(players) || players.length < 2)) {
        return res.status(400).json({
          error: 'Team must have at least 2 players'
        });
      }

      const teamData = {
        name,
        players: isSolo ? [name] : players,
        isSolo: !!isSolo
      };

      const team = await TournamentService.addTeamToTournament(id, teamData);
      res.status(201).json({ success: true, team });
    } catch (error) {
      const payload = { error: error.message };
      if (error.code) payload.code = error.code;
      if (error.teamPower != null) payload.teamPower = error.teamPower;
      if (error.cap != null) payload.cap = error.cap;
      res.status(400).json(payload);
    }
  }

  /**
   * POST /api/v1/tournaments
   * Создать новый турнир
   */
  async createTournament(req, res) {
    try {
      const tournament = await TournamentService.createTournament(req.body);
      res.status(201).json({ success: true, tournament });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PUT /api/v1/tournaments/:id
   * Обновить турнир (те же поля, что при создании)
   */
  async updateTournament(req, res) {
    try {
      const { id } = req.params;
      const tournament = await TournamentService.updateTournamentById(id, req.body);
      res.json({ success: true, tournament });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/start
   * Начать турнир
   */
  async startTournament(req, res) {
    try {
      const { id } = req.params;
      const tournament = await TournamentService.startTournament(id);

      res.json({ success: true, tournament });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/add-round
   * Добавить +1 раунд к турниру
   */
  async addRound(req, res) {
    try {
      const { id } = req.params;
      const tournament = await TournamentService.addRound(id);
      res.json({ success: true, tournament });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/close
   * Закрыть турнир
   */
  async closeTournament(req, res) {
    try {
      const { id } = req.params;
      const tournament = await TournamentService.closeTournament(id);
      // История и DNA запускаются асинхронно внутри closeTournament

      // Возвращаем ответ сразу, не ждем завершения пересчета
      res.json({ 
        success: true, 
        tournament,
        message: 'Tournament closed. Statistics recalculation started in background.'
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/leaderboard/recalculate
   * Пересчитать лидерборд
   */
  async recalculateLeaderboard(req, res) {
    try {
      const { id } = req.params;
      const teams = await TournamentService.recalculateLeaderboard(id);
      res.json({ success: true, teams });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/register
   * Регистрация на турнир (solo, team или free_agent)
   */
  async register(req, res) {
    try {
      const { id } = req.params;
      const playerId = req.user?.pubgNick || req.user?.username;
      if (!playerId) {
        return res.status(401).json({ error: 'Авторизация требуется' });
      }
      const tournament = await TournamentService.getTournamentById(id);
      if (!tournament) {
        return res.status(404).json({ error: 'Турнир не найден' });
      }
      const entryFeeDC = tournament.finance?.entryFeeDC ?? tournament.extra?.finance?.entryFeeDC ?? 0;
      if (entryFeeDC > 0) {
        const wallet = FinanceService.getWallet(playerId);
        const required = entryFeeDC;
        if (wallet.availableDC < required) {
          return res.status(400).json({
            error: `Недостаточно DC для регистрации. Нужно ${required} DC. Пополните баланс в разделе Финансы.`
          });
        }
      }
      const { kind, teamName, members } = req.body;
      const result = await TournamentService.register(id, playerId, { kind, teamName, members });
      res.json({ ok: true, entry: result.entry, tournament: result.tournament });
    } catch (error) {
      const status = error.message.includes('не найден') ? 404 : 400;
      const payload = { error: error.message };
      if (error.code) payload.code = error.code;
      if (error.teamPower != null) payload.teamPower = error.teamPower;
      if (error.cap != null) payload.cap = error.cap;
      res.status(status).json(payload);
    }
  }

  /**
   * DELETE /api/v1/tournaments/:id/teams/:teamName
   * Удалить команду (отменить регистрацию). Доступно капитану команды или админу. При LIVE/DONE — только админ.
   */
  async removeTeam(req, res) {
    try {
      const { id, teamName } = req.params;
      const playerId = (req.user?.pubgNick || req.user?.username || '').toLowerCase();
      const defaultAdmin = 'ivanchk';
      const adminUsers = (process.env.ADMIN_USERS || defaultAdmin)
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);
      const isAdmin = adminUsers.includes(playerId);
      if (!req.user?.pubgNick && !req.user?.username) {
        return res.status(401).json({ error: 'Авторизация требуется' });
      }
      const tournament = await TournamentService.getTournamentById(id);
      if (!tournament) {
        return res.status(404).json({ error: 'Турнир не найден' });
      }
      const state = tournament.state || '';
      const isLiveOrDone = state === 'В процессе' || state === 'Турнир окончен';
      const entries = tournament.registration?.entries || [];
      const decodedTeamName = decodeURIComponent(teamName || '').trim();
      const entry = entries.find((e) => {
        const name = e.kind === 'team' ? (e.name || '').trim() : (e.playerId || '').trim();
        return name === decodedTeamName;
      });
      const currentUserId = (req.user?.pubgNick || req.user?.username || '').toLowerCase();
      let isCaptain = false;
      if (entry) {
        isCaptain = entry.kind === 'solo'
          ? (entry.playerId || '').toLowerCase() === currentUserId
          : (entry.captainId || '').toLowerCase() === currentUserId;
      }
      if (!isCaptain && !entry) {
        const table = await TournamentService.getTournamentTable(id);
        const team = (table.teams || []).find((t) => (t.name || '').trim() === decodedTeamName);
        const firstPlayer = (team?.players && team.players[0]) ? String(team.players[0]).trim().toLowerCase() : '';
        isCaptain = firstPlayer === currentUserId;
      }
      if (!isAdmin && !isCaptain) {
        return res.status(403).json({ error: 'Только капитан команды или администратор может отменить регистрацию' });
      }
      const allowAdmin = isLiveOrDone && isAdmin;
      await TournamentService.removeTeam(id, decodedTeamName, { allowAdmin });
      const updated = await TournamentService.getTournamentById(id);
      const table = await TournamentService.getTournamentTable(id);
      res.json({ ok: true, tournament: updated, table });
    } catch (error) {
      const status = error.message.includes('не найден') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/cancel
   * Отменить турнир (только админ). Возврат всех взносов участникам, состояние «Турнир отменен».
   */
  async cancelTournament(req, res) {
    try {
      const { id } = req.params;
      const playerId = (req.user?.pubgNick || req.user?.username || '').toLowerCase();
      if (!playerId) {
        return res.status(401).json({ error: 'Авторизация требуется' });
      }
      const adminUsers = getAdminUsers();
      if (!adminUsers.includes(playerId)) {
        return res.status(403).json({ error: 'Только администратор может отменить турнир' });
      }
      const result = await FinanceService.refundTournamentCancellation(id, TournamentService);
      const tournament = await TournamentService.getTournamentById(id);
      res.json({ ok: true, tournament, refunded: result.refunded });
    } catch (error) {
      const status = error.message.includes('не найден') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/v1/tournaments/:id
   * Удалить турнир (только разработчик, под флагом). Сначала рефанд по формуле, затем удаление из БД.
   */
  async deleteTournament(req, res) {
    try {
      const { id } = req.params;
      const tournament = await TournamentService.getTournamentById(id);
      if (!tournament) {
        return res.status(404).json({ error: 'Турнир не найден' });
      }
      const state = tournament.state || '';
      if (state === 'В процессе' || state === 'Турнир окончен' || state === 'DONE') {
        return res.status(400).json({ error: 'Нельзя удалить турнир в процессе или завершённый' });
      }
      await FinanceService.refundTournamentCancellation(id, TournamentService);
      await TournamentService.deleteTournament(id);
      res.json({ ok: true });
    } catch (error) {
      const status = error.message.includes('не найден') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/tournaments/:id/withdraw-free-agent
   * Выход из пула свободных агентов
   */
  async withdrawFreeAgent(req, res) {
    try {
      const { id } = req.params;
      const playerId = req.user?.pubgNick || req.user?.username;
      if (!playerId) {
        return res.status(401).json({ error: 'Авторизация требуется' });
      }
      const tournament = await TournamentService.withdrawFreeAgent(id, playerId);
      res.json({ ok: true, tournament });
    } catch (error) {
      const status = error.message.includes('не найден') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }
}

module.exports = new TournamentController();

