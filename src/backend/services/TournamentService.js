// src/backend/services/TournamentService.js
const path = require('path');
const fs = require('fs');
const { playersDir } = require('../config/dataPaths');
const repo = require('../repositories/TournamentRepository');
const { filterTournaments } = require('../../shared/testDataFilters');
const TeamPowerCapService = require('./TeamPowerCapService');

class TournamentService {
  /**
   * Единый дедлайн регистрации: startAt → startedAt → date.
   */
  getRegistrationDeadlineIso(tournament) {
    if (!tournament) return null;
    return tournament.startAt || tournament.startedAt || tournament.date || null;
  }

  /**
   * Получить все турниры
   */
  async getAllTournaments() {
    try {
      return await repo.getAll();
    } catch (error) {
      console.error('Ошибка чтения турниров из БД:', error);
      return [];
    }
  }

  /**
   * Получить турнир по ID
   */
  async getTournamentById(tournamentId) {
    return await repo.getById(tournamentId);
  }

  /**
   * Получить активный турнир (только LIVE)
   */
  async getActiveTournament() {
    const tournaments = filterTournaments(await this.getAllTournaments());
    return tournaments.find(t => t.state === 'В процессе');
  }

  /**
   * Получить релевантный турнир для дашборда строго по статусу:
   * 1) LIVE («В процессе») — если есть, его и показываем
   * 2) REG (не LIVE и не DONE) — ближайший по дате: уже начавшийся (дата наступила) или следующий будущий
   * 3) последний DONE — только если нет ни LIVE, ни REG
   */
  async getRelevantTournament() {
    const tournaments = filterTournaments(await this.getAllTournaments());
    if (!tournaments.length) return null;

    const live = tournaments.find(t => t.state === 'В процессе');
    if (live) return live;

    const regList = tournaments
      .filter(t => t.state !== 'В процессе' && t.state !== 'Турнир окончен' && t.state !== 'DONE')
      .map(t => ({ ...t, start: t.date ? new Date(t.date) : null }))
      .filter(t => t.start && !isNaN(t.start.getTime()))
      .sort((a, b) => a.start - b.start);

    if (regList.length) {
      const now = new Date();
      const upcoming = regList.find(t => t.start >= now);
      if (upcoming) return upcoming;
      const lastReg = regList[regList.length - 1];
      return lastReg;
    }

    const done = tournaments
      .filter(t => t.state === 'Турнир окончен' || t.state === 'DONE')
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
    if (done) return done;

    return tournaments[0];
  }

  /**
   * Нормализация team-entry: гарантирует memberPayments и при необходимости allPaidAt.
   */
  normalizeTeamEntry(entry) {
    if (!entry || entry.kind !== 'team') return entry;
    const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object'
      ? entry.memberPayments
      : {};
    return { ...entry, memberPayments };
  }

  /**
   * Для team-entry по entryFeeDC возвращает { totalMembers, paidMembers }.
   */
  getEntryPaymentStats(entry, entryFeeDC) {
    if (!entry || entry.kind !== 'team') return null;
    const members = entry.members || (entry.captainId ? [entry.captainId] : []);
    const totalMembers = members.length || 1;
    const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object'
      ? entry.memberPayments
      : {};
    const paidMembers = members.filter((pid) => (memberPayments[pid] || 0) >= (entryFeeDC || 0)).length;
    return { totalMembers, paidMembers };
  }

  /**
   * Правила регистрации: из tournament.rules.registration или по type
   */
  getRegistrationRules(tournament) {
    if (!tournament) return { enabled: false, allowSolo: false, allowTeams: false, allowFreeAgents: false };
    const r = tournament.rules?.registration;
    const type = (tournament.type || '').toLowerCase();
    const defaultFreeAgents = type === 'solo' ? false : ['duo', 'squad', 'mixed'].includes(type);
    if (r && typeof r.enabled === 'boolean') {
      return {
        enabled: r.enabled,
        allowSolo: !!r.allowSolo,
        allowTeams: !!r.allowTeams,
        allowFreeAgents: typeof r.allowFreeAgents === 'boolean' ? r.allowFreeAgents : defaultFreeAgents
      };
    }
    if (type === 'solo') {
      return { enabled: true, allowSolo: true, allowTeams: false, allowFreeAgents: false };
    }
    if (['duo', 'squad', 'mixed'].includes(type)) {
      return { enabled: true, allowSolo: false, allowTeams: true, allowFreeAgents: true };
    }
    return { enabled: true, allowSolo: false, allowTeams: true, allowFreeAgents: defaultFreeAgents };
  }

