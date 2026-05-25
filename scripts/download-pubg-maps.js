#!/usr/bin/env node
/**
 * Скачивает карты из официального репозитория PUBG (pubg/api-assets).
 * Full: No_Text_Low_Res (~1 МБ). Preview: уменьшенная копия в maps/preview/.
 * @see https://github.com/pubg/api-assets/tree/master/Assets/Maps
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const BASE =
  'https://raw.githubusercontent.com/pubg/api-assets/master/Assets/Maps';

/** github filename → public/maps filename */
const MAPS = [
  ['Erangel_Main_No_Text_Low_Res.png', 'erangel.png'],
  ['Miramar_Main_No_Text_Low_Res.png', 'miramar.png'],
  ['Sanhok_Main_No_Text_Low_Res.png', 'sanhok.png'],
  ['Vikendi_Main_No_Text_Low_Res.png', 'vikendi.png'],
  ['Taego_Main_No_Text_Low_Res.png', 'taego.png'],
  ['Paramo_Main_No_Text_Low_Res.png', 'paramo.png'],
  ['Deston_Main_No_Text_Low_Res.png', 'deston.png'],
  ['Haven_Main_No_Text_Low_Res.png', 'haven.png'],
  ['Karakin_Main_No_Text_Low_Res.png', 'karakin.png'],
  ['Rondo_Main_No_Text_Low_Res.png', 'rondo.png'],
];

const PREVIEW_MAX_PX = 384;
const PREVIEW_JPEG_QUALITY = 42;
const outDir = path.join(__dirname, '..', 'public', 'maps');
const previewDir = path.join(outDir, 'preview');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`${url} → HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

function makePreview(fullPath, previewPath) {
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  if (process.platform === 'darwin') {
    execSync(
      `sips -Z ${PREVIEW_MAX_PX} -s format jpeg -s formatOptions ${PREVIEW_JPEG_QUALITY} "${fullPath}" --out "${previewPath}"`,
      { stdio: 'pipe' }
    );
    return;
  }
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const sharp = require('sharp');
    return sharp(fullPath)
      .resize(PREVIEW_MAX_PX, PREVIEW_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 55 })
      .toFile(previewPath);
  } catch {
    fs.copyFileSync(fullPath, previewPath);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });
  for (const [remote, local] of MAPS) {
    const url = `${BASE}/${remote}`;
    const dest = path.join(outDir, local);
    const previewDest = path.join(previewDir, local.replace(/\.png$/i, '.jpg'));
    process.stdout.write(`${local}… `);
    await download(url, dest);
    const kb = Math.round(fs.statSync(dest).size / 1024);
    process.stdout.write(`${kb} KB, preview… `);
    await makePreview(dest, previewDest);
    const pkb = Math.round(fs.statSync(previewDest).size / 1024);
    console.log(`${pkb} KB`);
  }
  console.log('Done:', outDir, '+', previewDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
