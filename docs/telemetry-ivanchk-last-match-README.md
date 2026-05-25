# Телеметрия одного матча (IVANCHK)

Полные ответы телеметрии PUBG после одного матча. Примеры по матчам игрока **IVANCHK** из тестовой выборки DNA.

## Файлы

| Файл                                   | Матч                             | matchId                                | Размер |
| -------------------------------------- | -------------------------------- | -------------------------------------- | ------ |
| `telemetry-ivanchk-last-match.json`    | Последний (Match 5, order 4)     | `d8671a06-36ad-4760-81ea-3963236b5a1f` | ~10 MB |
| `telemetry-ivanchk-prelast-match.json` | Предпоследний (Match 4, order 3) | `dfecf657-f11d-4613-933d-6d2abc5aa51f` | ~29 MB |

Режим (из `LogMatchDefinition.MatchId`): squad-fpp. Дата матчей — по полю `_D` в событиях.

## Формат

JSON-массив событий. Каждое событие содержит как минимум:

- `_T` — тип события (например `LogMatchDefinition`, `LogPlayerCreate`, `LogPlayerTakeDamage`, `LogPlayerKill`, `LogPlayerPosition` и т.д.)
- `_D` — время в ISO 8601

Исходники лежат в `data/pubg/telemetry/<matchId>.json`; копии в `docs/` для удобства просмотра и примеров.

**Список последних матчей (формат под 20 матчей):** см. `docs/last-20-matches-ivanchk.json` — в данных сейчас 5 матчей IVANCHK; при синхронизации с API можно получить до 20.
