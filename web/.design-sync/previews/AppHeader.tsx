import { AppHeader } from 'wallet-web-ui';

/*
 * Encabezado de la forma de app (WEB-27): en Inicio saluda con el nombre y en las demás pestañas
 * muestra el título; el avatar abre el menú de la cuenta (BottomSheet "Tu cuenta").
 */

const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const noop = () => undefined;

export const Greeting = () => (
  <div className="max-w-[390px] bg-surface-canvas">
    <AppHeader user={user} onLogout={noop} />
  </div>
);

export const WithTitle = () => (
  <div className="max-w-[390px] bg-surface-canvas">
    <AppHeader user={user} title="Movimientos" onLogout={noop} />
  </div>
);
