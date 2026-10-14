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

/** Por omisión: "Ahora", sin fecha. */
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

/** "Programar" con una fecha dentro del rango. */
export const Scheduled = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2026-10-20')}
      now={NOW}
    />
  </div>
);

/** La API rechazó la fecha (DATE_OUT_OF_RANGE): su mensaje va junto al campo. */
export const OutOfRange = () => (
  <div className="max-w-xl">
    <ScheduleField
      when="SCHEDULED"
      whenField={field('when', 'SCHEDULED')}
      dateField={field('scheduledFor', '2027-03-01')}
      error="Elige una fecha entre mañana y 90 días después de hoy"
      now={NOW}
    />
  </div>
);
