import { AmountField, Select, TextField } from 'wallet-web-ui';

export const Default = () => (
  <div className="max-w-md">
    <AmountField
      label="Monto"
      placeholder="0.00"
      hint="Hasta 2 decimales, por ejemplo 1,250.50."
    />
  </div>
);

export const Filled = () => (
  <div className="max-w-md">
    <AmountField
      label="Monto"
      defaultValue="1,250.50"
      hint="Hasta 2 decimales, por ejemplo 1,250.50."
    />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <AmountField
      label="Monto"
      defaultValue="1250.505"
      error="El monto admite máximo 2 decimales"
    />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md">
    <AmountField label="Monto" defaultValue="5,000.00" disabled />
  </div>
);

export const TransferAmount = () => (
  <form className="grid max-w-md gap-5">
    <Select
      label="Cuenta de origen"
      defaultValue="principal"
      hint="Saldo disponible: $25,000.00"
    >
      <option value="">Elige una cuenta</option>
      <option value="principal">Principal · $25,000.00</option>
      <option value="ahorro">Ahorro · $10,000.00</option>
    </Select>
    <AmountField
      label="Monto"
      defaultValue="5,000.00"
      hint="Hasta 2 decimales, por ejemplo 1,250.50."
    />
    <TextField label="Concepto" defaultValue="Renta de octubre" hint="Hasta 40 caracteres." />
  </form>
);
