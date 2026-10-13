import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', native: 'src/native.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  platform: 'neutral',
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
});
