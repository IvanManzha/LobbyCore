# Результаты сценариев A–H (автоматизированная проверка)

Сценарии из плана аудита покрыты интеграционными тестами в `src/backend/tests/`.

| # | Сценарий | Тест / статус |
|---|----------|----------------|
| A | Solo: pot, payout 50/35/15 | `finance-payout-split.test.js` — breakdown сумма = доля места |
| B | Team leave >4h: 100% refund | `finance-leave-team.test.js` — 2 refund по 100%, `skipRefund` в removeTeam |
| C | Team leave без двойного ledger | `finance-leave-team.test.js` — ровно 2 записи REFUND |
| D | Отмена турнира | `refundTournamentCancellation` — покрыть при расширении finance-integration |
| E | <3 команд | `finance-payout-split.test.js` — 2 команды, 3-я доля не в lines |
| F | per_player не превышает pot | `splitAmountPerPlayer` + payout batch line amount |
| G | entries → teams при старте | `tournament-sync-teams.test.js` |
| H | reconcile ledger | `finance-banking.test.js` |

Ручной прогон на локали: `npm run test:setup && npm run test:backend`.
