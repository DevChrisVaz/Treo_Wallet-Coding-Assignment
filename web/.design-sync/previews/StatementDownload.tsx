import { StatementDownload } from 'wallet-web-ui';

/*
 * Estado de cuenta de Movimientos (WEB-32, función propia de la web, R53): el mes en curso y los 12
 * anteriores (el anterior elegido) y "Descargar PDF". Es el componente real: los meses salen de NOW,
 * la fecha de las historias (no del reloj de la captura); la descarga pasa por el BFF, que el lienzo
 * no tiene. En teléfono el mes y el botón van a todo lo ancho; en el dashboard (desde 1024 px), en una
 * fila.
 */

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 en Ciudad de México
const PRINCIPAL_ID = '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51';

export const Default = () => (
  <div className="max-w-3xl">
    <StatementDownload accountId={PRINCIPAL_ID} now={NOW} />
  </div>
);

export const Phone = () => (
  <div className="max-w-[390px]">
    <StatementDownload accountId={PRINCIPAL_ID} now={NOW} />
  </div>
);
