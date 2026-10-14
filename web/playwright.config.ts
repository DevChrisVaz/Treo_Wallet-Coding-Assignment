import { defineConfig, devices } from '@playwright/test';

/*
 * Pruebas en navegador real (WEB-23, WEB-24): lo que jsdom no puede medir (layout, display: none,
 * contraste). Levanta la API simulada con los datos de las historias y `next dev` contra ella.
 */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3101',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fake-api.mjs --port 4999',
      url: 'http://127.0.0.1:4999/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx next dev --port 3101 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3101/login',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_BASE_URL: 'http://127.0.0.1:4999', SESSION_COOKIE_SECURE: 'false' },
    },
  ],
});
