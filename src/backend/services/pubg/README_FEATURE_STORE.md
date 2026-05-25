# PUBG Feature Store (Telemetry → Metrics)

## Хранение

- **Телеметрия:** `data/pubg/matches/<matchId>/telemetry.json.gz`
- **Мета матча:** `data/pubg/matches/<matchId>/match.json`
- **Индекс:** `data/pubg/matches/<matchId>/telemetry.index.json`
- **Игроки:** `data/pubg/matches/<matchId>/players/<accountId>.features.json`, `.track.json`, `.events.json`

## Ingest

- API: `POST /api/v1/pubg/ingest` с телом `{ matchId [, shard ] }`
- Скрипт: `npm run ingest:match -- <matchId>` или `node scripts/ingestMatchFull.js <matchId> [shard]`

## Версия экстрактора

В каждом `players/<accountId>.features.json` записан `extractorVersion` (например `"1.0"`). При изменении логики экстракторов в `playerFeaturesExtractor.js` нужно увеличить `EXTRACTOR_VERSION` в этом файле. После этого повторный запуск ingest для нужных матчей перезапишет features (при idempotent ingest перезапись выполняется только если версия в файле не совпадает с текущей).

## DNA Map

При выборе матча «из хранилища» на странице DNA Map передаётся `source=file` в `GET /api/v1/dna/dna-map/session`; треки и события подставляются из `players/<accountId>.track.json` и `.events.json`.

Трек строится только после первого приземления (без самолёта и парашюта). После изменения логики треков пересоберите хранилище для уже загруженных матчей: `npm run ingest:reingest-all` (или по одному: `npm run ingest:match -- <matchId>`).
