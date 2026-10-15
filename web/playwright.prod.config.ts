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
      // El build NO recibe SESSION_COOKIE_SECURE (en producción el valor por defecto es true) y el
      // servidor arranca con false: así la prueba detecta cualquier header que se decida en el build
      // en lugar de en ejecución (HSTS).
      command:
        'env -u SESSION_COOKIE_SECURE npm run build && SESSION_COOKIE_SECURE=false npx next start --port 3105 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3105/login',
      reuseExistingServer: false,
      timeout: 300_000,
      // HTTP en local (SESSION_COOKIE_SECURE=false se pasa solo a `next start`, ver el comando).
      env: {
        API_BASE_URL: 'http://127.0.0.1:4995',
        REDIS_URL: '',
      },
    },
  ],
});
