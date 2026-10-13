import type { EntitySchema } from 'typeorm';

/**
 * Entidades de TypeORM definidas con `EntitySchema` (sin decoradores) en la infraestructura de cada
 * módulo. El dominio no las conoce.
 */
export const entities: EntitySchema[] = [];
