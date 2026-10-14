import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const NO_FLOAT_AMOUNTS =
  'Los montos son strings decimales: usa formatMXN, amountInput o toCents del contrato, nunca floats (WEB-21).';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Ningún monto pasa por un número de punto flotante (D10 de web-app).
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='parseFloat']", message: NO_FLOAT_AMOUNTS },
        {
          selector:
            "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']",
          message: NO_FLOAT_AMOUNTS,
        },
        { selector: "CallExpression[callee.name='Number']", message: NO_FLOAT_AMOUNTS },
        { selector: "NewExpression[callee.name='Number']", message: NO_FLOAT_AMOUNTS },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    '.ds-sync/**',
    'ds-bundle/**',
    '.design-sync/**',
  ]),
]);
