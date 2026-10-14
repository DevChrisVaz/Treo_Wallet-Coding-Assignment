import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type * as z from 'zod';

/**
 * Resolver de react-hook-form con un esquema Zod del contrato (D12 de web-app): la misma validación
 * corre en el formulario y en la Server Action. Los validadores del contrato aceptan `unknown`
 * porque también comprueban el tipo; el formulario declara sus campos como texto.
 */
export function contractResolver<
  TValues extends FieldValues,
  S extends z.ZodType<FieldValues, FieldValues>,
>(schema: S): Resolver<TValues, unknown, z.output<S>> {
  return zodResolver(schema) as unknown as Resolver<TValues, unknown, z.output<S>>;
}
