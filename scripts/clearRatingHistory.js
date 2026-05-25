#!/usr/bin/env node
// scripts/clearRatingHistory.js

const fs   = require('fs');
const path = require('path');

const PLAYERS_DIR = path.join(__dirname, '..', 'data', 'players');

const files = fs.readdirSync(PLAYERS_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(PLAYERS_DIR, file);
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`❌ Ошибка чтения ${file}:`, e);
    continue;
  }

  if (Array.isArray(profile.ratingHistory)) {
    delete profile.ratingHistory;
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    console.log(`🗑️ Удалено ratingHistory из ${file}`);
  }
}

console.log('🎉 Очистка ratingHistory завершена.');
