/**
 * Fetch PUBG telemetry from URL and save to storage.
 * Supports gzip response; saves decompressed JSON.
 */
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const {
  getPubgTelemetryPath,
  getPubgTelemetryDir,
  getPubgMatchDir,
  getPubgTelemetryGzipPath,
} = require('../../config/dataPaths');

/**
 * Download URL and return body (handles gzip).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      const chunks = [];
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      }
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
    req.on('error', reject);
  });
}

/**
 * Fetch telemetry JSON from URL and save to storage/pubg/telemetry/<matchId>.json.
 * If file already exists, skip download (cache).
 * @param {string} matchId
 * @param {string} telemetryUrl
 * @returns {Promise<{ cached: boolean, path: string }>}
 */
async function fetchAndSaveTelemetry(matchId, telemetryUrl) {
  const filePath = getPubgTelemetryPath(matchId);
  try {
    await fs.access(filePath);
    return { cached: true, path: filePath };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const buffer = await fetchUrl(telemetryUrl);
  const raw = buffer.toString('utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Telemetry for ${matchId} is not valid JSON`);
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 0), 'utf8');
  return { cached: false, path: filePath };
}

/**
 * Check if telemetry for matchId is already cached.
 * @param {string} matchId
 * @returns {Promise<boolean>}
 */
async function hasCachedTelemetry(matchId) {
  const filePath = getPubgTelemetryPath(matchId);
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return e.code === 'ENOENT' ? false : Promise.reject(e);
  }
}

/**
 * Fetch telemetry from URL and save as gzip to matches/<matchId>/telemetry.json.gz.
 * Idempotent: if file exists, skip download.
 * @param {string} matchId
 * @param {string} telemetryUrl
 * @returns {Promise<{ cached: boolean, path: string }>}
 */
async function fetchAndSaveTelemetryGzip(matchId, telemetryUrl) {
  const gzipPath = getPubgTelemetryGzipPath(matchId);
  try {
    await fs.access(gzipPath);
    return { cached: true, path: gzipPath };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  const matchDir = getPubgMatchDir(matchId);
  await fs.mkdir(matchDir, { recursive: true });

  const buffer = await fetchUrl(telemetryUrl);
  const raw = buffer.toString('utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Telemetry for ${matchId} is not valid JSON`);
  }
  const jsonString = JSON.stringify(data, null, 0);
  const gzipBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf8'));
  await fs.writeFile(gzipPath, gzipBuffer);
  return { cached: false, path: gzipPath };
}

/**
 * Check if gzip telemetry exists for matchId (feature store path).
 * @param {string} matchId
 * @returns {Promise<boolean>}
 */
async function hasCachedTelemetryGzip(matchId) {
  const gzipPath = getPubgTelemetryGzipPath(matchId);
  try {
    await fs.access(gzipPath);
    return true;
  } catch (e) {
    return e.code === 'ENOENT' ? false : Promise.reject(e);
  }
}

/**
 * Read and decompress telemetry from matches/<matchId>/telemetry.json.gz, return parsed JSON.
 * @param {string} matchId
 * @returns {Promise<Object|Array>}
 */
async function readTelemetryFromGzip(matchId) {
  const gzipPath = getPubgTelemetryGzipPath(matchId);
  const gzipBuffer = await fs.readFile(gzipPath);
  const raw = zlib.gunzipSync(gzipBuffer).toString('utf8');
  return JSON.parse(raw);
}

module.exports = {
  fetchUrl,
  fetchAndSaveTelemetry,
  hasCachedTelemetry,
  fetchAndSaveTelemetryGzip,
  hasCachedTelemetryGzip,
  readTelemetryFromGzip,
};
