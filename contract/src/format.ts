function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;

let currencyFormat: Intl.NumberFormat | undefined;

/** `Intl.NumberFormat('es-MX', MXN)` si el motor lo trae (Node, navegadores, Hermes con Intl). */
function mxnFormat(): Intl.NumberFormat | undefined {
  if (typeof Intl === 'undefined') return undefined;
  try {
    currencyFormat ??= new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currencyFormat;
  } catch {
    return undefined;
  }
}

/**
 * Formatea un monto en pesos mexicanos con la convención `es-MX` (`$1,250.50`, `-$150.00`).
 * Nunca convierte el monto a `number`: la parte entera se pasa a `Intl.NumberFormat('es-MX')` como
 * `BigInt` (exacta para cualquier longitud) y los centavos se toman del texto original. Si el motor
 * no trae `Intl` (Hermes sin soporte), agrupa miles a mano y da el mismo resultado.
 */
export function formatMXN(amount: string): string {
  const match = DECIMAL.exec(amount);
  if (!match) throw new RangeError(`Monto inválido: "${amount}"`);
  const [, sign = '', integerPart = '0', rawFraction = ''] = match;
  const fraction = rawFraction.padEnd(2, '0');
  const format = mxnFormat();
  if (format) {
    const body = format
      .formatToParts(BigInt(integerPart))
      .map((part) => (part.type === 'fraction' ? fraction : part.value))
      .join('');
    return `${sign}${body}`;
  }
  return `${sign}$${groupThousands(integerPart)}.${fraction}`;
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
