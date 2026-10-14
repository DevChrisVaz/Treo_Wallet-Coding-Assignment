import { DEFAULT_NAV_ITEMS, SideNav } from 'wallet-web-ui';

/*
 * Navegación lateral del dashboard (WEB-26). En la app ocupa el alto de la ventana (`h-dvh`); aquí
 * va en un marco de 248×640 y `h-full!` la ajusta a él.
 */

const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const noop = () => undefined;

export const Home = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav
      items={DEFAULT_NAV_ITEMS}
      current="home"
      user={user}
      onLogout={noop}
      className="flex h-full!"
    />
  </div>
);

export const Transfer = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav
      items={DEFAULT_NAV_ITEMS}
      current="transfer"
      user={user}
      onLogout={noop}
      className="flex h-full!"
    />
  </div>
);
