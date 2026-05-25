# Структура данных PUBG API

Документ описывает ответы PUBG API (getPlayer, getMatch) на основе последнего матча игрока **IVANCHK** (matchId: `b00cee06-a828-4aab-8a29-0ab6ddcc20b2`). Эти данные используются для алгоритмов подсчёта статистики и моков в тестах.

---

## Эндпоинты

| Метод | URL | Назначение |
|-------|-----|------------|
| `getPlayer(shard, playerName, true)` | `GET /shards/{shard}/players?filter[playerNames]=...` | Профиль игрока и список матчей |
| `getPlayerMatchList(shard, playerName)` | то же + разбор `relationships.matches` | Массив ID последних матчей |
| `getMatch(shard, matchId)` | `GET /shards/{shard}/matches/{matchId}` | Полные данные матча и участников |
| `getTelemetry(asset.attributes.URL)` | GET по URL из `included[type=asset]` | Сырая телеметрия (опционально) |

Регион/платформа: `shard` (например `steam`). Заголовки: `Authorization: Bearer <PUBG_API_KEY>`, `Accept: application/vnd.api+json`.

---

## 1. Ответ getPlayer

**Пример:** `test/fixtures/pubg-api/player-response.json`

```json
{
  "data": [
    {
      "type": "player",
      "id": "account.4920d2d8ce45415fb828afe4a500a2ec",
      "attributes": {
        "name": "IVANCHK",
        "stats": null,
        "titleId": "pubg",
        "shardId": "steam",
        "patchVersion": "",
        "banType": "Innocent",
        "clanId": "clan.41d77b6738b04c29a31457093ff11f1d"
      },
      "relationships": {
        "matches": {
          "data": [
            { "type": "match", "id": "b00cee06-a828-4aab-8a29-0ab6ddcc20b2" },
            { "type": "match", "id": "293c335b-c896-4981-8843-c3359d54e3b3" }
          ]
        },
        "assets": { "data": [] }
      }
    }
  ],
  "links": { "self": "...", "schema": "" },
  "meta": {}
}
```

**Использование в коде:**

- Игрок: `data[0]` (или `data` если приходит один объект).
- UUID игрока: `data[0].id` или `data[0].attributes` (для маппинга с участниками матча не обязателен, т.к. в participant есть `name` и `playerId`).
- Список матчей: `player.relationships.matches.data` → массив `{ type, id }`; порядок — от последнего к более старым.

---

## 2. Ответ getMatch

**Пример:** `test/fixtures/pubg-api/match-response.json`, краткий мок: `match-response-minimal.json`.

### 2.1. Корневой объект матча — `data`

| Поле | Тип | Описание |
|------|-----|----------|
| `data.type` | string | `"match"` |
| `data.id` | string | UUID матча |
| `data.attributes` | object | Метаданные матча (см. ниже) |
| `data.relationships` | object | Ссылки на `rosters` и `assets` |
| `included` | array | Объекты типов `roster`, `participant`, `asset` |

### 2.2. data.attributes (матч)

| Ключ | Тип | Пример | Описание |
|------|-----|--------|----------|
| `createdAt` | string (ISO 8601) | `"2026-01-23T18:21:10Z"` | Время создания матча (для фильтра по турниру) |
| `mapName` | string | `"Baltic_Main"` | Карта |
| `gameMode` | string | `"duo-fpp"` | Режим: solo/solo-fpp, duo/duo-fpp, squad/squad-fpp |
| `duration` | number | `1633` | Длительность в секундах |
| `isCustomMatch` | boolean | `false` | Кастомный матч или нет |
| `matchType` | string | `"official"` | Тип матча |
| `titleId` | string | `"bluehole-pubg"` | Идентификатор игры |
| `shardId` | string | `"steam"` | Шард |
| `seasonState` | string | `"progress"` | Состояние сезона |
| `stats` | any | `null` | На уровне матча часто null |
| `tags` | any | `null` | Теги |

**Использование в приложении:**

- Сохранение матча в БД: `match_id`, `map_name` ← `mapName`, `played_at` ← `createdAt`, `shard`.
- Алгоритмы статистики турнира опираются на таблицы турнира (table.json), а не напрямую на API; матч из API превращается в участников (participants) и привязывается к турниру.

### 2.3. included: типы roster, participant, asset

- **roster** — команда/группа в матче: `attributes.stats.rank`, `attributes.stats.teamId`, `attributes.won`, `relationships.participants.data` (ссылки на participant).
- **participant** — игрок в матче; все поля статистики в `attributes.stats` (см. таблицу ниже).
- **asset** — один объект с телеметрией: `attributes.URL` — ссылка на JSON телеметрии.

### 2.4. participant.attributes.stats (полный набор полей)

На основе последнего матча IVANCHK (duo-fpp, Baltic_Main):

