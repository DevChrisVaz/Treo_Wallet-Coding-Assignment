import { ScheduleField, type ScheduleFieldProps } from 'wallet-web-ui';

/*
 * Control "Cuándo" del paso de monto (WEB-33, función propia de la web, R56): "Ahora" o "Programar"
 * con la fecha de envío. En la app lo registra react-hook-form; aquí cada campo recibe lo mismo que
 * devuelve `register()`, y su `ref` marca la opción o la fecha, como hace el formulario con sus
 * valores por omisión. El rango (de mañana a 90 días, Ciudad de México) sale de NOW, la fecha de las
 * historias, y no del reloj de la captura.
 */

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 en Ciudad de México

type Field = ScheduleFieldProps['whenField'];

const noop = async () => undefined;

/** `register(name)`; con `value`, el ref elige ese radio o escribe esa fecha. */
function field(name: string, value?: string): Field {
  return {
    name,
    onChange: noop,
    onBlur: noop,
    ref: (element: HTMLInputElement | null) => {
      if (!element || value === undefined) return;
      if (element.type === 'radio') element.checked = element.value === value;
      else element.value = value;
    },
  };
}

/** Por omisión: "Ahora", sin fecha ni hora. */
export const Now = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="NOW"
      whenField={field('when', 'NOW')}
      dateField={field('scheduledFor')}
      now={NOW}
    />
  </div>
);

/** "Programar" con fecha y hora lado a lado (WEB-33: la hora es de la Ciudad de México, a minutos). */
export const Scheduled = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2026-10-20')}
      timeField={field('scheduledTime', '14:30')}
      now={NOW}
    />
  </div>
);

/** La API rechazó el momento (DATE_OUT_OF_RANGE, WEB-33): su mensaje va junto a la fecha. */
export const OutOfRange = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2027-03-01')}
      timeField={field('scheduledTime', '09:00')}
      error="Elige un momento entre 10 minutos y 90 días después de ahora."
      now={NOW}
    />
  </div>
);

/** WEB-33: hoy a las 12:05, a menos de 10 minutos de ahora (12:00): DATE_OUT_OF_RANGE. */
export const TooSoon = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2026-10-13')}
      timeField={field('scheduledTime', '12:05')}
      error="Elige un momento entre 10 minutos y 90 días después de ahora."
      now={NOW}
    />
  </div>
);

/** Sin `timeField` (formulario anterior): solo la fecha. */
export const DateOnly = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2026-10-20')}
      now={NOW}
    />
  </div>
);
