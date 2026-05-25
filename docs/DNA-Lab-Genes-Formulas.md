# DNA Lab — расчёт генов: формулы и логика (7 генов, v2)

Документ описывает систему из **7 генов** (Combat, Pressure, Conversion, Survival, Positioning, Recovery, Teamwork), матчевый score [10–90], confidence и EMA-обновление. Исходный код: `src/backend/services/dna/dnaEngine.js` и `src/backend/services/dna/featureExtractor.js`.

---

## 1. Входные данные: вектор признаков матча (MatchFeatureVector v2)

Вектор извлекается из телеметрии PUBG для одного игрока и одного матча.

### Поля вектора v2

| Группа         | Поля                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Результат      | `teamRank`, `numStartTeams`, `individualRank`, `numStartPlayers`                                                                              |
| Время          | `timeAfterLandSec`, `timeAliveShare`, `timeToFirstEnemyContactAfterLand`, `survivalAfterFirstEnemyContactSec`, `matchDurationSec`             |
| Бой            | `shotsTotal`, `enemyHits`, `damageDealtLive`, `damageTakenEnemy`, `damageDealtTeam`, `kills`, `knocks`, `assists`, `revives`, `throwableUses` |
| Восстановление | `boostPointsAfterContact`, `healUsesAfterContact`, `recoveryAfterContactRatio`                                                                |
| Команда        | `teamKillParticipationHuman`, `friendlyFireIncidents`                                                                                         |
| Инициатива     | `firstOutgoingDamageSec`, `firstIncomingDamageSec`                                                                                            |
| Режим          | `isTeamMode`                                                                                                                                  |

Источники в телеметрии: LogPlayerPosition (land time), LogPlayerTakeDamage (урон, первый контакт, damageDealtTeam по teamId), LogPlayerMakeGroggy (knocks), LogItemUse (heal/boost/throwable), LogWeaponFireCount (shots), LogPlayerKill (kills, assists, team kills). При наличии загружается `match.json` для обогащения teamRank/numStartTeams и individualRank по участникам.

---

## 2. Константы движка (7 генов)

```text
GENE_KEYS = ['combat', 'pressure', 'conversion', 'survival', 'positioning', 'recovery', 'teamwork']

GENE_WEIGHTS (для DNA-рейтинга):
  combat: 1.1, pressure: 1, conversion: 1.1, survival: 1.05,
  positioning: 1.05, recovery: 1, teamwork: 1.05

DNA_RATING_MIN = 800
DNA_RATING_RANGE = 1400   // рейтинг в [800, 2200]

ALPHA = 0.18              // learning rate для EMA
GENE_MIN = 2, GENE_MAX = 98
```

---

## 3. Вспомогательные функции и величины (из вектора)

- **sat(x, K)** = clamp(x / K, 0, 1) — насыщение.
- **P_team** = 1 − (teamRank − 1) / (numStartTeams − 1)
- **P_ind** = 1 − (individualRank − 1) / (numStartPlayers − 1)
- **EarlySafe** = sat(timeToFirstEnemyContactAfterLand, 240)
- **PostFight** = sat(survivalAfterFirstEnemyContactSec, 180)
- **HitRate** = enemyHits / max(shotsTotal, 1)
- **DmgEff** = damageDealtLive / max(damageDealtLive + damageTakenEnemy, 1)
- **I** (инициатива): 1 если первый урон нанёс игрок, 0 если получил, 0.5 иначе (по firstOutgoingDamageSec / firstIncomingDamageSec).
- **H** (hotdrop fail): 1 если timeAfterLandSec < 45 и damageDealtLive = 0, иначе 0.

Индикаторы в формулах:

- **Z** = 1 если shotsTotal ≥ 20 и enemyHits = 0, иначе 0 (пустой спрей).
- **W** = 1 если damageDealtLive ≥ 120 и kills = 0 и knocks = 0, иначе 0 (не конвертировал урон).
- **R0** = 1 если damageTakenEnemy ≥ 80 и boostPointsAfterContact = 0 и recoveryAfterContactRatio < 0.05, иначе 0 (провал восстановления).

---

## 4. Матчевый score по генам (scoreMatchGenes)

Каждый score в диапазоне **[10, 90]**.

| Ген             | Формула (clamp(..., 10, 90))                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Combat**      | 36 + 18×sat(d_out,250) + 12×sat(hits,10) + 10×sat(k+0.5n,2) + 8×sat(HitRate,0.18) − 8×sat(d_team,50) |
| **Pressure**    | 42 + 12×(1−EarlySafe) + 10×sat(shots,80) + 8×sat(th,3) + 8×I + 8×sat(d_in,120) − 6×Z                 |
| **Conversion**  | 38 + 22×sat(k+0.7n,2) + 14×DmgEff + 8×sat(HitRate,0.18) − 10×W                                       |
| **Survival**    | 34 + 24×P_team + 10×P_ind + 10×sat(timeAliveShare,0.5) + 12×PostFight                                |
| **Positioning** | 36 + 20×EarlySafe + 18×P_team + 8×PostFight + 8×(1−I) − 12×H                                         |
| **Recovery**    | 40 + 16×sat(b_post,100) + 16×rec + 8×sat(d_in,150) + 8×PostFight − 10×R0                             |
| **Teamwork**    | 38 + 18×sat(a+r,2) + 16×sat(tkp,1) + 8×sat(k,2) − 18×sat(d_team,50) − 10×sat(ff,1)                   |

