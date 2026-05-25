// src/backend/auth/steam/steamLinking.js
const PlayerService = require('../../services/PlayerService');

async function findBySteamId(steamId64) {
  const result = await PlayerService.findPlayerBySteamId(steamId64);
  return result?.profile || null;
}

async function linkSteamToUser(username, steamProfile) {
  const profile = await PlayerService.getPlayerProfile(username);
  if (!profile) throw new Error('USER_NOT_FOUND');

  const already = await PlayerService.findPlayerBySteamId(steamProfile.steamId64);
  if (already && already.username !== username) {
    throw new Error('STEAM_ALREADY_LINKED');
  }

  const linkedAt = new Date().toISOString();
  const steam = {
    steamId64: steamProfile.steamId64,
    personaName: steamProfile.personaName || null,
    avatar: steamProfile.avatar || null,
    profileUrl: steamProfile.profileUrl || null,
    linkedAt
  };

  await PlayerService.updatePlayerProfile(username, { steam });
  return PlayerService.getPlayerProfile(username);
}

async function findOrCreateFromSteam({ steamProfile, flow, linkUserId }) {
  // 1) already linked
  const existing = await findBySteamId(steamProfile.steamId64);
  if (existing) return { profile: existing, linked: true };

  // 2) explicit link flow (привязка из настроек)
  if (flow === 'link' && linkUserId) {
    const linkedProfile = await linkSteamToUser(linkUserId, steamProfile);
    return { profile: linkedProfile, linked: true };
  }

  // 3) create new user (привязка к существующему PUBG-профилю только через запрос админу)
  const newProfile = await PlayerService.createPlayerFromSteam(steamProfile);
  return { profile: newProfile, linked: false };
}

module.exports = { findOrCreateFromSteam, linkSteamToUser };
