# Система изменения Ladder Rating (Ladder Update)

Документ описывает обновление Ladder после турниров, формулы, сезонность и антидоминаторные механики. Реализация: [LadderService.js](../src/backend/services/LadderService.js).

---

## 1. Когда обновляется Ladder

**Один раз после каждого завершённого турнира** (не после каждого матча). Вызов: `LadderService.updateAfterTournament(tournamentId)` (например из хука закрытия турнира).

---

## 2. Формулы

- **ActualScore:** `(1 - (place - 1) / (N - 1))^γ`, γ = 0.7. Место 1 → 1.0, последнее → 0.0.
- **ExpectedScore:** по силе команды до турнира. TeamStrength = среднее DNA состава; команды сортируются по силе → expectedRank → `ExpectedScore = 1 - (expectedRank - 1) / (N - 1)`.
- **Bonus:** бонус/штраф за личный performance в турнире (placement/kills), clamp ±5, β ≈ 8.
- **DeltaLadder:** `K_tour * (ActualScore - ExpectedScore) + Bonus`.
- **Ladder_new:** `clamp(Ladder_old + DeltaLadder, LadderMin, LadderMax)` (0–2500, старт 1200).

**K_tour:** вес турнира (например 20 — small cup, 30 — standard, 40 — major). Задаётся в `tournament.extra.tournamentWeight` или `tournament.tournamentWeight`.

**Поведение γ:** γ < 1 (0.7) — топ-места ценятся выше; γ = 1 — линейная шкала.

---

## 3. Влияние места в турнире

- 1-е место даёт рост; величина зависит от ExpectedScore (фаворит — умеренный, аутсайдер — большой).
- Топ-3/топ-5 хорошо награждаются.
- Середина — небольшие или нейтральные изменения.
- Низкие места — минус, особенно при высоком ExpectedScore (провал фаворита).

---

## 4. Сезонность (soft reset)

**Формула:** `Ladder_newSeason = Base + resetFactor * (Ladder_oldSeason - Base)`, Base = 1200, resetFactor = 0.5.

**Реализация:** `LadderService.runSeasonalSoftReset(oldSeasonId, newSeasonId)`. Для каждого игрока в старом сезоне: сохраняется previous_season_rating = старый рейтинг; новый рейтинг записывается в запись сезона newSeasonId.

**Вызов:** вручную (скрипт или админ): `POST /api/v1/ladder/seasonal-reset` с телом `{ oldSeasonId: "2025", newSeasonId: "2026" }` (требуется авторизация админа). Либо по расписанию/cron.

---

## 5. Проблема доминирующего лидера

**Что уже ограничивает:** высокий ExpectedScore → за ожидаемую победу прирост небольшой; за провал — заметный минус. Дополнительные механики не обязательны с первого дня.

**Возможные механики (внедрять при реальной необходимости):**

- **Soft top resistance:** при Ladder > порога (например 1700) положительный Delta умножать на 0.85–0.9.
- **Inactivity decay для топа:** если игрок из top-X не участвовал N дней — плавное снижение к baseline.
- **Более сильный сезонный reset:** уменьшить resetFactor (например 0.4).

**Не делать:** искусственные штрафы за сам факт лидерства, отрицательный бонус за победы только из-за силы игрока.

---

## 6. UI изменений Ladder

- **Профиль:** Ladder Rating, Ladder Rank, Last delta, разбивка последнего турнира (old → new, delta). Данные разбивки: `profile.ladder_last_breakdown` (ladder_before, ladder_after, delta, actual_score, expected_score, bonus).
- **Leaderboard:** текущий ladder, last delta.
- **После турнира:** разбивка доступна через историю и в профиле игрока.

---

## 7. История и разбивка

- Каждое изменение пишется в `player_ladder_history` (ladder_before, ladder_after, delta, actual_score, expected_score, bonus, tournament_id, occurred_at).
- Для отображения в профиле: `LadderService.getLadderChangeBreakdown(playerId, seasonId)` возвращает последнюю запись истории.

---

## 8. Константы (LadderService)

- LADDER_MIN = 0, LADDER_MAX = 2500, LADDER_START = 1200
- GAMMA = 0.7, BETA = 8, BONUS_CLAMP = 5, K_TOUR_DEFAULT = 30
- SEASONAL_RESET_BASE = 1200, SEASONAL_RESET_FACTOR = 0.5
