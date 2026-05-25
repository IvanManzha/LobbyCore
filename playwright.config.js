const path = require('node:path');

const dataDir = path.join(__dirname, 'test/fixtures/data');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './test/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'node src/backend/server.js',
      port: 3100,
      reuseExistingServer: true,
      env: {
        DATA_DIR: dataDir,
        NODE_ENV: 'e2e',
        PORT: '3100'
      }
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      port: 5173,
      reuseExistingServer: true,
      cwd: path.join(__dirname, 'src/frontend'),
      env: {
        VITE_API_URL: 'http://localhost:3100/api/v1'
      }
    }
  ]
};
