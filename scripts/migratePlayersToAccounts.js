const fs = require('fs');
const path = require('path');
const { playersDir } = require('../src/backend/config/dataPaths');

function migrate() {
  if (!fs.existsSync(playersDir)) {
    console.log('Players directory not found:', playersDir);
    return;
  }

  const files = fs.readdirSync(playersDir).filter((file) => file.endsWith('.json'));
  files.forEach((file) => {
    const filePath = path.join(playersDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return;

    const profile = JSON.parse(raw);
    const filenameBase = file.replace(/\.json$/, '');
    const username = (profile.username || profile.name || filenameBase).toLowerCase();
    const pubgNick = profile.pubgNick || profile.name || filenameBase;
    const email = profile.email || null;
    const emailVerified = Boolean(profile.emailVerified) && Boolean(email);
    const sessions = Array.isArray(profile.sessions) ? profile.sessions : [];

    const migrated = {
      ...profile,
      username,
      pubgNick,
      email,
      emailVerified,
      sessions,
      emailVerifyTokenHash: undefined,
      emailVerifyExpires: undefined
    };

    fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), 'utf8');
  });

  console.log(`Migrated ${files.length} profiles.`);
}

migrate();
