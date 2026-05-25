// src/backend/auth/steam/steamRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getAuthUrl, verifySteamLogin, fetchSteamProfile } = require('./steamClient');
const { findOrCreateFromSteam } = require('./steamLinking');
const { put, take } = require('./authCodeStore');
const { verifyToken, issueJwtForProfile } = require('../../middleware/jwtAuth');
const PlayerService = require('../../services/PlayerService');
const PlayerController = require('../../controllers/PlayerController');

const router = express.Router();
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'http://localhost:3100';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const STATE_TTL_SEC = 300;

function createState(payload) {
  return jwt.sign(
    { ...payload, purpose: 'steam_state' },
    JWT_SECRET,
    { expiresIn: STATE_TTL_SEC }
  );
}

function verifyState(token) {
  const data = jwt.verify(token, JWT_SECRET);
  if (data.purpose !== 'steam_state') throw new Error('BAD_STATE');
  return data;
}

router.get('/start', async (req, res) => {
  try {
    const returnTo = req.query.returnTo || '/';
    const state = createState({ flow: 'login', returnTo });
    const callbackUrl = `${PUBLIC_ORIGIN}/auth/steam/callback?state=${encodeURIComponent(state)}`;
    const url = getAuthUrl(callbackUrl);
    return res.redirect(url);
  } catch (error) {
    return res.redirect(`${FRONTEND}/login?steamError=1`);
  }
});

router.post('/link-url', verifyToken, async (req, res) => {
  try {
    const returnTo = req.body?.returnTo || req.query?.returnTo || '/settings';
    const linkUserId = req.user?.username;
    if (!linkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const state = createState({ flow: 'link', returnTo, linkUserId });
    const callbackUrl = `${PUBLIC_ORIGIN}/auth/steam/callback?state=${encodeURIComponent(state)}`;
    const url = getAuthUrl(callbackUrl);
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const stateRaw = req.query.state;
    if (!stateRaw) return res.status(400).send('Missing state');
    const state = verifyState(stateRaw);

    const steamId64 = await verifySteamLogin(req);
    const steamProfile = await fetchSteamProfile(steamId64);
    steamProfile.steamId64 = String(steamId64);

    const { profile } = await findOrCreateFromSteam({
      steamProfile,
      flow: state.flow,
      linkUserId: state.linkUserId
    });

    const code = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    put(code, { profileUsername: profile.username, returnTo: state.returnTo || '/' });

    return res.redirect(`${FRONTEND}/auth/steam?code=${encodeURIComponent(code)}`);
  } catch (error) {
    return res.redirect(`${FRONTEND}/login?steamError=1`);
  }
});

router.post('/exchange', async (req, res) => {
  try {
    const { code } = req.body || {};
    const payload = take(code);
    if (!payload) return res.status(400).json({ error: 'INVALID_CODE' });

    const profile = await PlayerService.getPlayerProfile(payload.profileUsername);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { token, expiresIn } = issueJwtForProfile(profile);
    const sanitized = PlayerController.sanitizeProfile(profile);

    return res.json({
      profile: sanitized,
      token,
      expiresIn,
      returnTo: payload.returnTo || '/'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
