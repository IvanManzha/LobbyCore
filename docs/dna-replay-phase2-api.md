# DNA Replay — Phase 2 (данные для полного матча)

Текущий `GET /api/v1/dna/dna-map/session` (`getDnaMapSession`) строит сессию в основном **для primary (и опционально secondary) игрока**: треки и события ограничены разрешёнными `accountIds` из телеметрии.

Для полноценного **Tactical Replay Viewer** (все игроки/команды, зона по фазам, wipe) нужно одно из:

1. **Расширить ответ `DnaMapSession`** (или завести `DnaMapReplaySession`) полями:
   - `participants[]`: `{ accountId, label, teamId?, color? }`
   - `tracksByPlayer[]` или `tracks: Record<accountId, TrackPoint[]>`
   - `zonePhases[]`: `{ t, phaseIndex, safeCircle, blueCircle, nextSafeCircle? }` из телеметрии
   - `events[]` уже есть — расширить покрытием всех участников при необходимости

2. **Отдельный эндпоинт** `GET /api/v1/dna/dna-map/replay-session?matchId=...&useDnaTest=true` — тяжёлый ответ только для вкладки «Карта», с даунсэмплингом треков.

Реализация на бэкенде: повторно использовать парсинг телеметрии в [`DnaController.getDnaMapSession`](../src/backend/controllers/DnaController.js) и вынести экстракторы в сервисы (`replaySessionBuilder.js`).
