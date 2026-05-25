// src/backend/services/AdminScenariosService.js
const fs = require('fs').promises;
const path = require('path');
const { getAdminTournamentsPath, getAdminFeedPath, getAdminTournamentsDir } = require('../config/dataPaths');

function getPath() {
  return getAdminTournamentsPath();
}

function getFeedPath() {
  return getAdminFeedPath();
}

function getDir() {
  return getAdminTournamentsDir();
}

const PRESETS = {
  feed_basic: {
    id: 'feed_basic',
    name: 'Feed Basic',
    description: '2 турнира + 1 промо-пост в ленте',
    tournaments: [
      {
        name: 'Demo Solo',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        type: 'solo',
        rounds: 5,
        rules: 'Демо соло турнир',
        price: 0
      },
      {
        name: 'Demo Duo',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        type: 'duo',
        rounds: 5,
        rules: 'Демо дуо турнир',
        price: 0
      }
    ],
    feed: [
      {
        type: 'tournament',
        status: 'published',
        priority: 10,
        tournamentId: null,
        image: { url: '/assets/feed/covers/cover_default.svg', alt: 'Demo' },
        cta: { label: 'Регистрация', action: 'register' }
      },
      {
        type: 'promo',
        status: 'published',
        priority: 5,
        title: 'Демо промо',
        text: 'Тестовый промо-пост для ленты.',
        image: { url: '/assets/feed/covers/cover_default.svg', alt: 'Promo' },
        cta: { label: 'К турнирам', action: 'open', href: '/tournaments' }
      }
    ]
  },
  upcoming_week: {
    id: 'upcoming_week',
    name: 'Upcoming Week',
    description: 'Турнир на ближайшую неделю + пост в ленте',
    tournaments: [
      {
        name: 'Турнир на неделе',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        type: 'mixed',
        rounds: 5,
        rules: 'Турнир через несколько дней',
        price: 0
      }
    ],
    feed: [
      {
        type: 'tournament',
        status: 'published',
        priority: 10,
        tournamentId: null,
        image: { url: '/assets/feed/covers/cover_mixed.svg', alt: 'Турнир на неделе' },
        cta: { label: 'Регистрация', action: 'register' }
      }
    ]
  }
};

async function runPreset(presetId) {
  const p = getPath();
  const fp = getFeedPath();
  const dir = getDir();
  if (!p || !fp || !dir) {
    throw new Error('Admin dev data disabled. Set DEV_DATA=true.');
  }
  const preset = PRESETS[presetId];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}. Use: ${Object.keys(PRESETS).join(', ')}`);
  }

  const AdminTournamentService = require('./AdminTournamentService');
  const createdTournamentIds = [];

  for (const t of preset.tournaments) {
    const created = await AdminTournamentService.createTournament(t);
    createdTournamentIds.push(created.id);
  }

  const feedPosts = preset.feed.map((post, idx) => {
    const postCopy = { ...post };
    postCopy.id = `post_scenario_${presetId}_${Date.now()}_${idx}`;
    postCopy.createdAt = new Date().toISOString();
    postCopy.createdBy = 'scenario';
    if (postCopy.type === 'tournament' && createdTournamentIds.length > 0) {
      postCopy.tournamentId = createdTournamentIds[idx % createdTournamentIds.length] || createdTournamentIds[0];
    }
    return postCopy;
  });

  let existingFeed = [];
  try {
    const content = await fs.readFile(fp, 'utf-8');
    existingFeed = JSON.parse(content);
    if (!Array.isArray(existingFeed)) existingFeed = [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const newFeed = [...existingFeed, ...feedPosts];
  const feedDir = path.dirname(fp);
  try {
    await fs.mkdir(feedDir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  await fs.writeFile(fp, JSON.stringify(newFeed, null, 2), 'utf-8');

  return {
    presetId,
    tournamentsCreated: createdTournamentIds.length,
    feedPostsAdded: feedPosts.length
  };
}

function listPresets() {
  return Object.values(PRESETS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description
  }));
}

module.exports = {
  runPreset,
  listPresets,
  PRESETS
};
