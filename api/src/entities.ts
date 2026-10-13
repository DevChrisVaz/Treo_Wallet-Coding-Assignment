import type { EntitySchema } from 'typeorm';
import { UserEntity } from './modules/identity/infrastructure/entities.js';

/**
 * Entidades de TypeORM definidas con `EntitySchema` (sin decoradores) en la infraestructura de cada
 * módulo. El dominio no las conoce; este registro las entrega a los DataSources.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const entities: EntitySchema<any>[] = [UserEntity];
