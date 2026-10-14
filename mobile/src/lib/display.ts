/**
 * Convenciones de presentación compartidas con la web (paquete de diseño, D5): etiquetas de
 * movimientos y estados, signo y color del dinero, CLABE enmascarada y fechas en la zona horaria de
 * negocio. La exhaustividad se comprueba contra los tipos del contrato: un valor nuevo en el
 * contrato rompe la compilación hasta que el paquete de diseño lo agregue.
 */
import {
  centsToDecimalString,
  formatMXN,
  toCents,
  type DailyLimit,
  type MovementType,
  type TransferStatus,
} from '@devchrisvaz/wallet-contract';
import {
  money,
  movementType,
  transferStatus,
  type Direction,
  type Tone,
} from '@devchrisvaz/wallet-design-tokens';

import { theme } from '@/theme';

const movementTypes = movementType satisfies Record<MovementType, unknown>;
const transferStatuses = transferStatus satisfies Record<TransferStatus, unknown>;

export interface MovementPresentation {
  label: string;
  direction: Direction;
  amountText: string;
  color: string;
}

/** Monto con signo (`+` o `−` U+2212) y color por dirección; las salidas usan la tinta. */
export function movementPresentation(type: MovementType, amount: string): MovementPresentation {
  const { label, direction } = movementTypes[type];
  const absolute = amount.startsWith('-') ? amount.slice(1) : amount;
  return {
    label,
    direction,
    amountText: `${money[direction].sign}${formatMXN(absolute)}`,
    color: theme.colors.money[direction],
  };
}

export interface StatusPresentation {
  label: string;
  tone: Tone;
  colors: { fg: string; bg: string };
}

export function statusPresentation(status: TransferStatus): StatusPresentation {
  const { label, tone } = transferStatuses[status];
  return { label, tone, colors: theme.colors.status[tone] };
}

/** CLABE con solo los últimos 4 dígitos visibles. */
export function maskClabe(clabeOrLast4: string): string {
  return `•••• ${clabeOrLast4.slice(-4)}`;
}

const BUSINESS_TIME_ZONE = 'America/Mexico_City';
// Misma tabla que los encabezados de día de los tokens (`dayLabel`): "sep", no "sept" (MOB-20).
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partsInBusinessTimeZone(date: Date) {
  try {
    const parts = new Intl.DateTimeFormat('es-MX', {
      timeZone: BUSINESS_TIME_ZONE,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return {
      day: Number(get('day')),
      month: Number(get('month')),
      year: get('year'),
      hour: get('hour').padStart(2, '0'),
      minute: get('minute'),
    };
  } catch {
    // Sin datos de zonas horarias en Intl: la Ciudad de México está en UTC−6 fijo desde 2022.
    const shifted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
    return {
      day: shifted.getUTCDate(),
      month: shifted.getUTCMonth() + 1,
      year: String(shifted.getUTCFullYear()),
      hour: String(shifted.getUTCHours()).padStart(2, '0'),
      minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
    };
  }
}

/** Fecha y hora en America/Mexico_City, como "13 oct, 10:42" (o "13 oct 2026, 10:42"). */
export function formatDateTime(iso: string, options: { withYear?: boolean } = {}): string {
  const { day, month, year, hour, minute } = partsInBusinessTimeZone(new Date(iso));
  const date = `${day} ${MONTHS[month - 1] ?? ''}${options.withYear ? ` ${year}` : ''}`;
  return `${date}, ${hour}:${minute}`;
}

/** Hora en America/Mexico_City, como "10:52". */
export function formatTime(iso: string): string {
  const { hour, minute } = partsInBusinessTimeZone(new Date(iso));
  return `${hour}:${minute}`;
}

/** Suma de montos en centavos con BigInt (MOB-19, MOB-15). */
export function sumAmounts(amounts: readonly string[]): string {
  return centsToDecimalString(amounts.reduce((total, amount) => total + toCents(amount), 0n));
}

/** Porcentaje entero usado del límite diario, con aritmética de centavos (sin floats). */
export function limitUsedPercent({ limit, used }: Pick<DailyLimit, 'limit' | 'used'>): number {
  const limitCents = toCents(limit);
  if (limitCents === 0n) return 100;
  const percent = (toCents(used) * 100n) / limitCents;
  return Number(percent > 100n ? 100n : percent);
}
