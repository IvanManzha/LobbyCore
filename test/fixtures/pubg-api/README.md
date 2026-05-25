# Фикстуры PUBG API

Сырые ответы PUBG API для тестов и разработки алгоритмов подсчёта статистики.

## Файлы

| Файл | Описание |
|------|----------|
| `player-response.json` | Ответ `getPlayer(shard, "IVANCHK")` — профиль игрока и список матчей |
| `match-response.json` | Полный ответ `getMatch(shard, matchId)` — последний матч IVANCHK (100 участников) |
| `match-response-minimal.json` | Минимальный ответ матча: 2 участника (IVANCHK, Matey1995), 1 roster, 1 asset. Для юнит-тестов парсинга и сохранения |
| `meta.json` | Мета: playerName, shard, latestMatchId, дата дампа |

## Обновление фикстур (реальный API)

Требуется `PUBG_API_KEY` в `.env`:

```bash
node scripts/db_scripts/dump_pubg_api_response.js IVANCHK steam
```

Перезаписываются: `player-response.json`, `match-response.json`, `meta.json`.  
`match-response-minimal.json` не перезаписывается — это ручной мок для тестов.

## Использование в тестах

- Подменить `getMatch` / `getPlayer`: читать JSON из фикстур вместо вызова API.
- Проверять парсинг участников: `included.filter(i => i.type === 'participant')`, маппинг `attributes.stats` → поля БД (kills, damageDealt → damage, winPlace → placement и т.д.).
- Алгоритмы статистики (src/stats) работают с таблицами турниров (RawTable), а не с сырым API; эти фикстуры — источник данных для слоя «API → БД → table».

Подробнее: [docs/PUBG_API_STRUCTURE.md](../../../docs/PUBG_API_STRUCTURE.md).