  /**
   * Обновить турнир в списке (по id)
   */
  async updateTournament(tournamentId, updater) {
    const tournament = await repo.getById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }
    updater(tournament);
    await repo.update(tournamentId, tournament);
    return await repo.getById(tournamentId);
  }

  /**
   * Валидация размера команды по типу турнира. Возвращает { min, max } или null для solo.
   */
  getTeamSizeLimits(tournamentType) {
    const type = (tournamentType || '').toLowerCase();
    if (type === 'solo') return null;
    if (type === 'duo') return { min: 2, max: 2 };
    if (type === 'trio') return { min: 3, max: 3 };
    if (type === 'squad') return { min: 4, max: 4 };
    if (type === 'mixed') return { min: 1, max: 4 };
    return { min: 1, max: 4 };
  }

  /**
   * Регистрация на турнир (solo, team или free_agent)
   * Для team опционально передаётся members — массив playerId (включая капитана).
   */
  async register(tournamentId, playerId, { kind, teamName, members: membersInput }) {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Турнир не найден');
    }

    const rules = this.getRegistrationRules(tournament);
    if (!rules.enabled) {
      throw new Error('Регистрация отключена');
    }

    const state = tournament.state || '';
    if (state === 'Турнир окончен' || state === 'DONE') {
      throw new Error('Регистрация закрыта');
    }
    const startDate = this.getRegistrationDeadlineIso(tournament);
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime()) && new Date() >= start) {
        throw new Error('Регистрация закрыта');
      }
    }

    const entries = tournament.registration?.entries || [];
    const freeAgents = tournament.registration?.freeAgents || [];

    const isPlayerInEntry = (entry) => {
      if (entry.kind === 'solo') return entry.playerId === playerId;
      return entry.captainId === playerId || (entry.members && entry.members.includes(playerId));
    };

    if (kind === 'free_agent') {
      if (!rules.allowFreeAgents) {
        throw new Error('Регистрация свободным агентом недоступна');
      }
      const existingEntry = entries.find(isPlayerInEntry);
      if (existingEntry) {
        if (existingEntry.kind === 'team') {
          throw new Error(`Вы уже в команде ${existingEntry.name || ''}`);
        }
        throw new Error('Вы уже зарегистрированы');
      }
      const alreadyInPool = freeAgents.some(
        (fa) => fa.playerId === playerId && fa.status !== 'withdrawn'
      );
      if (alreadyInPool) {
        throw new Error('Вы уже в пуле свободных агентов');
      }
      const createdAt = new Date().toISOString();
      const newFreeAgents = [...freeAgents, { playerId, createdAt, status: 'active' }];
      await this.updateTournament(tournamentId, (t) => {
        t.registration = t.registration || {};
        t.registration.entries = t.registration.entries || [];
        t.registration.freeAgents = newFreeAgents;
      });
      const updated = await this.getTournamentById(tournamentId);
      return { entry: null, tournament: updated };
    }

    if (kind === 'solo' && !rules.allowSolo) {
      throw new Error('Регистрация соло недоступна');
    }
    if (kind === 'team' && !rules.allowTeams) {
      throw new Error('Регистрация команд недоступна');
    }

    const existing = entries.find(isPlayerInEntry);
    if (existing) {
      if (existing.kind === 'team') {
        throw new Error(`Вы уже в команде ${existing.name || ''}`);
      }
      throw new Error('Вы уже зарегистрированы');
    }

    let finalMembers = [playerId];
    if (kind === 'team') {
      const name = (teamName || '').trim();
      if (name.length < 2 || name.length > 24) {
        throw new Error('Название команды: от 2 до 24 символов');
      }
      if (entries.some(e => e.kind === 'team' && e.name === name)) {
        throw new Error(`Команда «${name}» уже зарегистрирована`);
      }
      const limits = this.getTeamSizeLimits(tournament.type);
      if (limits && Array.isArray(membersInput) && membersInput.length > 0) {
        const unique = [...new Set(membersInput.map((id) => String(id).trim()).filter(Boolean))];
        if (!unique.includes(playerId)) {
          throw new Error('Капитан должен входить в состав команды');
        }
        if (unique.length < limits.min || unique.length > limits.max) {
          throw new Error(`Для формата ${tournament.type || 'team'} в команде должно быть от ${limits.min} до ${limits.max} игроков (включая вас)`);
        }
        finalMembers = unique;
      } else if (limits && (limits.min > 1 || limits.max < 1)) {
        throw new Error(`Для формата ${tournament.type || 'team'} в команде должно быть от ${limits.min} до ${limits.max} игроков`);
      }

      const teamPowerResult = await TeamPowerCapService.validateTeamPower(finalMembers, tournament);
      if (!teamPowerResult.allowed) {
        const err = new Error(
          teamPowerResult.code === 'ELITE_LIMIT_EXCEEDED'
            ? 'В составе слишком много игроков элитного уровня'
            : teamPowerResult.code === 'TEAM_POWER_EXCEEDED_MANUAL'
              ? 'Суммарная сила состава превышает установленный лимит турнира'
              : 'Суммарная сила состава превышает допустимый лимит турнира'
        );
        err.code = teamPowerResult.code;
        err.teamPower = teamPowerResult.teamPower;
        err.cap = teamPowerResult.cap;
        throw err;
      }
    }

    const createdAt = new Date().toISOString();
    let entry;

    if (kind === 'solo') {
      entry = {
        kind: 'solo',
        playerId,
        createdAt,
        status: 'confirmed'
      };
    } else {
      const teamNameTrimmed = (teamName || '').trim();
      const slug = teamNameTrimmed.replace(/[^a-z0-9]/gi, '_').slice(0, 20);
      const teamId = `${tournamentId}_${slug}_${Date.now()}`;
      entry = {
        kind: 'team',
        teamId,
        name: teamNameTrimmed,
        captainId: playerId,
        members: finalMembers,
        memberPayments: {},
        createdAt,
        status: 'confirmed'
      };
    }

    await this.updateTournament(tournamentId, (t) => {
      t.registration = t.registration || {};
      t.registration.entries = [...(t.registration.entries || []), entry];
      if (!t.registration.freeAgents && freeAgents.length > 0) {
        t.registration.freeAgents = freeAgents;
      }
    });

    const updated = await this.getTournamentById(tournamentId);
    return { entry, tournament: updated };
  }

  /**
   * Нормализация имени команды/игрока для сравнения
   */
  _normalizeName(s) {
    if (s == null) return '';
    return String(s).trim();
  }

  /**
   * Удалить команду из турнира (отменить регистрацию команды)
   * Удаляет из tournament.registration.entries (при REG) и из table.teams (БД).
   * В REG команды могут быть только в entries — ищем в обоих местах.
   */
  async removeTeam(tournamentId, teamName, options = {}) {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Турнир не найден');
    }
    const state = tournament.state || '';
    const isLiveOrDone = state === 'В процессе' || state === 'Турнир окончен';
    if (isLiveOrDone && !options.allowAdmin) {
      throw new Error('Нельзя удалить команду после начала турнира');
    }

    const normalized = this._normalizeName(teamName);
    const entries = tournament.registration?.entries || [];
    const entryIndex = entries.findIndex((e) => {
      const name = e.kind === 'team' ? this._normalizeName(e.name) : this._normalizeName(e.playerId);
      return name === normalized;
    });

    const table = await this.getTournamentTable(tournamentId);
    const teamIndex = table.teams.findIndex((t) => this._normalizeName(t.name) === normalized);

    if (teamIndex === -1 && entryIndex === -1) {
      throw new Error(`Команда «${teamName}» не найдена`);
    }

    const entry = entryIndex !== -1 ? entries[entryIndex] : null;
    if (entry && !options.skipRefund) {
      const FinanceService = require('./FinanceService');
      await FinanceService.refundEntryForRemoveTeam(tournamentId, entry, tournament, this);
    }

    if (teamIndex !== -1) {
      table.teams.splice(teamIndex, 1);
      await this.updateTournamentTable(tournamentId, table);
    }
    if (entryIndex !== -1) {
      entries.splice(entryIndex, 1);
      await this.updateTournament(tournamentId, (t) => {
        t.registration = t.registration || {};
        t.registration.entries = entries;
      });
    }

    return this.getTournamentById(tournamentId);
  }

  /**
   * Выход из пула свободных агентов
   */
  async withdrawFreeAgent(tournamentId, playerId) {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Турнир не найден');
    }
    const freeAgents = tournament.registration?.freeAgents || [];
    const hasActive = freeAgents.some(
      (fa) => fa.playerId === playerId && fa.status !== 'withdrawn'
    );
    if (!hasActive) {
      throw new Error('Вы не в пуле свободных агентов');
    }
    await this.updateTournament(tournamentId, (t) => {
      t.registration = t.registration || {};
      t.registration.freeAgents = t.registration.freeAgents || [];
      const fa = t.registration.freeAgents.find(
        (f) => f.playerId === playerId && f.status !== 'withdrawn'
      );
      if (fa) fa.status = 'withdrawn';
    });
    return this.getTournamentById(tournamentId);
  }

  /**
   * Получить таблицу турнира
   */
  async getTournamentTable(tournamentId) {
    const table = await repo.getTableByTournamentId(tournamentId);
    if (!table) {
      throw new Error(`Tournament table not found: ${tournamentId}`);
    }
    if (table.tournament && !table.tournament.id) {
      table.tournament.id = tournamentId;
    }
    return table;
  }

  /**
   * Обновить таблицу турнира
   */
  async updateTournamentTable(tournamentId, tableData) {
    await repo.saveTable(tournamentId, tableData);
  }

  /**
   * Добавить команду в турнир
   */
  async addTeamToTournament(tournamentId, teamData) {
    const table = await this.getTournamentTable(tournamentId);
    const tournament = await this.getTournamentById(tournamentId);

    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const rounds = table.tournament?.rounds || 0;
    const { name, players, isSolo } = teamData;

    // Проверка на дубликаты
    if (table.teams.some(t => t.name === name)) {
      throw new Error(`Team "${name}" already exists`);
    }

    // Создание команды
    const newTeam = {
      name,
      players: isSolo ? [name] : players,
      budget: isSolo ? [1] : await this.calculateBudgets(players),
      results: Array.from({ length: rounds }, () => ({ placement: null, kills: null })),
      playerKills: isSolo
        ? [{ kills: Array.from({ length: rounds }, () => null) }]
        : players.map(() => ({ kills: Array.from({ length: rounds }, () => null) })),
      playerDeaths: isSolo
        ? [{ deaths: Array.from({ length: rounds }, () => null) }]
        : players.map(() => ({ deaths: Array.from({ length: rounds }, () => null) })),
      totalPoints: 0,
      rank: table.teams.length + 1
    };

    const teamList = isSolo ? [name] : players;
    const teamPowerResult = await TeamPowerCapService.validateTeamPower(teamList, tournament);
    if (!teamPowerResult.allowed) {
      const err = new Error(
        teamPowerResult.code === 'ELITE_LIMIT_EXCEEDED'
          ? 'В составе слишком много игроков элитного уровня'
          : teamPowerResult.code === 'TEAM_POWER_EXCEEDED_MANUAL'
            ? 'Суммарная сила состава превышает установленный лимит турнира'
            : 'Суммарная сила состава превышает допустимый лимит турнира'
      );
      err.code = teamPowerResult.code;
      err.teamPower = teamPowerResult.teamPower;
      err.cap = teamPowerResult.cap;
      throw err;
    }

    table.teams.push(newTeam);
    await this.updateTournamentTable(tournamentId, table);

    return newTeam;
  }

  /**
   * Рассчитать бюджеты игроков
   */
  async calculateBudgets(playerNames) {
    const budgets = [];

    for (const nick of playerNames) {
      const profilePath = path.join(playersDir, `${nick}.json`);
      if (!fs.existsSync(profilePath)) {
        throw new Error(`Player profile not found: ${nick}`);
      }
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      const rating = (typeof profile.dna_rating === 'number' && profile.dna_rating > 0)
        ? profile.dna_rating
        : 1;
      budgets.push(rating);
    }

    return budgets;
  }

  /**
   * Создать новый турнир
   */
  async createTournament(tournamentData) {
    const generateId = (name) => {
      const translit = name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      const timestamp = Date.now().toString().slice(-6);
      return `${translit}_${timestamp}`;
    };

    const tournamentId = generateId(tournamentData.name);
    if (await repo.getById(tournamentId)) {
      throw new Error('Tournament with similar name already exists');
    }

    const startAt = tournamentData.startAt || null;
    const newTournament = {
      id: tournamentId,
      name: tournamentData.name,
      date: tournamentData.date,
      type: tournamentData.type,
      state: 'Запланирован',
      startAt: startAt || null,
      price: tournamentData.price || null,
      rounds: tournamentData.rounds || 5,
      playedRounds: 0,
      barrier: tournamentData.barrier || null,
      rules: tournamentData.rules || '',
      ...(tournamentData.finance != null && typeof tournamentData.finance === 'object' && { finance: tournamentData.finance }),
      ratingRules: { placement: {}, default: 0 },
      extra: {
        tournamentWeight: tournamentData.tournamentWeight != null ? Number(tournamentData.tournamentWeight) : 30,
        teamCapMode: tournamentData.teamCapMode === 'manual' ? 'manual' : 'auto',
        countInRating: tournamentData.countInRating !== false,
        // Для новых турниров: в таблице показываем рейтинг на момент турнира + дельту.
        ratingSnapshotMode: true
      }
    };

    const scoring = {
      placement: {},
      per_kill: tournamentData.perKill || 2
    };
    const defaultPlacements = {
      1: 25, 2: 20, 3: 17, 4: 15, 5: 13, 6: 11,
      7: 10, 8: 9, 9: 8, 10: 7, 11: 6, 12: 5
    };
    for (let i = 1; i <= 20; i++) {
      const placementKey = `placement${i}`;
      if (tournamentData[placementKey] != null && tournamentData[placementKey] !== '') {
        scoring.placement[i] = tournamentData[placementKey];
      } else if (defaultPlacements[i] != null) {
        scoring.placement[i] = defaultPlacements[i];
      }
    }

    await repo.create({ ...newTournament, scoring });
    await repo.saveTable(tournamentId, {
      tournament: { id: tournamentId, name: newTournament.name, type: newTournament.type, rounds: newTournament.rounds, scoring },
      teams: []
    });
    return newTournament;
  }

  /**
   * Обновить турнир по ID (поля как при создании; id и state не меняем)
   */
  async updateTournamentById(tournamentId, data) {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const startAt = data.startAt != null
      ? data.startAt
      : (data.date && data.startTime
        ? new Date(`${data.date}T${data.startTime}:00`).toISOString()
        : tournament.startAt);

    const previousType = tournament.type;
    tournament.name = (data.name || tournament.name || '').trim();
    tournament.date = data.date != null ? data.date : tournament.date;
    tournament.type = data.type || tournament.type;
    const typeChanged = data.type != null && data.type !== previousType;
    tournament.startAt = startAt;
    tournament.rounds = data.rounds != null ? Number(data.rounds) : tournament.rounds;
    tournament.price = data.price !== undefined && data.price !== '' ? Number(data.price) : tournament.price;
    tournament.barrier = data.barrier === '' || data.barrier === undefined ? (tournament.barrier ?? null) : Number(data.barrier);
    tournament.rules = data.rules !== undefined ? data.rules : tournament.rules;

    if (data.tournamentWeight != null) {
      tournament.extra = tournament.extra || {};
      tournament.extra.tournamentWeight = Number(data.tournamentWeight);
    }
    if (data.teamCapMode != null) {
      tournament.extra = tournament.extra || {};
      tournament.extra.teamCapMode = data.teamCapMode === 'manual' ? 'manual' : 'auto';
    }
    if (data.countInRating !== undefined) {
      tournament.extra = tournament.extra || {};
      tournament.extra.countInRating = data.countInRating !== false;
    }
    if (data.finance !== undefined) {
      tournament.finance = data.finance;
      tournament.extra = tournament.extra || {};
      tournament.extra.finance = data.finance;
    }

    const defaultPlacements = {
      1: 25, 2: 20, 3: 17, 4: 15, 5: 13, 6: 11,
      7: 10, 8: 9, 9: 8, 10: 7, 11: 6, 12: 5
    };
    const scoring = {
      placement: {},
      per_kill: data.perKill != null ? data.perKill : 2
    };
    for (let i = 1; i <= 20; i++) {
      const key = `placement${i}`;
      if (data[key] != null && data[key] !== '') {
        scoring.placement[i] = data[key];
      } else if (defaultPlacements[i] != null) {
        scoring.placement[i] = defaultPlacements[i];
      }
    }

    await repo.update(tournamentId, tournament);
    const table = await this.getTournamentTable(tournamentId);
    table.tournament.scoring = scoring;
    if (typeChanged && table.teams && table.teams.length > 0) {
      table.teams = [];
    }
    await repo.saveTable(tournamentId, table);

    return await repo.getById(tournamentId);
  }

  /**
   * Обновить количество сыгранных раундов (для MatchMonitor)
   */
  async updatePlayedRounds(tournamentId, playedRounds) {
    await repo.updatePlayedRounds(tournamentId, playedRounds);
  }

  /**
   * Удалить турнир из БД (сначала нужно выполнить рефанд через FinanceService.refundTournamentCancellation).
   */
  async deleteTournament(tournamentId) {
    const deleted = await repo.deleteById(tournamentId);
    if (!deleted) throw new Error('Турнир не найден');
    return true;
  }

  /**
   * Синхронизировать registration.entries → tournament_teams (для MatchMonitor и выплат).
   */
  async syncRegistrationEntriesToTable(tournamentId) {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) return { added: 0 };

    const entries = tournament.registration?.entries || [];
    if (entries.length === 0) return { added: 0 };

    const table = await this.getTournamentTable(tournamentId);
    const rounds = tournament.rounds || 5;
    const existingNames = new Set((table.teams || []).map((t) => this._normalizeName(t.name)));
    const newTeams = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      let players;
      let name;
      if (e.kind === 'solo') {
        name = e.playerId;
        players = [e.playerId];
      } else {
        players =
          Array.isArray(e.members) && e.members.length > 0
            ? e.members
            : e.captainId
              ? [e.captainId]
              : [];
        name = (e.name || '').trim() || `Команда ${i + 1}`;
      }
      const norm = this._normalizeName(name);
      if (existingNames.has(norm)) continue;
      existingNames.add(norm);

      const budget = await this.calculateBudgets(players).catch(() => players.map(() => 1));
      const results = Array.from({ length: rounds }, () => ({ placement: null, kills: null }));
      const team = {
        name,
        players,
        results,
        totalPoints: 0,
        rank: (table.teams?.length || 0) + newTeams.length + 1,
        budget,
        totalRating: budget.reduce((a, b) => a + b, 0)
      };
      if (tournament.type !== 'solo') {
        team.playerKills = players.map((pid) => ({
          playerId: pid,
          kills: Array(rounds).fill(null)
        }));
        team.playerDeaths = players.map((pid) => ({
          playerId: pid,
          deaths: Array(rounds).fill(null)
        }));
      }
      newTeams.push(team);
    }

    if (newTeams.length > 0) {
      table.teams = [...(table.teams || []), ...newTeams];
      await this.updateTournamentTable(tournamentId, table);
    }
    return { added: newTeams.length };
  }

  /**
   * Начать турнир (изменить state на "В процессе" и запустить мониторинг)
   */
  async startTournament(tournamentId) {
    const tournament = await repo.getById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    const st = tournament.state || '';
    if (st === 'В процессе') {
      throw new Error('Tournament is already in progress');
    }
    if (st === 'Турнир окончен' || st === 'DONE') {
      throw new Error('Нельзя начать завершённый турнир');
    }
    if (st === 'Турнир отменен') {
      throw new Error('Нельзя начать отменённый турнир');
    }
    await this.syncRegistrationEntriesToTable(tournamentId);
    await repo.update(tournamentId, { state: 'В процессе' });
    const updated = await repo.getById(tournamentId);
    const MatchMonitorService = require('./MatchMonitorService');
    await MatchMonitorService.syncWithActiveTournaments();
    return updated;
  }

  /**
   * Добавить +1 раунд к турниру.
   * Обновляет rounds в БД и расширяет results (и playerKills/playerDeaths) у всех команд до новой длины.
   */
  async addRound(tournamentId) {
    const tournament = await repo.getById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    if (tournament.state !== 'В процессе') {
      throw new Error('Can only add rounds to active tournaments');
    }
    const newRounds = (tournament.rounds || 0) + 1;
    await repo.update(tournamentId, { rounds: newRounds });

    const table = await this.getTournamentTable(tournamentId);
    let tableUpdated = false;
    for (const team of table.teams || []) {
      const need = newRounds;
      if (!Array.isArray(team.results) || team.results.length < need) {
        const arr = Array.from(team.results || [], (r) => (r && typeof r === 'object' ? { ...r } : { placement: null, kills: null }));
        while (arr.length < need) arr.push({ placement: null, kills: null });
        team.results = arr;
        tableUpdated = true;
      }
      if (!table.tournament?.type || table.tournament.type !== 'solo') {
        if (Array.isArray(team.playerKills)) {
          for (const pk of team.playerKills) {
            if (!Array.isArray(pk.kills) || pk.kills.length < need) {
              pk.kills = Array.from(pk.kills || [], (k) => k);
              while (pk.kills.length < need) pk.kills.push(null);
              tableUpdated = true;
            }
          }
        }
        if (Array.isArray(team.playerDeaths)) {
          for (const pd of team.playerDeaths) {
            if (!Array.isArray(pd.deaths) || pd.deaths.length < need) {
              pd.deaths = Array.from(pd.deaths || [], (d) => d);
              while (pd.deaths.length < need) pd.deaths.push(null);
              tableUpdated = true;
            }
          }
        }
      }
    }
    if (tableUpdated) {
      await this.updateTournamentTable(tournamentId, table);
    }
    return await repo.getById(tournamentId);
  }

  /**
   * Закрыть турнир (изменить state на "Турнир окончен")
   * @param {string} tournamentId
   * @param {{ skipDnaPipeline?: boolean, awaitPostClose?: boolean }} [options]
   *        skipDnaPipeline — пайплайн DNA уже выполнен (напр. перед автозакрытием), только очистка телеметрии + ladder/stats
   *        awaitPostClose — дождаться истории/DNA/Ladder (для автозакрытия из MatchMonitor)
   */
  async closeTournament(tournamentId, options = {}) {
    const { skipDnaPipeline = false, awaitPostClose = false } = options || {};
    const tournament = await repo.getById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    const st = tournament.state || '';
    if (st === 'Турнир окончен' || st === 'DONE') {
      throw new Error('Tournament is already closed');
    }

    try {
      await this.recalculateLeaderboard(tournamentId);
    } catch (err) {
      console.warn(`⚠️ Пересчёт лидерборда перед закрытием ${tournamentId}:`, err.message);
    }

    await repo.update(tournamentId, { state: 'Турнир окончен' });

    const MatchMonitorService = require('./MatchMonitorService');
    await MatchMonitorService.syncWithActiveTournaments();

    // Обновить чемпионства для победителя(ей)
    try {
      const ChampionshipsService = require('./ChampionshipsService');
      ChampionshipsService.updateChampionshipsForTournament(tournamentId);
    } catch (err) {
      console.error('Ошибка при обновлении чемпионств:', err.message);
    }

    // История, DNA и Ladder при закрытии (в т.ч. при автозакрытии из MatchMonitor)
    const StatsService = require('./StatsService');
    const DnaOnCloseService = require('./dna/DnaOnCloseService');
    const LadderService = require('./LadderService');

    const runPostClose = async () => {
      try {
        await StatsService.updatePlayerHistoriesAfterTournament(tournamentId);
      } catch (err) {
        console.error('Ошибка при обновлении истории игроков после турнира:', err.message);
      }
      try {
        if (skipDnaPipeline) {
          await DnaOnCloseService.cleanupTelemetryForTournament(tournamentId);
        } else {
          const result = await DnaOnCloseService.run(tournamentId);
          if (result && result.ok && !result.skipped) {
            console.log(`✅ DNA пересчитан для турнира ${tournamentId}:`, result.stats);
          } else if (result && result.error) {
            console.error('❌ DNA при закрытии турнира:', result.error);
          }
        }
      } catch (err) {
        console.error('❌ DNA при закрытии турнира (исключение):', err.message);
      }
      try {
        const ladderResult = await LadderService.updateAfterTournament(tournamentId);
        if (ladderResult && ladderResult.ok && ladderResult.updated > 0) {
          console.log(`✅ Ladder обновлён для турнира ${tournamentId}:`, ladderResult.updated, 'игроков');
        } else if (ladderResult && ladderResult.error) {
          console.warn('⚠️ Ladder при закрытии турнира:', ladderResult.error);
        }
      } catch (err) {
        console.warn('⚠️ Ladder при закрытии турнира (исключение):', err.message);
      }
    };

    if (awaitPostClose) {
      await runPostClose();
    } else {
      setImmediate(() => {
        runPostClose().catch((e) => console.error('Post-close chain:', e));
      });
    }

    return await repo.getById(tournamentId);
  }

  /**
   * Обновить результат матча (DEPRECATED - удалить)
   */
  async updateMatchResult(tournamentId, matchData) {
    const { match, teamName, placement, kills, playerKills, playerDeaths } = matchData;
    const table = await this.getTournamentTable(tournamentId);

    const team = table.teams.find(t => t.name === teamName);
    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    const matchIndex = match - 1;
    if (matchIndex < 0 || matchIndex >= team.results.length) {
      throw new Error(`Invalid match number: ${match}`);
    }

    // Обновляем результат команды
    team.results[matchIndex] = { placement, kills };

    // Обновляем киллы игроков
    if (playerKills && Array.isArray(playerKills)) {
      playerKills.forEach((pk, idx) => {
        if (team.playerKills[idx] && team.playerKills[idx].kills) {
          team.playerKills[idx].kills[matchIndex] = pk.kills;
        }
      });
    }

    if (playerDeaths && Array.isArray(playerDeaths)) {
      if (!Array.isArray(team.playerDeaths) || team.playerDeaths.length !== team.players.length) {
        team.playerDeaths = team.players.map(() => ({ deaths: Array(team.results.length).fill(null) }));
      }
      playerDeaths.forEach((pd, idx) => {
        if (team.playerDeaths[idx] && team.playerDeaths[idx].deaths) {
          team.playerDeaths[idx].deaths[matchIndex] = pd.deaths;
        }
      });
    }

    await this.updateTournamentTable(tournamentId, table);
    return team;
  }

  /**
   * Обновить киллы конкретного игрока в матче
   */
  async updatePlayerKills(tournamentId, teamName, playerName, match, kills) {
    const table = await this.getTournamentTable(tournamentId);
    const rounds = table.tournament?.rounds || 0;

    // Валидация
    if (match < 1 || match > rounds) {
      throw new Error(`Match number must be between 1 and ${rounds}`);
    }
    if (kills < 0) {
      throw new Error('Kills must be a non-negative integer');
    }

    // Находим команду
    const team = table.teams.find(t => t.name === teamName);
    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    // Находим игрока в команде
    const playerIndex = (team.players || []).indexOf(playerName);
    if (playerIndex === -1) {
      throw new Error(`Player "${playerName}" not in team "${teamName}"`);
    }

    // Инициализируем массив playerKills, если нужно
    if (!Array.isArray(team.playerKills) || team.playerKills.length !== team.players.length) {
      team.playerKills = team.players.map(() => ({ kills: Array(rounds).fill(null) }));
    }

    // Гарантируем длину каждого kills[]
    team.playerKills.forEach(pk => {
      if (!Array.isArray(pk.kills) || pk.kills.length !== rounds) {
        pk.kills = Array(rounds).fill(null);
      }
    });

    // Обновляем киллы
    const matchIndex = match - 1;
    team.playerKills[playerIndex].kills[matchIndex] = kills;

    await this.updateTournamentTable(tournamentId, table);
    return team;
  }

  /**
   * Обновить смерти конкретного игрока в матче
   */
  async updatePlayerDeaths(tournamentId, teamName, playerName, match, deaths) {
    const table = await this.getTournamentTable(tournamentId);
    const rounds = table.tournament?.rounds || 0;

    // Валидация
    if (match < 1 || match > rounds) {
      throw new Error(`Match number must be between 1 and ${rounds}`);
    }
    if (deaths < 0) {
      throw new Error('Deaths must be a non-negative integer');
    }

    // Находим команду
    const team = table.teams.find(t => t.name === teamName);
    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    // Находим игрока в команде
    const playerIndex = (team.players || []).indexOf(playerName);
    if (playerIndex === -1) {
      throw new Error(`Player "${playerName}" not in team "${teamName}"`);
    }

    // Инициализируем массив playerDeaths, если нужно
    if (!Array.isArray(team.playerDeaths) || team.playerDeaths.length !== team.players.length) {
      team.playerDeaths = team.players.map(() => ({ deaths: Array(rounds).fill(null) }));
    }

    // Гарантируем длину каждого deaths[]
    team.playerDeaths.forEach(pd => {
      if (!Array.isArray(pd.deaths) || pd.deaths.length !== rounds) {
        pd.deaths = Array(rounds).fill(null);
      }
    });

    // Обновляем смерти
    const matchIndex = match - 1;
    team.playerDeaths[playerIndex].deaths[matchIndex] = deaths;

    await this.updateTournamentTable(tournamentId, table);
    return team;
  }

  /**
   * Пересчитать лидерборд
   */
  async recalculateLeaderboard(tournamentId) {
    const table = await this.getTournamentTable(tournamentId);
    const { tournament, teams } = table;
    const placementMap = tournament.scoring.placement;
    const perKill = tournament.scoring.per_kill;
    const isHotDrop = tournamentId === 'HotDrop';

    // Рассчитываем очки для каждой команды
    teams.forEach(team => {
      const teamSize = Array.isArray(team.players) ? team.players.length : 1;
      const modifier = isHotDrop
        ? (teamSize === 2 ? 0.8 : teamSize === 3 ? 0.6 : 1)
        : 1;

      let total = 0;
      team.results.forEach(r => {
        let pts = 0;
        if (r.placement != null) pts += placementMap[r.placement] || 0;
        if (r.kills != null) pts += r.kills * perKill;
        total += pts * modifier;
      });

      team.totalPoints = total;
    });

    // Сортируем и присваиваем ранги
    teams.sort((a, b) => b.totalPoints - a.totalPoints);
    teams.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    await this.updateTournamentTable(tournamentId, table);

    // Автоматически обновляем истории игроков, если турнир завершен
    const StatsService = require('./StatsService');
    try {
      await StatsService.updatePlayerHistoriesAfterTournament(tournamentId);
    } catch (err) {
      console.error('Ошибка при обновлении истории игроков:', err.message);
    }

    // Обновить чемпионства, если турнир уже завершён (DONE)
    const tourMeta = await this.getTournamentById(tournamentId);
    if (tourMeta && (tourMeta.state === 'Турнир окончен' || tourMeta.state === 'DONE')) {
      try {
        const ChampionshipsService = require('./ChampionshipsService');
        ChampionshipsService.updateChampionshipsForTournament(tournamentId);
      } catch (err) {
        console.error('Ошибка при обновлении чемпионств:', err.message);
      }
    }

    return teams;
  }
}

module.exports = new TournamentService();

