// scripts/deleteTeam.js
const fs = require('fs');
const path = require('path');

// Usage: node scripts/deleteTeam.js <tournamentId> "Team Name" [...]
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(`
Usage:
  node scripts/deleteTeam.js <tournamentId> "Team Name" [...]

Example:
  node scripts/deleteTeam.js budget_srazhenie "Alpha" "Bravo"
`);
  process.exit(1);
}

const tournamentId = args[0];
const filePath = path.join(__dirname, '..', 'data', 'tournaments', tournamentId, 'table.json');

if (!fs.existsSync(filePath)) {
  console.error(`\nError: Tournament table not found at ${filePath}\n`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

for (let i = 1; i < args.length; i++) {
  const teamName = args[i];
  const index = data.teams.findIndex(t => t.name === teamName);

  if (index === -1) {
    console.error(`Error: Team "${teamName}" not found.`);
    continue;
  }

  data.teams.splice(index, 1);
  console.log(`Team "${teamName}" has been deleted.`);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`\u2705 Teams deleted for tournament "${tournamentId}".`);