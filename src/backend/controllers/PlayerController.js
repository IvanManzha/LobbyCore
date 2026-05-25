// src/backend/controllers/PlayerController.js
const PlayerService = require('../services/PlayerService');
const ChampionshipsService = require('../services/ChampionshipsService');
const { issueJwtForProfile, generateToken } = require('../middleware/jwtAuth');

class PlayerController {
  sanitizeProfile(profile) {
    if (!profile) return profile;
    const {
      passwordHash,
      emailVerifyTokenHash,
      emailVerifyExpires,
      sessions,
      ...safeProfile
    } = profile;
    return safeProfile;
  }
  /**
   * GET /api/v1/players?query=
   * Получить список всех игроков (опционально поиск по нику)
   */
  async getAllPlayers(req, res) {
    try {
      const query = req.query?.query;
      const players = await PlayerService.getAllPlayers(query);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/players/:identifier
   * Получить публичный профиль игрока
   */
  async getPlayerProfile(req, res) {
    try {
      const { name: identifier } = req.params;
      const normalizedIdentifier = PlayerService.normalizeUsername(identifier);
      let profile = await PlayerService.getPlayerProfile(normalizedIdentifier);
      if (!profile) {
        const byPubg = await PlayerService.findPlayerByPubgNick(identifier);
        profile = byPubg?.profile || null;
      }

      if (!profile) {
        return res.status(404).json({ error: 'Player not found' });
      }

      await PlayerService.enrichWithDnaRatingHistory(profile);
      await PlayerService.enrichWithLadder(profile);
      await PlayerService.enrichWithDnaArchetypeFromLab(profile);
      res.json(this.sanitizeProfile(profile));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/players/register
   * Регистрация аккаунта
   */
  async register(req, res) {
    try {
      const { password, pubgNick } = req.body;
      const normalizedPubgNick = PlayerService.normalizePubgNick(pubgNick);
      const normalizedUsername = PlayerService.normalizeUsername(normalizedPubgNick);

      const existingProfile = await PlayerService.getPlayerProfile(normalizedUsername);
      if (existingProfile && existingProfile.passwordHash) {
        return res.status(409).json({ error: 'PUBG-ник уже используется' });
      }

      const profile = existingProfile
        ? await PlayerService.setInitialCredentials(normalizedUsername, {
          password,
          email: null,
          pubgNick: normalizedPubgNick
        })
        : await PlayerService.createPlayerProfile({
          username: normalizedUsername,
          password,
          email: null,
          pubgNick: normalizedPubgNick
        });

      res.status(existingProfile ? 200 : 201).json({
        success: true,
        profile: this.sanitizeProfile(profile),
        status: existingProfile ? 'updated' : 'created'
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/players/login
   * Логин игрока с проверкой пароля
   */
  async login(req, res) {
    try {
      const { pubgNick, password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Пароль обязателен' });
      }

      const normalizedPubgNick = PlayerService.normalizePubgNick(pubgNick);
      const normalizedUsername = PlayerService.normalizeUsername(normalizedPubgNick);
      const profile = await PlayerService.getPlayerProfile(normalizedUsername);

      if (!profile) {
        return res.status(401).json({ error: 'Неверный PUBG-ник или пароль' });
      }

      const verifiedProfile = await PlayerService.verifyPassword(profile.username, password);

      if (!verifiedProfile) {
        return res.status(401).json({ error: 'Неверный PUBG-ник или пароль' });
      }

      const { token, expiresIn } = issueJwtForProfile(verifiedProfile);

      res.json({
        profile: this.sanitizeProfile(verifiedProfile),
        token,
        expiresIn
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/players/logout
   * Выход из системы (на клиенте просто удаляется токен)
   */
  async logout(req, res) {
    try {
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/players/me
   * Получить текущего авторизованного пользователя
   */
  async getCurrentUser(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const profile = await PlayerService.getPlayerProfile(req.user.username);

      if (!profile) {
        return res.status(404).json({ error: 'Player not found' });
      }

      res.json({ profile: this.sanitizeProfile(profile) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/players/verify-token
   * Проверить валидность токена
   */
  async verifyToken(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ valid: false, error: 'Invalid token' });
      }

      const profile = await PlayerService.getPlayerProfile(req.user.username);

      if (!profile) {
        return res.status(404).json({ valid: false, error: 'Player not found' });
      }

      res.json({
        valid: true,
        profile: this.sanitizeProfile(profile),
        user: req.user
      });
    } catch (error) {
      res.status(500).json({ valid: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/players/me
   * Обновить профиль текущего пользователя
   */
  async updateProfile(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { pubgNick, password, currentPassword } = req.body;
      const normalizedPubgNick = pubgNick != null ? PlayerService.normalizePubgNick(pubgNick) : undefined;
      const updates = {
        username: normalizedPubgNick ? PlayerService.normalizeUsername(normalizedPubgNick) : undefined,
        pubgNick: normalizedPubgNick != null ? normalizedPubgNick : undefined,
        password: password || undefined
      };

      if (updates.pubgNick && await PlayerService.isPubgNickInUse(updates.pubgNick, req.user.username)) {
        return res.status(409).json({ error: 'PUBG-ник уже используется' });
      }

      const currentProfile = await PlayerService.getPlayerProfile(req.user.username);
      const updatedProfile = await PlayerService.updateAccount(
        req.user.username,
        updates,
        { currentPassword }
      );

      let token;
      if (updates.username) {
        token = generateToken({ username: updatedProfile.username, pubgNick: updatedProfile.pubgNick });
      }

      res.json({
        profile: this.sanitizeProfile(updatedProfile),
        token,
        emailVerificationRequired: false
      });
    } catch (error) {
      const message = error.message === 'Current password is invalid'
        ? 'Текущий пароль неверен'
        : error.message === 'Current password required'
          ? 'Требуется текущий пароль'
          : error.message;
      res.status(400).json({ error: message });
    }
  }

  /**
   * GET /api/v1/players/:name/stats
   * Получить статистику игрока (опционально с параметром ?year=2025)
   */
  async getPlayerStats(req, res) {
    try {
      const { name } = req.params;
      const normalizedName = PlayerService.normalizeUsername(name);
      const { year } = req.query;
      const profile = await PlayerService.getPlayerProfile(normalizedName);
      const resolvedProfile = profile || (await PlayerService.findPlayerByPubgNick(name))?.profile;
      if (!resolvedProfile) {
        return res.status(404).json({ error: 'Player not found' });
      }

      let stats = await PlayerService.getPlayerStats(resolvedProfile.username || resolvedProfile.name, year || null);

      if (!stats) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const profileForRating = profile || await PlayerService.getPlayerProfile(PlayerService.normalizeUsername(resolvedProfile.username || resolvedProfile.name));
      const dnaRating = profileForRating?.dna_rating ?? null;
      if (Array.isArray(stats.core)) {
        const ratingMetric = stats.core.find((m) => m && m.id === 'rating');
        if (ratingMetric) {
          ratingMetric.value = dnaRating;
          ratingMetric.displayValue = dnaRating != null ? String(Math.round(dnaRating)) : '—';
        }
      }

      const playerId = resolvedProfile.username || resolvedProfile.name;
      const championships = await ChampionshipsService.getChampionships(playerId);
      res.json({ ...stats, championships });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/players/:name/years
   * Получить список доступных годов для статистики игрока
   */
  async getAvailableYears(req, res) {
    try {
      const { name } = req.params;
      const normalizedName = PlayerService.normalizeUsername(name);
      const profile = await PlayerService.getPlayerProfile(normalizedName);
      const resolvedProfile = profile || (await PlayerService.findPlayerByPubgNick(name))?.profile;
      if (!resolvedProfile) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const years = await PlayerService.getAvailableYears(resolvedProfile.username || resolvedProfile.name);
      res.json({ years });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/players/:name/championships
   * Получить чемпионства игрока (с backfill при отсутствии)
   */
  async getChampionships(req, res) {
    try {
      const { name } = req.params;
      const normalizedName = PlayerService.normalizeUsername(name);
      const profile = await PlayerService.getPlayerProfile(normalizedName);
      const resolvedProfile = profile || (await PlayerService.findPlayerByPubgNick(name))?.profile;
      if (!resolvedProfile) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const playerId = resolvedProfile.username || resolvedProfile.name || name;
      const championships = await ChampionshipsService.getChampionships(playerId);
      res.json(championships);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PlayerController();

