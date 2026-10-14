import { DEFAULT_NAV_ITEMS, TabBar } from 'wallet-web-ui';

/*
 * Barra de pestañas de la forma de app (WEB-27). En la app va fija abajo; aquí, `position="static"`
 * para verla dentro de la tarjeta, en una columna de teléfono de 390 px.
 */

export const Home = () => (
  <div className="max-w-[390px]">
    <TabBar items={DEFAULT_NAV_ITEMS} current="home" position="static" />
  </div>
);

export const Movements = () => (
  <div className="max-w-[390px]">
    <TabBar items={DEFAULT_NAV_ITEMS} current="movements" position="static" />
  </div>
);

/** Rutas fuera de la navegación (detalle de una transferencia): ninguna pestaña marcada. */
export const NoCurrent = () => (
  <div className="max-w-[390px]">
    <TabBar items={DEFAULT_NAV_ITEMS} current={null} position="static" />
  </div>
);
