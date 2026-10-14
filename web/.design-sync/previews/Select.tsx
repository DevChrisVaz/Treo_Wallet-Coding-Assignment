import { Select, TextField } from 'wallet-web-ui';

export const Default = () => (
  <div className="max-w-md">
    <Select label="Cuenta de origen" defaultValue="">
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

export const WithHint = () => (
  <div className="max-w-md">
    <Select
      label="Cuenta de origen"
      defaultValue="principal"
      hint="Saldo disponible: $25,000.00"
    >
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <Select label="Beneficiario" defaultValue="" error="Elige un beneficiario">
      <option value="">Elige un beneficiario</option>
      <option value="luis">Luis (Luis Pérez Ramírez) •••• 9735</option>
      <option value="mariana">Mamá (Mariana Castillo Ruiz) •••• 4418</option>
    </Select>
  </div>
);

export const Disabled = () => (
  <div className="max-w-md">
    <Select label="Cuenta de destino" defaultValue="ahorro" disabled>
      <option value="ahorro">Ahorro •••• 9722</option>
    </Select>
  </div>
);

export const MovementFilters = () => (
  <div className="grid gap-4 sm:grid-cols-3">
    <Select label="Cuenta" defaultValue="principal">
      <option value="principal">Principal</option>
      <option value="ahorro">Ahorro</option>
    </Select>
    <TextField label="Desde" type="date" defaultValue="2026-10-01" />
    <TextField label="Hasta" type="date" defaultValue="2026-10-13" />
  </div>
);
