const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;

/**
 * Formatea un monto en pesos mexicanos con la convención `es-MX` (`$1,250.50`, `-$150.00`).
 * Trabaja solo con texto: no convierte a número ni depende de `Intl`, así que es exacto para
 * cualquier longitud y da el mismo resultado en Node, navegadores y Hermes.
 */
export function formatMXN(amount: string): string {
  const match = DECIMAL.exec(amount);
  if (!match) throw new RangeError(`Monto inválido: "${amount}"`);
  const [, sign = '', integerPart = '0', fraction = ''] = match;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}.${fraction.padEnd(2, '0')}`;
}
