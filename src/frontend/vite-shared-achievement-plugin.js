import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHARED_ACHIEVEMENT_ID = '\0shared-achievement';
const SHARED_ACHIEVEMENT_REQUEST = '@shared/achievement/index.js';
const sharedDir = path.resolve(__dirname, '../shared/achievement');
const cjsEntry = path.join(sharedDir, 'index.js');

function isSharedAchievementRequest(source) {
  if (!source) return false;
  if (source === SHARED_ACHIEVEMENT_REQUEST) return true;
  const normalized = String(source).replace(/\\/g, '/');
  if (normalized.endsWith('shared/achievement/index.js')) return true;
  try {
    return path.normalize(source) === path.normalize(cjsEntry);
  } catch {
    return false;
  }
}

/** Убирает CJS require/module.exports — код остаётся в одном ESM-скоупе. */
function stripCjsModule(src) {
  let out = src;
  out = out.replace(/^const\s+\{[^}]+\}\s*=\s*require\s*\([^)]+\)\s*;?\s*$/gm, '');
  out = out.replace(/^const\s+\w+\s*=\s*require\s*\([^)]+\)\s*;?\s*$/gm, '');
  out = out.replace(/module\.exports\s*=\s*\{[\s\S]*?\}\s*;?\s*$/m, '');
  return out.trim();
}

function buildEsmBundle() {
  const loadOrder = ['history.js', 'cosmetics.js', 'catalog.js', 'evaluateAchievements.js'];
  const body = loadOrder
    .map((file) => stripCjsModule(fs.readFileSync(path.join(sharedDir, file), 'utf8')))
    .join('\n\n');

  const mod = require(cjsEntry);
  const exportNames = Object.keys(mod);

  return `${body}

const listBadgeAchievements = listBadgeCosmetics;
const listBackgroundAchievements = listBackgroundCosmetics;

export {
  ${exportNames.join(',\n  ')}
};

export default {
  ${exportNames.join(',\n  ')}
};
`;
}

/** Преобразует CJS shared/achievement в ESM для Vite/Rollup. */
export function sharedAchievementPlugin() {
  return {
    name: 'shared-achievement-cjs-bridge',
    enforce: 'pre',
    resolveId(source) {
      if (isSharedAchievementRequest(source)) {
        return SHARED_ACHIEVEMENT_ID;
      }
      return null;
    },
    load(id) {
      if (id !== SHARED_ACHIEVEMENT_ID) return null;
      return buildEsmBundle();
    },
  };
}
