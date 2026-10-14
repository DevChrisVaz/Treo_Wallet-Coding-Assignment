import { mexicoCityDate } from '@devchrisvaz/wallet-contract';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Meses que se ofrecen además del mes en curso (WEB-32). */
const PREVIOUS_MONTHS = 12;

export interface StatementMonth {
  /** `AAAA-MM`, el periodo de `getAccountStatement`. */
  readonly value: string;
  readonly label: string;
}

/**
 * Opciones del selector del estado de cuenta: el mes en curso de la Ciudad de México, marcado
 * "(en curso)", y los 12 anteriores, del más reciente al más antiguo. Recibe el instante en lugar de
 * leer el reloj, como `mexicoCityDate`.
 */
export function statementMonths(instant: Date): StatementMonth[] {
  const [year, month] = mexicoCityDate(instant).split('-').map(Number) as [number, number];
  return Array.from({ length: PREVIOUS_MONTHS + 1 }, (_, offset) => {
    // Meses contados desde el año 0, para restar sin pasar por fechas ni zonas horarias.
    const index = year * 12 + (month - 1) - offset;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const label = `${MONTHS[m - 1]} ${y}`;
    return {
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: offset === 0 ? `${label} (en curso)` : label,
    };
  });
}
