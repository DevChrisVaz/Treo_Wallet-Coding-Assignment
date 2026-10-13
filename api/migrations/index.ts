import type { MigrationInterface } from 'typeorm';

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (sin globs) para que funcionen igual
 * con tsx, con el build y en las pruebas.
 */
export const migrations: (new () => MigrationInterface)[] = [];
