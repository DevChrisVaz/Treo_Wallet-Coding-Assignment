'use client';

import { schedulableRange } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { TextField } from '@/components/ui/TextField';
import { scheduledTransfersKey } from '@/lib/client/scheduled-transfers';
import { SCHEDULED_TRANSFERS_PATH } from '@/lib/navigation';
import { formatScheduledDate } from '@/lib/scheduled-date';

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
  /** Error de la fecha, del formulario o de la API; se muestra junto al campo. */
  error?: string | undefined;
}

/**
 * Control "Cuándo": radios "Ahora" y "Programar" y, con "Programar", una fecha limitada al rango
 * programable de la Ciudad de México (`schedulableRange` del contrato, de mañana a 90 días). "Hoy"
 * es el del reloj del navegador al pintar; la API vuelve a validar el rango al recibirla.
 */
export function ScheduleField({ when, whenField, dateField, error }: ScheduleFieldProps) {
  const range = schedulableRange(new Date());
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
        <TextField
          type="date"
          label="Fecha de envío"
          min={range.min}
          max={range.max}
          hint={`Entre el ${formatScheduledDate(range.min)} y el ${formatScheduledDate(range.max)}.`}
          error={error}
          {...dateField}
        />
      ) : null}
    </div>
  );
}

/** Línea de la revisión: "Se enviará el 20 de octubre de 2026". */
export function scheduledSendText(scheduledFor: string): string {
  return `Se enviará el ${formatScheduledDate(scheduledFor)}`;
}

/**
 * Nota del resultado `SCHEDULED`: la fecha y el enlace a la página de programadas. Hay una
 * programada nueva, así que la lista en caché se vuelve a consultar (WEB-34).
 */
export function ScheduledOutcome({ scheduledFor }: { scheduledFor: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: scheduledTransfersKey });
  }, [queryClient]);
  return (
    <p className="text-body text-fg-secondary">
      {scheduledSendText(scheduledFor)}. Puedes cancelarla antes de esa fecha en{' '}
      <Link href={SCHEDULED_TRANSFERS_PATH} className="text-action underline underline-offset-2">
        tus transferencias programadas
      </Link>
      .
    </p>
  );
}
