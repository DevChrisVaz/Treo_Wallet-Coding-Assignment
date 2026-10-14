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

/** Bonus (WEB-34, R58): "Programadas", con su propio icono (CalendarClock), como destino actual. */
export const Scheduled = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav
      items={DEFAULT_NAV_ITEMS}
      current="scheduled"
      user={user}
      onLogout={noop}
      className="flex h-full!"
    />
  </div>
);

const long = {
  name: 'María Fernanda de los Ángeles Villanueva-Ximénez Castellanos',
  email: 'maria.fernanda.villanueva.ximenez.castellanos@subdominio-largo.example.com',
};

/** WEB-26: el perfil es un solo botón con chevron; nombre y correo van en una línea cada uno. */
export const Profile = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav items={DEFAULT_NAV_ITEMS} current="home" user={user} onLogout={noop} className="flex h-full!" />
  </div>
);

/** WEB-26: un nombre y un correo muy largos se cortan con puntos suspensivos sin desbordar el botón. */
export const LongProfile = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav items={DEFAULT_NAV_ITEMS} current="home" user={long} onLogout={noop} className="flex h-full!" />
  </div>
);

/** WEB-26: el menú abierto encima del botón (aria-expanded) con "Cerrar sesión"; ya no hay botón aparte. */
export const MenuOpen = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav items={DEFAULT_NAV_ITEMS} current="home" user={user} onLogout={noop} defaultMenuOpen className="flex h-full!" />
  </div>
);

/** WEB-26: menú abierto con el perfil largo: el menú tiene el ancho del botón. */
export const MenuOpenLongProfile = () => (
  <div className="h-[640px] w-sidebar">
    <SideNav items={DEFAULT_NAV_ITEMS} current="home" user={long} onLogout={noop} defaultMenuOpen className="flex h-full!" />
  </div>
);
