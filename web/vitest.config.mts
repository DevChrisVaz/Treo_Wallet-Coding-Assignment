import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only` lanza un error fuera de un build de React Server Components.
      'server-only': fileURLToPath(new URL('./test/support/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
