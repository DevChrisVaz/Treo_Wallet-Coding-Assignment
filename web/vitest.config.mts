import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': fromRoot('.'),
      // `server-only` lanza un error fuera de un build de React Server Components.
      'server-only': fromRoot('./test/support/empty-module.ts'),
    },
  },
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        // BFF, configuración y lógica sin DOM: *.test.ts en Node.
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: ['node_modules/**', '.next/**'],
        },
      },
      {
        // Componentes y pantallas: *.test.tsx en jsdom con Testing Library y vitest-axe.
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
          exclude: ['node_modules/**', '.next/**'],
          setupFiles: ['./test/setup-dom.ts'],
        },
      },
    ],
  },
});