| Поле | Тип | Пример (IVANCHK) | Описание |
|------|-----|------------------|----------|
| `name` | string | `"IVANCHK"` | Ник в игре |
| `playerId` | string | `"account.4920d2d8ce45415fb828afe4a500a2ec"` | UUID аккаунта |
| `kills` | number | `0` | Убийства |
| `assists` | number | `0` | Помощь в убийстве |
| `damageDealt` | number | `75` | Нанесённый урон |
| `winPlace` | number | `23` | Место (1 = победа) |
| `DBNOs` | number | `1` | Knockdowns (положил, но не добил) |
| `headshotKills` | number | `0` | Убийства в голову |
| `heals` | number | `4` | Использовано хилов |
| `boosts` | number | `2` | Использовано бустов |
| `timeSurvived` | number | `400` | Время в секундах |
| `killPlace` | number | `56` | Место по киллам среди всех |
| `killStreaks` | number | `0` | Серия убийств подряд |
| `longestKill` | number | `0` | Дальность самого длинного килла (м) |
| `revives` | number | `0` | Поднял союзников |
| `roadKills` | number | `0` | Убийства транспортом |
| `teamKills` | number | `0` | Убийства тиммейтов |
| `vehicleDestroys` | number | `0` | Уничтожено транспорта |
| `walkDistance` | number | `878.86145` | Пройдено пешком (м) |
| `rideDistance` | number | `0` | Расстояние на транспорте (м) |
| `swimDistance` | number | `0` | Плавание (м) |
| `weaponsAcquired` | number | `3` | Подобранного оружия |
| `deathType` | string | `"byplayer"` | Причина смерти: byplayer, alive, suicide и т.д. |

**Использование в коде (MatchMonitorService, fetch_And_Save_Match):**

- В БД участников сохраняются: `player_id` ← `playerId`, `player_name` / `api_name` ← `name`, `team_id` ← `teamId` (из roster, не из participant), `kills`, `damage` ← `damageDealt`, `placement` ← `winPlace`.
- В JSON `stats` сохраняются доп. поля: `assists`, `timeSurvived`, `headshotKills` (и при необходимости можно добавить остальные из таблицы выше для будущих алгоритмов).

---

## 3. Маппинг API → БД и таблицы турнира

1. **Матч:**  
   `data.attributes` → `matches`: `match_id`, `map_name`, `played_at`, `shard`, опционально `telemetry` из `getTelemetry(asset.attributes.URL)`.

2. **Участники:**  
   `included` где `type === 'participant'` → `participants`:  
   `player_id`, `api_name`, `player_name` из `stats`; `kills`, `damageDealt` → `damage`, `winPlace` → `placement`; в `stats` (JSON) — `assists`, `timeSurvived`, `headshotKills`.

3. **Турнирная таблица (table.json):**  
   Обновляется на основе сохранённых матчей и команд турнира: по `player_name` сопоставляются игроки, для каждого раунда заполняются `results[round].placement`, `results[round].kills`, `playerKills`, при необходимости `playerDeaths`.

4. **Алгоритмы статистики (src/stats):**  
   Работают с уже нормализованными данными: турниры, таблицы (RawTournament, RawTable), а не с сырым ответом PUBG. Из таблицы извлекаются раунды, места, киллы, смерти, очки по правилам турнира (scoring). То есть цепочка: **PUBG API → матч + участники → БД → table.json → buildPlayerStats / buildTournamentLeaderboard**.

---

## 4. Моки для тестов

- **Полный ответ матча:** `test/fixtures/pubg-api/match-response.json` (реальный ответ для IVANCHK, 100 участников).
- **Минимальный матч:** `test/fixtures/pubg-api/match-response-minimal.json` — тот же контракт, 2–3 участника (включая IVANCHK), один roster и один asset, для юнит-тестов парсинга и сохранения.
- **Профиль игрока:** `test/fixtures/pubg-api/player-response.json`.
- **Мета:** `test/fixtures/pubg-api/meta.json` — playerName, shard, latestMatchId, дата дампа.

Обновить фикстуры (получить свежий последний матч):

```bash
node scripts/db_scripts/dump_pubg_api_response.js IVANCHK steam
```

---

## 5. Алгоритмы подсчёта статистики (кратко)

- **Турнирные очки:** из `table.json`: `scoring.placement[placement] + kills * scoring.per_kill` по каждому раунду.
- **K/D, топ-N, стабильность и т.д.:** в `src/stats` (computePlayerStats, normalize) — по нормализованным матчам игрока (placement, kills, deaths, participantsCount) из таблиц турниров, без прямого чтения PUBG API.
- **Доп. метрики из API:** при необходимости можно расширить сохранение `participants.stats` (timeSurvived, headshotKills, DBNOs, revives и т.д.) и считать на их основе отдельные метрики в следующих итерациях.
