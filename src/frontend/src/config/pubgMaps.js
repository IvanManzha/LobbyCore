/**
 * PUBG: соответствие внутренних имён карт (API/телеметрия), размеров координат и путей к фоновым картинкам.
 * Картинки: официальный репозиторий https://github.com/pubg/api-assets/tree/master/Assets/Maps
 * (скачивание: `node scripts/download-pubg-maps.js` → public/maps/*.png, No_Text_Low_Res).
 * Размеры (sizeCm): по документации telemetry Location — диапазон X/Y в см. (0,0) — верх-лево.
 * https://documentation.pubg.com/en/telemetry-objects.html (Location: 816000 Erangel/Miramar/Taego/Vikendi/Deston, 408000 Sanhok, 306000 Paramo, 204000 Karakin/Range, 102000 Haven)
 */
export const PUBG_MAP_ASSETS_REPO =
  'https://github.com/pubg/api-assets/tree/master/Assets/Maps';

/** Карта по умолчанию в DNA Lab (фон до выбора матча) */
export const DNA_LAB_DEFAULT_MAP_KEY = 'Chimera_Main';

function mapFiles(file) {
  const base = file.replace(/\.png$/i, '');
  return {
    mapImage: `/maps/${file}`,
    mapImagePreview: `/maps/preview/${base}.jpg`,
  };
}

export const PUBG_MAP_CONFIG = {
  Baltic_Main:   { displayName: 'Erangel (Remastered)', sizeCm: 816000, ...mapFiles('erangel.png') },
  Chimera_Main:  { displayName: 'Paramo',              sizeCm: 306000, ...mapFiles('paramo.png') },
  Desert_Main:   { displayName: 'Miramar',             sizeCm: 816000, ...mapFiles('miramar.png') },
  DihorOtok_Main: { displayName: 'Vikendi',             sizeCm: 816000, ...mapFiles('vikendi.png') },
  Erangel_Main:  { displayName: 'Erangel',            sizeCm: 816000, ...mapFiles('erangel.png') },
  Heaven_Main:   { displayName: 'Haven',               sizeCm: 102000, ...mapFiles('haven.png') },
  Kiki_Main:     { displayName: 'Deston',             sizeCm: 816000, ...mapFiles('deston.png') },
  Neon_Main:     { displayName: 'Rondo',               sizeCm: 816000, ...mapFiles('rondo.png') },
  Range_Main:    { displayName: 'Camp Jackal',         sizeCm: 204000, mapImage: null, mapImagePreview: null },
  Savage_Main:   { displayName: 'Sanhok',              sizeCm: 408000, ...mapFiles('sanhok.png') },
  Summerland_Main: { displayName: 'Karakin',           sizeCm: 204000, ...mapFiles('karakin.png') },
  Tiger_Main:    { displayName: 'Taego',               sizeCm: 816000, ...mapFiles('taego.png') },
};

/** Размер по умолчанию (Paramo), если карта не найдена в справочнике */
export const DEFAULT_MAP_SIZE_CM = 306000;

/** Алиасы: без _Main, lowercase, короткое имя → ключ конфига */
const MAP_NAME_ALIASES = {
  erangel: 'Erangel_Main',
  miramar: 'Desert_Main',
  vikendi: 'DihorOtok_Main',
  haven: 'Heaven_Main',
  deston: 'Kiki_Main',
  rondo: 'Neon_Main',
  sanhok: 'Savage_Main',
  savage: 'Savage_Main',
  karakin: 'Summerland_Main',
  taego: 'Tiger_Main',
  paramo: 'Chimera_Main',
  chimera: 'Chimera_Main',
  baltic: 'Baltic_Main',
  desert: 'Desert_Main',
  dihorotok: 'DihorOtok_Main',
  heaven: 'Heaven_Main',
  kiki: 'Kiki_Main',
  neon: 'Neon_Main',
  summerland: 'Summerland_Main',
  tiger: 'Tiger_Main',
};

/**
 * @param {string} apiMapName - значение mapName из телеметрии (напр. "Chimera_Main")
 * @returns {{ displayName: string, sizeCm: number, mapImage?: string | null, mapImagePreview?: string | null }}
 */
export function getMapInfo(apiMapName) {
  if (!apiMapName || typeof apiMapName !== 'string') {
    return { displayName: 'Unknown', sizeCm: DEFAULT_MAP_SIZE_CM, mapImage: null, mapImagePreview: null };
  }
  const raw = apiMapName.trim();
  let entry = PUBG_MAP_CONFIG[raw];
  if (entry) return entry;
  const withMain = raw.includes('_') ? raw : `${raw}_Main`;
  entry = PUBG_MAP_CONFIG[withMain];
  if (entry) return entry;
  const lower = raw.toLowerCase().replace(/-/g, '_');
  const aliasKey = MAP_NAME_ALIASES[lower] || MAP_NAME_ALIASES[raw.toLowerCase().replace(/_main$/, '')];
  if (aliasKey) return PUBG_MAP_CONFIG[aliasKey];
  for (const [k, v] of Object.entries(PUBG_MAP_CONFIG)) {
    if (k.toLowerCase() === lower || k.toLowerCase() === withMain.toLowerCase()) return v;
  }
  return { displayName: raw, sizeCm: DEFAULT_MAP_SIZE_CM, mapImage: null, mapImagePreview: null };
}

/** Preview + full URL для прогрессивного фона в DNA Lab */
export function getMapImageQualityUrls(apiMapName) {
  const info = getMapInfo(apiMapName || DNA_LAB_DEFAULT_MAP_KEY);
  const high = info.mapImage || null;
  const low = info.mapImagePreview || high;
  return { low, high, displayName: info.displayName };
}

/** Все URL картинок карт для предзагрузки в DNA Map */
export const DNA_MAP_IMAGE_URLS = Object.values(PUBG_MAP_CONFIG)
  .flatMap((c) => [c.mapImagePreview, c.mapImage].filter(Boolean));
