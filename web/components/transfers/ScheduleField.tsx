'use client';

import { schedulableDates } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { TextField } from '@/components/ui/TextField';
import { scheduledTransfersKey } from '@/lib/client/scheduled-transfers';
import { SCHEDULED_TRANSFERS_PATH } from '@/lib/navigation';
import { formatScheduledDate, formatScheduledInstant } from '@/lib/scheduled-date';

/*
 * Programar una transferencia (WEB-33, D11 de scheduled-transfers). Son piezas aparte del flujo de
 * transferencia para que el rediseño las reubique sin cambiarlas: el control "Cuándo", el texto de
 * la revisión y la nota del resultado.
 */

/** "Ahora" (por defecto) o "Programar" con fecha. */
export type ScheduleWhen = 'NOW' | 'SCHEDULED';

export interface ScheduleFieldProps {
  /** Opción elegida: con "Programar" aparece la fecha. */
  when: ScheduleWhen;
  /** Registro del grupo de radios, por ejemplo `register('when')`. */
  whenField: UseFormRegisterReturn;
  /** Registro del campo de fecha, por ejemplo `register('scheduledFor')`. */
  dateField: UseFormRegisterReturn;
  /**
   * Registro de la hora (WEB-33), por ejemplo `register('scheduledTime')`. Con ella, "Programar" muestra
   * fecha y hora lado a lado (hora de la Ciudad de México, a minutos).
   */
  timeField?: UseFormRegisterReturn | undefined;
  /** Error de la fecha (o del momento), del formulario o de la API; se muestra junto al campo. */
  error?: string | undefined;
  /** Error de la hora (falta elegirla); se muestra junto a su campo. */
  timeError?: string | undefined;
  /** Fecha de referencia del rango (lienzos con el reloj fijo); por omisión, la actual. */
  now?: Date | undefined;
}

/**
 * Control "Cuándo": radios "Ahora" y "Programar" y, con "Programar", una fecha limitada al rango
 * programable de la Ciudad de México (`schedulableDates` del contrato: de hoy, con 10 minutos de anticipación, a 90 días). "Hoy"
 * es el del reloj del navegador al pintar; la API vuelve a validar el rango al recibirla.
 */
export function ScheduleField({
  when,
  whenField,
  dateField,
  timeField,
  error,
  timeError,
  now,
}: ScheduleFieldProps) {
  const range = schedulableDates(now ?? new Date());
  return (
    <div className="grid gap-5">
      {/* Mismo control de elección que los filtros de movimientos: 44 px de alto y acento del sistema. */}
      <fieldset className="grid">
        <legend className="pb-1 text-label text-fg">Cuándo</legend>
        <div className="flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input type="radio" value="NOW" className="size-5 accent-action" {...whenField} />
            Ahora
          </label>
          <label className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input type="radio" value="SCHEDULED" className="size-5 accent-action" {...whenField} />
            Programar
          </label>
        </div>
      </fieldset>
      {when === 'SCHEDULED' ? (
        <div className="grid content-start items-start gap-4 sm:grid-cols-2 sm:gap-x-3">
          <TextField
            type="date"
            label="Fecha de envío"
            min={range.min}
            max={range.max}
            hint={`Entre el ${formatScheduledDate(range.min)} y el ${formatScheduledDate(range.max)}.`}
            error={error}
            {...dateField}
          />
          {timeField ? (
            <TextField
              type="time"
              label="Hora de envío"
              step={60}
              hint="Hora de la Ciudad de México, al menos 10 minutos después de ahora."
              error={timeError}
              {...timeField}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Línea de la revisión: "Se enviará el 20 de octubre de 2026, 14:30". */
export function scheduledSendText(scheduledFor: string): string {
  return `Se enviará el ${formatScheduledInstant(scheduledFor)}`;
}

/**
 * Nota del resultado `SCHEDULED`: la fecha y el enlace a la página de programadas, en el aviso
 * informativo del kit (el tono de la insignia "Programada"), como el aviso de la transferencia
 * fallida sobre su comprobante. Hay una programada nueva, así que la lista en caché se vuelve a
 * consultar (WEB-34).
 */
export function ScheduledOutcome({ scheduledFor }: { scheduledFor: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: scheduledTransfersKey });
  }, [queryClient]);
  return (
    <InlineAlert tone="info" announce={false}>
      {scheduledSendText(scheduledFor)}. Puedes cancelarla antes de esa hora en{' '}
      <Link href={SCHEDULED_TRANSFERS_PATH} className="text-action underline underline-offset-2">
        tus transferencias programadas
      </Link>
      .
    </InlineAlert>
  );
}
