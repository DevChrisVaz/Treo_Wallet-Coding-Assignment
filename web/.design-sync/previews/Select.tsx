import { ListSection, Select } from 'wallet-web-ui';

/*
 * Select nativo de la web (cerrado se ve como el de la app móvil; al abrirse usa el selector del
 * sistema), sobre el lienzo y con los textos de las pantallas rediseñadas.
 */

export const Default = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Select label="Cuenta de origen" defaultValue="">
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

/** El paso del monto: la ayuda dice el saldo de la cuenta elegida. */
export const WithHint = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Select label="Cuenta de origen" defaultValue="principal" hint="Saldo disponible: $25,000.00">
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

export const WithError = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Select label="Cuenta de origen" defaultValue="" error="Elige una cuenta">
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

export const Disabled = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Select label="Cuenta de origen" defaultValue="ahorro" disabled>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

/** El mes del estado de cuenta, en su tarjeta de Movimientos (función propia de la web, WEB-32). */
export const StatementMonth = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection title="Estado de cuenta">
      <Select label="Mes" defaultValue="2026-09">
        <option value="2026-10">octubre 2026 (en curso)</option>
        <option value="2026-09">septiembre 2026</option>
        <option value="2026-08">agosto 2026</option>
      </Select>
    </ListSection>
  </div>
);
