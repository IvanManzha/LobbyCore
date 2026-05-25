/**
 * Миграция: добавляет memberPayments в team-записи registration.entries.
 * - Если у team-entry нет memberPayments — добавляем {}.
 * - Если есть paidAt и нет memberPayments — бэкфилл: каждому участнику entryFeeDC (legacy «оплатил капитан за всех»).
 * Запуск: node scripts/migrate-team-entries-member-payments.js
 */
const path = require('path');
const repo = require('../src/backend/repositories/TournamentRepository');

async function run() {
  const tournaments = await repo.getAll();
  let updated = 0;
  for (const t of tournaments) {
    const entries = t.registration?.entries || [];
    if (entries.length === 0) continue;
    const finance = t.finance || t.extra?.finance;
    const entryFeeDC = finance?.entryFeeDC ?? 0;
    let changed = false;
    const newEntries = entries.map((e) => {
      if (e.kind !== 'team') return e;
      let memberPayments = e.memberPayments && typeof e.memberPayments === 'object' ? { ...e.memberPayments } : {};
      const members = e.members || (e.captainId ? [e.captainId] : []);
      if (e.paidAt && entryFeeDC > 0 && members.length > 0) {
        const hasAnyPayments = Object.values(memberPayments).some((v) => v > 0);
        if (!hasAnyPayments) {
          members.forEach((pid) => { memberPayments[pid] = entryFeeDC; });
          changed = true;
        }
      }
      if (!e.memberPayments || typeof e.memberPayments !== 'object') {
        changed = true;
      }
      return { ...e, memberPayments };
    });
    if (changed) {
      const newRegistration = { ...(t.registration || {}), entries: newEntries };
      await repo.update(t.id, { registration: newRegistration });
      updated += 1;
      console.log(`Updated tournament: ${t.id}`);
    }
  }
  console.log(`Done. Updated ${updated} tournaments.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
