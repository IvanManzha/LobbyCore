// knexfile.js
const path = require('path');

const migrations = { directory: path.join(__dirname, 'migrations') };

function sqliteFile(filename) {
  const f = filename || './data/pubg_app.db';
  return path.resolve(process.cwd(), f);
}

module.exports = {
  development: {
    client: 'sqlite3',
    connection: { filename: sqliteFile(process.env.SQLITE_PATH || './data/pubg_app.db') },
    useNullAsDefault: true,
    migrations
  },
  production: {
    client: 'sqlite3',
    connection: { filename: sqliteFile(process.env.SQLITE_PATH || './data/pubg_app.db') },
    useNullAsDefault: true,
    migrations
  },
  test: {
    client: 'sqlite3',
    connection: { filename: sqliteFile(process.env.SQLITE_PATH || './data/pubg_test.db') },
    useNullAsDefault: true,
    migrations
  },
  dna_test: {
    client: 'sqlite3',
    connection: {
      filename: sqliteFile(process.env.DNA_TEST_SQLITE_PATH || './data/pubg_dna_test.db')
    },
    useNullAsDefault: true,
    migrations
  }
};
