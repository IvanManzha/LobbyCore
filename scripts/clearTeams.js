// scripts/clearTeams.js
const fs = require('fs');
const path = require('path');

// Usage: node scripts/clearTeams.js <tournamentId>
const [ , , tournamentId ] = process.argv;

if (!tournamentId) {
  console.error(`
Usage:
  node scripts/clearTeams.js <tournamentId>

Example:
  node scripts/clearTeams.js budget_srazhenie
`);
  process.exit(1);
}

const filePath = path.join(__dirname, '..', 'data', 'tournaments', tournamentId, 'table.json');

if (!fs.existsSync(filePath)) {
  console.error(`\nError: Tournament table not found at ${filePath}\n`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

data.teams = [];

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`\u2705 All teams have been cleared for tournament "${tournamentId}".`);