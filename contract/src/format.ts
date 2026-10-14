function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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
  const grouped = groupThousands(integerPart);
  return `${sign}$${grouped}.${fraction.padEnd(2, '0')}`;
}

/**
 * Saneamiento de un campo de monto mientras se escribe o se pega (CTR-20): solo dígitos y un punto
 * decimal, máximo 2 decimales y 12 dígitos enteros, sin ceros a la izquierda (`007` → `7`, `0.5` se
 * conserva). `display` agrega comas de millar (`12,345.67`) y mantiene un punto final (`12.`) para que
 * se pueda seguir escribiendo; `value` es el monto normalizado para la API (`12345.67`), sin
 * separadores ni punto final. Con la entrada vacía ambos son `''`.
 */
export function sanitizeAmountTyping(raw: string): { value: string; display: string } {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  const hasDot = dot !== -1;
  const integerRaw = hasDot ? cleaned.slice(0, dot) : cleaned;
  const fraction = hasDot
    ? cleaned
        .slice(dot + 1)
        .replace(/\./g, '')
        .slice(0, 2)
    : '';
  const stripped = integerRaw.replace(/^0+/, '').slice(0, 12);
  const integerPart = stripped === '' && (integerRaw !== '' || hasDot) ? '0' : stripped;
  if (integerPart === '') return { value: '', display: '' };
  const value = fraction === '' ? integerPart : `${integerPart}.${fraction}`;
  const display = `${groupThousands(integerPart)}${hasDot ? `.${fraction}` : ''}`;
  return { value, display };
}
