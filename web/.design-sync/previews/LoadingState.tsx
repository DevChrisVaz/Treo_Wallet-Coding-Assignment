import { LoadingState, Select, TextField, buttonClasses } from 'wallet-web-ui';

export const Lines = () => (
  <div className="max-w-2xl">
    <LoadingState label="Cargando movimientos" />
  </div>
);

export const Cards = () => (
  <div className="max-w-2xl">
    <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
  </div>
);

export const LongList = () => (
  <div className="max-w-2xl">
    <LoadingState label="Cargando tus beneficiarios" count={6} />
  </div>
);

export const AccountsPage = () => (
  <div className="grid max-w-2xl gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1 text-fg">Tus cuentas</h1>
      <a href="#nueva-transferencia" className={buttonClasses('primary')}>
        Nueva transferencia
      </a>
    </div>
    <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
  </div>
);

export const MovementsPage = () => (
  <div className="grid max-w-2xl gap-6">
    <h1 className="text-h1 text-fg">Movimientos</h1>
    <div className="grid gap-4 sm:grid-cols-3">
      <Select label="Cuenta" defaultValue="principal">
        <option value="principal">Principal</option>
        <option value="ahorro">Ahorro</option>
      </Select>
      <TextField label="Desde" type="date" defaultValue="2026-10-01" />
      <TextField label="Hasta" type="date" defaultValue="2026-10-13" />
    </div>
    <LoadingState label="Cargando movimientos" />
  </div>
);
