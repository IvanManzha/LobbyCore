// src/backend/auth/steam/steamClient.js
const SteamSignIn = require('steam-signin');
const axios = require('axios');

const REALM = process.env.STEAM_REALM; // https://backend.com
const API_KEY = process.env.STEAM_API_KEY; // optional

const signIn = REALM ? new SteamSignIn(REALM) : null;

function buildReturnUrl(req) {
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  return `${publicOrigin}${req.originalUrl}`;
}

function getAuthUrl(returnToUrl) {
  if (!signIn) throw new Error('STEAM_REALM is not configured');
  return signIn.getUrl(returnToUrl);
}

async function verifySteamLogin(req) {
  if (!signIn) throw new Error('STEAM_REALM is not configured');
  const returnUrl = buildReturnUrl(req);
  const steamIdObj = await signIn.verifyLogin(returnUrl);
  const steamId64 = steamIdObj.getSteamID64();
  return steamId64;
}

async function fetchSteamProfile(steamId64) {
  if (!API_KEY) {
    return { steamId64, personaName: null, avatar: null, profileUrl: null };
  }

  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${API_KEY}&steamids=${steamId64}`;
  const resp = await axios.get(url, { timeout: 8000 });
  const p = resp.data?.response?.players?.[0] || null;

  return {
    steamId64,
    personaName: p?.personaname || null,
    avatar: p?.avatarfull || p?.avatar || null,
    profileUrl: p?.profileurl || null
  };
}

module.exports = { getAuthUrl, verifySteamLogin, fetchSteamProfile };