Обозначения: d_out = damageDealtLive, d_in = damageTakenEnemy, k = kills, n = knocks, a = assists, r = revives, th = throwableUses, b_post = boostPointsAfterContact, rec = recoveryAfterContactRatio, tkp = teamKillParticipationHuman, ff = friendlyFireIncidents.

---

## 5. Confidence по генам (getGeneConfidence)

Диапазон **[0.25, 1]**. Вес матча для обновления гена зависит от того, насколько матч информативен для этого гена.

| Ген             | Формула                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| **Combat**      | 0.25 + 0.75×sat(shots + 2×hits + d_out/12, 60)                                 |
| **Pressure**    | 0.30 + 0.70×sat(shots + 3×th + d_in/8, 70)                                     |
| **Conversion**  | 0.25 + 0.75×sat(d_out/20 + hits + 2×k + n, 35)                                 |
| **Survival**    | 0.50 + 0.50×sat(timeAliveShare, 0.5)                                           |
| **Positioning** | 0.35 + 0.65×sat(timeAfterLandSec/60 + timeToFirstEnemyContactAfterLand/120, 6) |
| **Recovery**    | 0.25 + 0.75×sat(d_in/20 + b_post/30 + 5×h_post, 20)                            |
| **Teamwork**    | 0.25 + 0.75×sat(6×(a+r) + 20×sat(tkp,1) + 15×ff, 40)                           |

---

## 6. Обновление гена (EMA)

**updateGenes(prevGenes, scores, confidence)**:

- G_new = clamp(G_prev + α × C × (S − G_prev), 2, 98)
- α = 0.18, C = confidence для данного гена, S = score матча для данного гена.

В соло (isTeamMode === false) ген **Teamwork** не обновляется (остаётся предыдущее значение).

---

## 7. Вычисление генов (computeGenes)

1. Начальное состояние: все гены = 50.
2. Для каждого матча по порядку:
   - scores = scoreMatchGenes(vector)
   - confidence = getGeneConfidence(vector)
   - currentGenes = updateGenes(currentGenes, scores, confidence)
   - matchGeneValues[i] = scores (для UI).
3. Финальные гены = currentGenes после последнего матча.
4. **Тренд**: разница между финальным значением и значением после предпоследнего матча, округление до 0.1.

Калибровка «первые N матчей» не используется — старт с 50 и EMA с первого матча.

---

## 8. DNA-рейтинг (800–2200)

**computeDnaRating(genes)**:

- По каждому гену: v = clamp(g.value, 0, 100), w = GENE_WEIGHTS[g.key].
- weightedAvg = Σ(v×w) / Σ(w)
- rating = DNA_RATING_MIN + (weightedAvg/100)×DNA_RATING_RANGE
- Итог: round(clamp(rating, 800, 2200)).

---

## 9. Уверенность профиля (computeConfidence)

**computeConfidence(matchesCount, coverage = 1)**:

- matchesCount ≥ 15: level = 0.95, label = 'high'
- 8 ≤ matchesCount < 15: level = 0.7, label = 'medium'
- 3 ≤ matchesCount < 8: level = 0.4, label = 'low'
- Иначе: level = 0, label = 'low'
- level умножается на coverage.

---

## 10. Версия формата и миграция

- В профиле сохраняется **genesVersion: 2** при построении через buildProfile (7 генов).
- При чтении профиля с 8 генами (старый формат) API возвращает 7 генов с дефолтными значениями и флаг **needsRecompute**. Рекомендуется пересчёт профиля через pipeline (extract + recompute).

---

## Сводка: 7 генов

| Ген         | Смысл                                                                         | Вес рейтинга |
| ----------- | ----------------------------------------------------------------------------- | ------------ |
| Combat      | Общий боевой импакт (урон, попадания, киллы/ноки, без френдли файра)          | 1.1          |
| Pressure    | Темп и инициатива (ранний контакт, стрельба, гранаты)                         | 1            |
| Conversion  | Конверсия контакта в результат (киллы, ноки, DmgEff)                          | 1.1          |
| Survival    | Глубина матча (placement, время жизни, жизнь после контакта)                  | 1.05         |
| Positioning | Качество входа в матч (EarlySafe, placement, не hotdrop fail)                 | 1.05         |
| Recovery    | Восстановление после давления (boost/heal после контакта, recovery ratio)     | 1            |
| Teamwork    | Польза команде (ассисты, ревайвы, участие в киллах, отсутствие френдли файра) | 1.05         |

Все формулы соответствуют реализации в `src/backend/services/dna/dnaEngine.js` и `src/backend/services/dna/featureExtractor.js`.
