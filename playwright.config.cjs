const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', workers: 1,
  use: { baseURL: 'http://127.0.0.1:9123', browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'python3 server.py 9123', url: 'http://127.0.0.1:9123/api/health', reuseExistingServer: false }
});
