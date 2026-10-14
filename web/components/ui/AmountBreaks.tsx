import { splitCents } from '@devchrisvaz/wallet-design-tokens';
import { Fragment } from 'react';

export interface AmountBreaksProps {
  /** Monto con formato (`formatMXN`), por ejemplo "$1,250,000.00". */
  value: string;
  /** Clase de los centavos (el hero los muestra más chicos); sin ella van como texto. */
  centsClassName?: string;
}

/**
 * Un monto que, si no cabe en una línea (texto agrandado, WEB-28), solo pasa de línea después de un
 * separador de miles o antes de los centavos, nunca entre los dígitos de un grupo: los únicos
 * puntos de corte son los `<wbr>`, que no agregan texto (lectores de pantalla y `textContent` leen
 * el monto completo). Va dentro del elemento que da el tamaño, sin envoltorio propio.
 */
export function AmountBreaks({ value, centsClassName }: AmountBreaksProps) {
  const [whole, cents] = splitCents(value);
  const groups = whole.split(',');
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={`${index}-${group}`}>
          {group}
          {index < groups.length - 1 ? (
            <>
              ,<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
      <wbr />
      {centsClassName ? <span className={centsClassName}>{cents}</span> : cents}
    </>
  );
}
