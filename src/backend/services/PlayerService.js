// src/backend/services/PlayerService.js
const fs = require('fs');
const {
  DEFAULT_PLAQUE_LOADOUT,
} = require('../../shared/achievement');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db } = require('../../../lib/db');
const TournamentService = require('./TournamentService');
const PlayerStatsCacheService = require('./PlayerStatsCacheService');
const { playersDir } = require('../config/dataPaths');
const DnaService = require('./dna/DnaService');
const dnaEngine = require('./dna/dnaEngine');
const LadderService = require('./LadderService');

class PlayerService {
  constructor() {
    this.playersDir = playersDir;
  }

  normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  normalizeUsername(username) {
    return typeof username === 'string' ? username.trim().toLowerCase() : '';
  }

  normalizePubgNick(pubgNick) {
    return typeof pubgNick === 'string' ? pubgNick.trim() : '';
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getProfilePath(username) {
    return path.join(this.playersDir, `${username}.json`);
  }

  /**
   * Получить список всех игроков. query — опциональная строка поиска по нику (без учёта регистра).
   * Возвращает массив { playerId, nickname, rating }.
   */
  async getAllPlayers(query) {
    if (!fs.existsSync(this.playersDir)) {
      return [];
    }
    const files = fs.readdirSync(this.playersDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5));
    const search = typeof query === 'string' ? query.trim().toLowerCase() : '';
    let list = files;
    if (search) {
      list = files.filter((id) => id.toLowerCase().includes(search));
    }
    const result = [];
    for (const id of list) {
      try {
        const profile = await this.getPlayerProfile(id);
        const nickname = profile?.pubgNick || profile?.username || id;
        result.push({
          playerId: nickname,
          nickname,
          rating: profile?.dna_rating ?? profile?.rating ?? 0
        });
      } catch {
        result.push({ playerId: id, nickname: id, rating: 0 });
      }
    }
    return result.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));
  }

  /**
   * Подставить dna_rating из таблицы player_profiles в объект профиля.
   * player_id в БД соответствует username (нормализованный).
   */
  async enrichWithDnaRating(profile) {
    if (!profile) return;
    const id = this.normalizeUsername(profile.username || profile.pubgNick || '');
    if (!id) return;
    try {
      const row = await db('player_profiles').whereRaw('LOWER(player_id) = ?', [id]).first('dna_rating', 'dominant_trait');
      if (row) {
        if (row.dna_rating != null) profile.dna_rating = row.dna_rating;
        if (row.dominant_trait != null) profile.dominant_trait = row.dominant_trait;
      }
    } catch (_) {
      // Таблица или колонка могут отсутствовать
    }
  }

  /**
   * Загрузить историю DNA-рейтинга из player_dna_rating_history и записать в profile.dnaRatingHistory.
   * @param {Object} profile - объект профиля (должен иметь username или pubgNick)
   * @param {string|null} year - опционально: фильтр по сезону (например "2026")
   */
  async enrichWithDnaRatingHistory(profile, year = null) {
    if (!profile) return;
    const id = this.normalizeUsername(profile.username || profile.pubgNick || '');
    if (!id) return;
    try {
      let q = db('player_dna_rating_history')
        .whereRaw('LOWER(player_id) = ?', [id])
        .orderBy('occurred_at', 'asc')
        .select('occurred_at', 'rating', 'tournament_id', 'match_ref', 'season_id');
      if (year) {
        q = q.where('season_id', String(year));
      }
      const rows = await q;
      profile.dnaRatingHistory = (rows || []).map((r) => ({
        occurred_at: r.occurred_at,
        rating: r.rating,
        tournament_id: r.tournament_id ?? undefined,
        match_ref: r.match_ref ?? undefined,
        season_id: r.season_id,
      }));
    } catch (_) {
      profile.dnaRatingHistory = [];
    }
  }

  /**
   * Подставить dominant_trait из того же источника, что и DNA Lab (getProfileOrStub),
   * чтобы в профиле и в DNA Lab отображался один и тот же архетип.
   */
  async enrichWithDnaArchetypeFromLab(profile, seasonId = null) {
    if (!profile) return;
    const id = this.normalizeUsername(profile.username || profile.pubgNick || '');
    if (!id) return;
    try {
      const season = seasonId || DnaService.DEFAULT_SEASON;
      const dnaProfile = await DnaService.getProfileOrStub(id, season, { useDnaTest: false });
      let trait = null;
      let dnaTier = null;
      let coreScore = null;
      if (dnaProfile) {
        const profileV2 = DnaService.mapProfileToV2(dnaProfile, null);
        trait = profileV2?.dominantTrait != null ? profileV2.dominantTrait : dnaProfile.dominantTrait ?? null;
        dnaTier = profileV2?.dnaTier != null ? profileV2.dnaTier : dnaProfile.dnaTier ?? null;
        coreScore = profileV2?.coreScore ?? dnaProfile?.coreScore ?? null;
        if (dnaTier == null && coreScore != null) {
          dnaTier = dnaEngine.computeDnaTier(coreScore);
        }
      }
      if (trait != null) {
        profile.dominant_trait = trait;
      }
      if (dnaTier != null) {
        profile.dnaTier = dnaTier;
      }
      if (coreScore != null) {
        profile.dna_rating = coreScore;
        profile.rating = coreScore;
      }
    } catch (_) {
      // оставляем dominant_trait из enrichWithDnaRating, если DNA Lab недоступен
    }
  }

  /**
   * Подставить Ladder (рейтинг, ранг, last_delta) из player_ladder по текущему сезону.
   * Если у игрока нет ни одной записи в player_ladder (не играл турниров), рейтинг и ранг = null.
   */
  async enrichWithLadder(profile, seasonId = null) {
    if (!profile) return;
    const id = this.normalizeUsername(profile.username || profile.pubgNick || '');
    if (!id) return;
    try {
      const ladder = await LadderService.getLadderForPlayer(id, seasonId);
      if (ladder) {
        profile.ladder_rating = ladder.ladder_rating;
        profile.ladder_rank_label = ladder.ladder_rank_label;
        profile.ladder_last_delta = ladder.last_delta;
        profile.ladder_last_tournament_id = ladder.last_tournament_id;
        profile.ladder_lifetime_best = ladder.lifetime_best;
        profile.ladder_previous_season_rating = ladder.previous_season_rating;
      }
      const breakdown = await LadderService.getLadderChangeBreakdown(id, seasonId);
      if (breakdown) {
        profile.ladder_last_breakdown = breakdown;
      }
      const ladderHistory = await LadderService.getLadderHistoryForPlayer(id);
      if (ladderHistory && ladderHistory.length > 0) {
        profile.ladderRatingHistory = ladderHistory;
      } else {
        profile.ladderRatingHistory = [];
      }
      if (ladder && ladder.ladder_rating == null) {
        profile.ladder_rating = null;
        profile.ladder_rank_label = null;
      }
    } catch (_) {
      profile.ladder_rating = null;
      profile.ladder_rank_label = null;
      profile.ladder_last_delta = null;
      profile.ladderRatingHistory = [];
    }
  }

  /**
   * Получить профиль игрока (с подстановкой dna_rating из БД)
   */
  async getPlayerProfile(username) {
    const normalizedUsername = this.normalizeUsername(username);
    const profilePath = this.getProfilePath(normalizedUsername);
    if (!fs.existsSync(profilePath)) {
      return null;
    }
    const data = fs.readFileSync(profilePath, 'utf8');
    const profile = JSON.parse(data);
    await this.enrichWithDnaRating(profile);
    // Единственный рейтинг — DNA; старый rating из файла не используем
    if (profile.dna_rating != null) {
      profile.rating = profile.dna_rating;
      profile.effectiveRating = profile.dna_rating;
    } else {
      profile.rating = null;
      profile.effectiveRating = null;
    }
    return profile;
  }

  /**
   * Создать аккаунт игрока
   */
  async createPlayerProfile({ username, password, email, pubgNick }) {
    const normalizedUsername = this.normalizeUsername(username);
    const profilePath = this.getProfilePath(normalizedUsername);

    if (fs.existsSync(profilePath)) {
      throw new Error(`Player "${normalizedUsername}" already exists`);
    }

    // Создаём директорию, если её нет
    if (!fs.existsSync(this.playersDir)) {
      fs.mkdirSync(this.playersDir, { recursive: true });
    }

    let passwordHash = undefined;
    if (password) {
      const saltRounds = 10;
      passwordHash = await bcrypt.hash(password, saltRounds);
    }

    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPubgNick = this.normalizePubgNick(pubgNick);
    const newProfile = {
      username: normalizedUsername,
      email: normalizedEmail || null,
      emailVerified: false,
      pubgNick: normalizedPubgNick,
      passwordHash: passwordHash || undefined,
      sessions: [],
      history: [],
      calibrating: true,
      longAnchor: 0,
      effectiveRating: 0,
      ratingHistory: [],
      rating: 0,
      plaqueLoadout: { ...DEFAULT_PLAQUE_LOADOUT },
    };

    fs.writeFileSync(
      profilePath,
      JSON.stringify(newProfile, null, 2),
      'utf8'
    );

    return newProfile;
  }


  /**
   * Найти игрока по email
   */
  async findPlayerByEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !fs.existsSync(this.playersDir)) {
      return null;
    }

    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const profilePath = path.join(this.playersDir, file);
      try {
        const data = fs.readFileSync(profilePath, 'utf8');
        const profile = JSON.parse(data);
        const profileEmail = this.normalizeEmail(profile.email);
        if (profileEmail && profileEmail === normalizedEmail) {
          return { profile, username: profile.username || profile.name };
        }
      } catch (error) {
        // Игнорируем некорректные файлы
      }
    }

    return null;
  }

  async findPlayerByUsername(username) {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername || !fs.existsSync(this.playersDir)) {
      return null;
    }

    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const profilePath = path.join(this.playersDir, file);
      try {
        const data = fs.readFileSync(profilePath, 'utf8');
        const profile = JSON.parse(data);
        const profileUsername = this.normalizeUsername(profile.username || profile.name);
        if (profileUsername && profileUsername === normalizedUsername) {
          return { profile, username: profile.username || profile.name };
        }
      } catch (error) {
        // Игнорируем некорректные файлы
      }
    }

    return null;
  }

  async findPlayerByPubgNick(pubgNick) {
    const normalizedPubg = this.normalizePubgNick(pubgNick);
    if (!normalizedPubg || !fs.existsSync(this.playersDir)) {
      return null;
    }

    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const profilePath = path.join(this.playersDir, file);
      try {
        const data = fs.readFileSync(profilePath, 'utf8');
        const profile = JSON.parse(data);
        const profilePubgNick = this.normalizePubgNick(profile.pubgNick);
        if (profilePubgNick && profilePubgNick === normalizedPubg) {
          await this.enrichWithDnaRating(profile);
          return { profile, username: profile.username || profile.name };
        }
      } catch (error) {
        // Игнорируем некорректные файлы
      }
    }

    return null;
  }

  /**
   * Найти игрока по Steam ID
   */
  async findPlayerBySteamId(steamId64) {
    if (!steamId64 || !fs.existsSync(this.playersDir)) {
      return null;
    }

    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const profilePath = path.join(this.playersDir, file);
      try {
        const data = fs.readFileSync(profilePath, 'utf8');
        const profile = JSON.parse(data);
        if (profile?.steam?.steamId64 === String(steamId64)) {
          return { profile, username: profile.username || profile.name };
        }
      } catch (error) {
        // Игнорируем некорректные файлы
      }
    }

    return null;
  }

  /**
   * Найти всех игроков с данным PUBG-ником (case-insensitive)
   */
  async findAllPlayersByPubgNick(pubgNick) {
    const normalizedPubg = this.normalizePubgNick(pubgNick).toLowerCase();
    if (!normalizedPubg || !fs.existsSync(this.playersDir)) {
      return [];
    }

    const result = [];
    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const profilePath = path.join(this.playersDir, file);
      try {
        const data = fs.readFileSync(profilePath, 'utf8');
        const profile = JSON.parse(data);
        const profilePubgNick = this.normalizePubgNick(profile.pubgNick || profile.pubgNickname).toLowerCase();
        if (profilePubgNick && profilePubgNick === normalizedPubg) {
          result.push({ profile, username: profile.username || profile.name });
        }
      } catch (error) {
        // Игнорируем некорректные файлы
      }
    }

    return result;
  }

  /**
   * Создать профиль из Steam (без пароля)
   */
  async createPlayerFromSteam(steamProfile) {
    const steamId64 = String(steamProfile.steamId64);
    const username = 'steam_' + steamId64;
    const profilePath = this.getProfilePath(username);

    if (fs.existsSync(profilePath)) {
      throw new Error(`Steam profile "${steamId64}" already linked`);
    }

    if (!fs.existsSync(this.playersDir)) {
      fs.mkdirSync(this.playersDir, { recursive: true });
    }

    const linkedAt = new Date().toISOString();
    const newProfile = {
      username,
      email: null,
      emailVerified: false,
      pubgNick: steamProfile.personaName || 'Unknown',
      sessions: [],
      steam: {
        steamId64,
        personaName: steamProfile.personaName || null,
        avatar: steamProfile.avatar || null,
        profileUrl: steamProfile.profileUrl || null,
        linkedAt
      },
      needsPubgNick: true,
      history: [],
      calibrating: true,
      longAnchor: 0,
      effectiveRating: 0,
      ratingHistory: [],
      rating: 0
    };

    fs.writeFileSync(profilePath, JSON.stringify(newProfile, null, 2), 'utf8');
    return newProfile;
  }

  /**
   * Проверить, занят ли email другим игроком
   */
  async isEmailInUse(email, excludingUsername = null) {
    const result = await this.findPlayerByEmail(email);
    if (!result) {
      return false;
    }
    if (excludingUsername && result.username === excludingUsername) {
      return false;
    }
    return true;
  }

  async isUsernameInUse(username, excludingUsername = null) {
    const result = await this.findPlayerByUsername(username);
    if (!result) {
      return false;
    }
    if (excludingUsername && result.username === excludingUsername) {
      return false;
    }
    return true;
  }

  async isPubgNickInUse(pubgNick, excludingUsername = null) {
    const result = await this.findPlayerByPubgNick(pubgNick);
    if (!result) {
      return false;
    }
    if (excludingUsername && result.username === excludingUsername) {
      return false;
    }
    return true;
  }

  async updateAccount(username, updates, options = {}) {
    const profile = await this.getPlayerProfile(username);
    if (!profile) {
      throw new Error(`Player "${username}" not found`);
    }

    const nextUsername = updates.username ? this.normalizeUsername(updates.username) : profile.username;
    const nextEmail = updates.email ? this.normalizeEmail(updates.email) : profile.email;
    const nextPubgNick = updates.pubgNick != null ? this.normalizePubgNick(updates.pubgNick) : profile.pubgNick;

    const updatedProfile = {
      ...profile,
      username: nextUsername || profile.username,
      email: nextEmail || profile.email,
      pubgNick: nextPubgNick,
      sessions: Array.isArray(profile.sessions) ? profile.sessions : []
    };

    if (updates.email && nextEmail !== profile.email) {
      updatedProfile.emailVerified = false;
    }

    if (updates.password) {
      if (!options.currentPassword) {
        throw new Error('Current password required');
      }
      const isValid = await bcrypt.compare(options.currentPassword, profile.passwordHash || '');
      if (!isValid) {
        throw new Error('Current password is invalid');
      }
      const saltRounds = 10;
      updatedProfile.passwordHash = await bcrypt.hash(updates.password, saltRounds);
    }

    const finalUsername = this.normalizeUsername(updatedProfile.username || profile.username);
    const oldPath = this.getProfilePath(username);
    const newPath = this.getProfilePath(finalUsername);
    if (finalUsername !== username) {
      if (fs.existsSync(newPath)) {
        throw new Error('Username already exists');
      }
      fs.renameSync(oldPath, newPath);
    }

    fs.writeFileSync(newPath, JSON.stringify(updatedProfile, null, 2), 'utf8');
    return updatedProfile;
  }

  async setInitialCredentials(username, { password, email, pubgNick }) {
    const profile = await this.getPlayerProfile(username);
    if (!profile) {
      throw new Error(`Player "${username}" not found`);
    }
    if (profile.passwordHash) {
      throw new Error('Password already set');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const updatedProfile = {
      ...profile,
      passwordHash,
      email: email ? this.normalizeEmail(email) : null,
      emailVerified: false,
      pubgNick: this.normalizePubgNick(pubgNick)
    };

    const profilePath = this.getProfilePath(username);
    fs.writeFileSync(profilePath, JSON.stringify(updatedProfile, null, 2), 'utf8');
    return updatedProfile;
  }

  /**
   * Проверить пароль игрока
   */
  async verifyPassword(username, password) {
    const normalizedUsername = this.normalizeUsername(username);
    const profile = await this.getPlayerProfile(normalizedUsername);

    if (!profile) {
      return null; // Игрок не найден
    }

    // Если у игрока нет пароля (старые профили), возвращаем null
    if (!profile.passwordHash) {
      return null; // Старый профиль без пароля
    }

    // Проверяем пароль
    const isValid = await bcrypt.compare(password, profile.passwordHash);

    if (!isValid) {
      return null; // Неверный пароль
    }

    return profile; // Пароль верный
  }

  /**
   * Обновить профиль игрока
   */
  async updatePlayerProfile(username, updates) {
    const normalizedUsername = this.normalizeUsername(username);
    const profile = await this.getPlayerProfile(normalizedUsername);
    if (!profile) {
      throw new Error(`Player "${normalizedUsername}" not found`);
    }

    const updatedProfile = { ...profile, ...updates };
    const profilePath = this.getProfilePath(normalizedUsername);
    fs.writeFileSync(
      profilePath,
      JSON.stringify(updatedProfile, null, 2),
      'utf8'
    );

    return updatedProfile;
  }

  /**
   * Добавить запись в историю игрока
   */
  async addHistoryEntry(username, entry) {
    const profile = await this.getPlayerProfile(username);
    if (!profile) {
      throw new Error(`Player "${username}" not found`);
    }

    if (!profile.history) {
      profile.history = [];
    }

    profile.history.push(entry);
    await this.updatePlayerProfile(username, profile);

    return profile;
  }

  /**
   * Получить статистику игрока (с поддержкой фильтрации по году)
   * Использует кеш из БД для быстрого доступа
   */
  async getPlayerStats(username, year = null) {
    const profile = await this.getPlayerProfile(username);
    if (!profile) {
      return null;
    }

    const playerId = profile.pubgNick || profile.username || username;
    
    // Определяем scope и period для кеша
    let scope, period;
    if (year) {
      scope = 'year';
      period = year;
    } else {
      scope = 'all_time';
      period = null;
    }

    // Пытаемся получить из кеша
    const cachedStats = await PlayerStatsCacheService.getCachedStats(playerId, scope, period);
    if (cachedStats) {
      // Рейтинг везде только DNA: подставляем актуальный dna_rating, чтобы не показывать старый из кеша
      const dnaRating = profile.dna_rating ?? profile.effectiveRating ?? null;
      if (dnaRating != null && Array.isArray(cachedStats.core)) {
        const ratingMetric = cachedStats.core.find((m) => m && m.id === 'rating');
        if (ratingMetric) {
          ratingMetric.value = dnaRating;
          ratingMetric.displayValue = String(Math.round(dnaRating));
        }
      } else if (dnaRating == null && Array.isArray(cachedStats.core)) {
        const ratingMetric = cachedStats.core.find((m) => m && m.id === 'rating');
        if (ratingMetric) {
          ratingMetric.value = null;
          ratingMetric.displayValue = '—';
        }
      }
      return cachedStats;
    }

    // Если в кеше нет - добавляем в очередь для пересчета
    // Но возвращаем fallback статистику, чтобы пользователь не ждал
    const StatsRecalculationQueue = require('./StatsRecalculationQueue');
    const queueStatus = StatsRecalculationQueue.getStatus();
    
    // Если очередь не перегружена, вычисляем синхронно для быстрого ответа
    if (queueStatus.queueLength === 0 && !queueStatus.processing) {
      try {
        // Передаем профиль, чтобы избежать повторной загрузки и циклической зависимости
        const stats = await PlayerStatsCacheService.calculateAndSaveStats(playerId, scope, period, profile);
        return stats;
      } catch (error) {
        console.error(`Ошибка вычисления статистики для ${playerId}:`, error);
        // Fallback на старый метод если кеш не работает
      }
    } else {
      // Очередь занята - добавляем задачу и возвращаем fallback
      console.log(`📋 Статистика для ${playerId} (${scope}, ${period}) отсутствует, добавлена в очередь`);
      
      // Определяем дату для пересчета
      // recalculateAllPeriods пересчитывает все периоды (all_time, year, quarter)
      // поэтому используем дату из периода, если есть
      let tournamentDate = null;
      if (scope === 'quarter' && period) {
        const [year, quarter] = period.split('-Q');
        const quarterStartMonth = (parseInt(quarter, 10) - 1) * 3 + 1;
        tournamentDate = `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`;
      } else if (scope === 'year' && period) {
        tournamentDate = `${period}-01-01`;
      }
      // Для all_time tournamentDate остается null, что правильно
      
      // Добавляем в очередь с высоким приоритетом (пользователь ждет)
      StatsRecalculationQueue.enqueue(playerId, tournamentDate, 'high')
        .catch(error => {
          console.error(`Ошибка добавления задачи в очередь для ${playerId}:`, error);
        });
    }
    
    // Возвращаем fallback статистику
    return this._calculateStatsLegacy(username, year);
  }

  /**
   * Старый метод вычисления статистики (fallback)
   * @private
   */
  async _calculateStatsLegacy(username, year = null) {
    const profile = await this.getPlayerProfile(username);
    if (!profile) {
      return null;
    }
    const { buildPlayerStats } = require('../../stats');
    
    // Определяем историю для фильтрации
    const historyForYear = year && profile.yearSnapshots?.[year]?.history?.length
      ? profile.yearSnapshots[year].history
      : (profile.history || []);
    
    // Собираем ID турниров, которые нужны для этого игрока
    const neededTournamentIds = new Set();
    historyForYear.forEach(entry => {
      if (entry.tournamentId) {
        neededTournamentIds.add(entry.tournamentId);
      }
    });
    
    // Загружаем только нужные турниры
    const allTournaments = await TournamentService.getAllTournaments();
    const relevantTournaments = allTournaments.filter(t => {
      const tournamentId = t?.id || t?._id;
      return neededTournamentIds.has(tournamentId);
    });
    
    // Загружаем таблицы только для нужных турниров
    const tablesById = {};
    await Promise.all(
      relevantTournaments.map(async (tournament) => {
        const tournamentId = tournament?.id || tournament?._id;
        if (!tournamentId) return;
        try {
          tablesById[tournamentId] = await TournamentService.getTournamentTable(tournamentId);
        } catch (err) {
          tablesById[tournamentId] = null;
        }
      })
    );

    const profileForStats = {
      ...profile,
      history: historyForYear
    };

    const pubgNick = profile.pubgNick || profile.username || username;

    // Используем все турниры для buildPlayerStats, но таблицы загружены только для нужных
    return buildPlayerStats(
      pubgNick,
      { profile: profileForStats, tournaments: allTournaments, tablesById },
      { scope: year ? 'year' : 'all_time', year: year || null, includeLive: false, modeFilter: 'all' }
    );
  }

  /**
   * Получить список доступных годов для статистики игрока.
   * Всегда включаем 2025 и текущий год, чтобы можно было переключать срез даже без данных за прошлый год.
   */
  async getAvailableYears(playerName) {
    const profile = await this.getPlayerProfile(playerName);
    if (!profile) {
      return [];
    }

    const years = new Set();
    const currentYear = new Date().getFullYear().toString();

    // Минимальный набор: 2025 и текущий год (чтобы статистика за 25 год была доступна)
    years.add('2025');
    years.add(currentYear);

    // Годы из срезов
    if (profile.yearSnapshots) {
      Object.keys(profile.yearSnapshots).forEach(year => years.add(year));
    }

    // Годы из истории
    const history = profile.history || [];
    history.forEach(entry => {
      if (entry.date) {
        const y = entry.date.split('-')[0];
        if (y) years.add(y);
      }
    });

    return Array.from(years).sort((a, b) => b.localeCompare(a)); // По убыванию
  }
}

module.exports = new PlayerService();

