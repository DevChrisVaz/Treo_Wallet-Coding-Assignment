import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Frameworks, ORM y adaptadores que ni el dominio ni la aplicación pueden importar (PLT-18). */
const FRAMEWORKS = [
  'express',
  'express/*',
  'typeorm',
  'typeorm/*',
  'pg',
  'pg/*',
  'pino',
  'pino-http',
  'nodemailer',
  'swagger-ui-express',
  'express-rate-limit',
];

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Dominio: reglas puras. Solo puede importar el núcleo compartido y el dominio de otros módulos.
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FRAMEWORKS,
              message:
                'El dominio no depende del framework HTTP, del ORM ni de adaptadores (PLT-18).',
            },
            {
              group: ['**/application/**', '**/infrastructure/**', '**/platform/**'],
              message:
                'El dominio no importa las capas de aplicación, infraestructura ni plataforma.',
            },
          ],
        },
      ],
    },
  },
  {
    // Aplicación: casos de uso que dependen de puertos, nunca de adaptadores concretos.
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FRAMEWORKS,
              message:
                'La aplicación depende de puertos, no del framework HTTP ni del ORM (PLT-18).',
            },
            {
              group: ['**/infrastructure/**', '**/platform/http/**', '**/platform/persistence/**'],
              message: 'La aplicación no importa adaptadores de infraestructura.',
            },
          ],
        },
      ],
    },
  },
);
