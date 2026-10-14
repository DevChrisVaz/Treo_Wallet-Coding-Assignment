import * as z from 'zod';
import {
  addFieldIssue,
  textField,
  type FieldContext,
} from '../../../../platform/http/validation.js';
import { MOVEMENT_TYPES, type MovementType } from '../../../transfers/domain/ledger.js';

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** `YYYY-MM-DD` que existe en el calendario (sin hora ni zona: es un día de CDMX). */
function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dateField = textField({
  check: (value, ctx) => {
    if (!isCalendarDate(value)) {
      addFieldIssue(ctx, 'INVALID_DATE', 'Debe ser una fecha AAAA-MM-DD que exista');
    }
  },
});

const limitField = textField({
  check: (value, ctx) => {
    if (!/^[0-9]+$/.test(value)) {
      return addFieldIssue(ctx, 'INVALID_FORMAT', 'Debe ser un entero de 1 a 100');
    }
    const limit = Number.parseInt(value, 10);
    if (limit < 1) addFieldIssue(ctx, 'NOT_POSITIVE', 'Debe ser un entero de 1 a 100');
    else if (limit > 100) addFieldIssue(ctx, 'TOO_LARGE', 'Admite máximo 100');
  },
}).transform((value) => Number.parseInt(value, 10));

/** `type` repetido (`?type=A&type=B`) llega como arreglo; uno solo, como texto. Sin duplicados. */
const typesField = z
  .unknown()
  .superRefine((value, ctx: FieldContext) => {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((item) => typeof item !== 'string')) {
      return addFieldIssue(ctx, 'INVALID_TYPE', 'Cada tipo debe ser texto');
    }
    if (values.some((item) => !(MOVEMENT_TYPES as readonly string[]).includes(item as string))) {
      return addFieldIssue(
        ctx,
        'INVALID_FORMAT',
        `Los tipos válidos son ${MOVEMENT_TYPES.join(', ')}`,
      );
    }
    if (new Set(values).size !== values.length) {
      addFieldIssue(ctx, 'INVALID_FORMAT', 'Cada tipo se indica una sola vez');
    }
  })
  .transform((value) => (Array.isArray(value) ? value : [value]) as MovementType[]);

/**
 * Parámetros de `listAccountMovements` (HIS-04 a HIS-07): `from` y `to` como días de CDMX con `from`
 * no posterior a `to`, `type` uno o varios, `limit` de 1 a 100 (20 por defecto) y `cursor` opaco
 * (su contenido se verifica aparte). Un parámetro desconocido o un escalar repetido es 422.
 */
export const movementQuerySchema = z
  .strictObject({
    from: dateField.optional(),
    to: dateField.optional(),
    type: typesField.optional(),
    limit: limitField.optional(),
    cursor: textField({ min: 1, max: 512 }).optional(),
  })
  .superRefine((query, ctx) => {
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha final no puede ser anterior a la inicial',
        path: ['to'],
        params: { fieldCode: 'INVALID_DATE' },
      });
    }
  })
  .transform(({ type, limit, ...rest }) => ({
    ...rest,
    types: type ?? [],
    limit: limit ?? 20,
  }));

export type MovementQuery = z.output<typeof movementQuerySchema>;
