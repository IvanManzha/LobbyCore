# Система отображения игрока (Player Display)

Документ описывает роли DNA Lab, DNA Score, Dominant Trait (Archetype) и Ladder, правила отображения по экранам и иерархию информации. Реализация: backend — [LadderService.js](../src/backend/services/LadderService.js), [dnaEngine.js](../src/backend/services/dna/dnaEngine.js), [archetype.js](../src/backend/services/dna/archetype.js); формулы DNA — [DNA-Lab-Genes-Formulas.md](DNA-Lab-Genes-Formulas.md).

---

## 1. Роли сущностей

| Сущность                        | Роль                               | Вопрос                                           |
| ------------------------------- | ---------------------------------- | ------------------------------------------------ |
| **Ladder Rank + Ladder Rating** | Основной соревновательный статус   | Насколько высоко игрок в турнирной лестнице      |
| **Dominant Trait (Archetype)**  | Краткий «тип игрока», идентичность | Что это за игрок по стилю                        |
| **DNA Score**                   | Аналитическая оценка скилла        | Насколько силён по skill-профилю (агрегат генов) |
| **Гены**                        | Детализация профиля                | Из чего состоит профиль (в DNA Lab)              |

**Принцип:** не смешивать DNA и Ladder в одном «главном числе»; Ladder — публичный соревновательный статус, DNA — аналитика и глубина.

---

## 2. DNA Lab (экран)

**Назначение:** «лаборатория игрока» — глубокий разбор, а не ещё один рейтинг.

**Показывается:**

- Все 7 генов (значения, тренды), визуализация (radar, bars, карточки).
- DNA Score (агрегат 800–2200).
- Dominant Trait / Archetype.
- Сильные и слабые гены (Strongest / Weakest).

Ladder на DNA Lab допустим в шапке, но не главный акцент.

---

## 3. DNA Score

- **Где показывать:** DNA Lab, профиль игрока, сравнение, team builder.
- **Где не перегружать:** общий leaderboard (вторично/бейдж), турнирная таблица (не большая цифра).
- Формула: см. [DNA-Lab-Genes-Formulas.md](DNA-Lab-Genes-Formulas.md) и `dnaEngine.computeDnaRating(genes)`.

---

## 4. Dominant Trait (Archetype)

**Сущность:** один «тип игрока» по генам, не число. Цель — быстро и запоминаемо описать стиль.

**Определение:** модуль [archetype.js](../src/backend/services/dna/archetype.js) — `archetypeFromGenes(genes)`. Правила в порядке приоритета (первое сработавшее), порог «высокий» = 65. Примеры: Aggressor, Closer, Survivor, Anchor, Tactician, Support, Skirmisher, Finisher, Stabilizer, All-Rounder.

**Хранение:** при обновлении DNA сохраняется в `player_profiles.dominant_trait` ([dnaRatingPersistence.js](../src/backend/services/dna/dnaRatingPersistence.js)).

**Отображение:** DNA Lab, профиль, общий leaderboard, турнирная таблица.

---

## 5. Правила по экранам

| Экран             | Ladder Rank | Ladder Rating | DNA Score        | Dominant Trait | Гены             |
| ----------------- | ----------- | ------------- | ---------------- | -------------- | ---------------- |
| DNA Lab           | опционально | опционально   | да, главное      | да             | да, все          |
| Профиль           | да          | да            | да               | да             | ссылка в DNA Lab |
| Общий leaderboard | да          | да            | вторично (бейдж) | да             | нет              |
| Турнирная таблица | да          | **нет**       | нет              | да             | нет              |
| Team Builder      | да          | опционально   | да               | да             | по необходимости |

**Иерархия в профиле:** 1) Имя → 2) Ladder Rank + Ladder Rating → 3) Dominant Trait → 4) DNA Score → 5) Ссылка «DNA Lab →».

---

## 6. Примеры UI

- **Профиль:** IVANCHK | Gold II · 1462 | Archetype: Closer | DNA Score: 1680 | DNA Lab →
- **Leaderboard:** #4 IVANCHK | Gold II | 1462 | Closer
- **Турнирная таблица:** IVANCHK | Gold II | Closer (без числового Ladder Rating)

---

## 7. Продуктовое обоснование

- Два равноправных больших числа (DNA и Ladder) везде создают путаницу; разведение по ролям снижает нагрузку.
- Dominant Trait делает DNA человечным и даёт быстрый «якорь» в таблицах.
- Турнирная таблица остаётся чище без числового Ladder Rating; ранг и архетип достаточны.
- Archetype — мост между аналитикой и живым восприятием игрока.
