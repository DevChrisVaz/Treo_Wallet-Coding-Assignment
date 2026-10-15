import { defineConfig, devices } from '@playwright/test';

/*
 * Verificación de la compilación de producción (WEB-39, D12 de security-hardening): `next build` y
 * `next start` contra la API simulada, con la misma prueba de la política de contenido que corre en
 * desarrollo (`security-headers.spec.ts`), pero sin su excepción de `next-devtools`, que no existe
 * en producción. `next dev` y producción difieren (`unsafe-eval`, el HTML que Next.js genera), así
 * que solo esta corrida dice que lo que se despliega funciona. Puertos propios para no chocar con
 * `playwright.config.ts` (3101 y 4999).
 */
process.env.E2E_PROD = '1';
process.env.E2E_API_PORT = '4995';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'security-headers.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3105',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fake-api.mjs --port 4995',
      url: 'http://127.0.0.1:4995/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run build && npx next start --port 3105 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3105/login',
      reuseExistingServer: false,
      timeout: 300_000,
      // HTTP en local: con HTTPS la política agrega upgrade-insecure-requests y la cookie es Secure.
      env: {
        API_BASE_URL: 'http://127.0.0.1:4995',
        SESSION_COOKIE_SECURE: 'false',
        REDIS_URL: '',
      },
    },
  ],
});
