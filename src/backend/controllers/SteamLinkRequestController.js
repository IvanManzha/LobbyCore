/**
 * Запросы на привязку Steam к PUBG-профилю. Игрок создаёт запрос, админ одобряет/отклоняет.
 */
const SteamLinkRequestsService = require('../services/SteamLinkRequestsService');
const PlayerService = require('../services/PlayerService');
const { linkSteamToUser } = require('../auth/steam/steamLinking');

async function createRequest(req, res) {
  try {
    const username = req.user?.username;
    if (!username) {
      return res.status(401).json({ error: 'Необходима авторизация' });
    }
    const targetPubgNick = req.body?.targetPubgNick;
    if (!targetPubgNick || !String(targetPubgNick).trim()) {
      return res.status(400).json({ error: 'Укажите PUBG-ник профиля, к которому привязать Steam' });
    }

    const profile = await PlayerService.getPlayerProfile(username);
    if (!profile) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }
    if (!profile.steam?.steamId64) {
      return res.status(400).json({ error: 'К вашему аккаунту не привязан Steam. Сначала привяжите Steam в настройках или войдите через Steam.' });
    }

    const targetProfile = await PlayerService.findPlayerByPubgNick(targetPubgNick.trim());
    if (!targetProfile) {
      return res.status(404).json({ error: 'Профиль с таким PUBG-ником не найден' });
    }
    if (targetProfile.username === username) {
      return res.status(400).json({ error: 'Steam уже привязан к вашему профилю' });
    }

    const item = SteamLinkRequestsService.create(username, targetPubgNick.trim());
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function list(req, res) {
  try {
    const list = SteamLinkRequestsService.getAll();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function approve(req, res) {
  try {
    const { id } = req.params;
    const adminUsername = req.user?.username;
    const item = SteamLinkRequestsService.getById(id);
    if (!item) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    if (item.status !== 'pending') {
      return res.status(400).json({ error: 'Запрос уже обработан' });
    }

    const requesterProfile = await PlayerService.getPlayerProfile(item.requesterUsername);
    if (!requesterProfile?.steam?.steamId64) {
      SteamLinkRequestsService.setStatus(id, 'rejected', adminUsername);
      return res.status(400).json({ error: 'У заявителя больше нет привязанного Steam' });
    }

    const targetProfile = await PlayerService.findPlayerByPubgNick(item.targetPubgNick);
    if (!targetProfile) {
      SteamLinkRequestsService.setStatus(id, 'rejected', adminUsername);
      return res.status(400).json({ error: 'Целевой профиль не найден' });
    }

    const steamProfile = {
      steamId64: requesterProfile.steam.steamId64,
      personaName: requesterProfile.steam.personaName || null,
      avatar: requesterProfile.steam.avatar || null,
      profileUrl: requesterProfile.steam.profileUrl || null
    };

    await linkSteamToUser(targetProfile.username, steamProfile);
    SteamLinkRequestsService.setStatus(id, 'approved', adminUsername);

    res.json({ success: true, message: 'Steam привязан к профилю', request: SteamLinkRequestsService.getById(id) });
  } catch (e) {
    res.status(e.message === 'STEAM_ALREADY_LINKED' ? 409 : 500).json({
      error: e.message === 'STEAM_ALREADY_LINKED' ? 'Этот Steam уже привязан к другому профилю' : e.message
    });
  }
}

async function reject(req, res) {
  try {
    const { id } = req.params;
    const adminUsername = req.user?.username;
    const item = SteamLinkRequestsService.getById(id);
    if (!item) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    if (item.status !== 'pending') {
      return res.status(400).json({ error: 'Запрос уже обработан' });
    }
    SteamLinkRequestsService.setStatus(id, 'rejected', adminUsername);
    res.json({ success: true, request: SteamLinkRequestsService.getById(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  createRequest,
  list,
  approve,
  reject
};
