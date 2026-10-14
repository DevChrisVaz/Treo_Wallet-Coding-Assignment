import { TopBar, buttonClasses } from 'wallet-web-ui';

/* Barra superior del dashboard (WEB-26): el h1 de la página y su acción principal. */

export const WithAction = () => (
  <TopBar
    title="Inicio"
    className="flex"
    action={
      <a className={buttonClasses('primary')} href="#">
        Nueva transferencia
      </a>
    }
  />
);

export const TitleOnly = () => <TopBar title="Transferencia" className="flex" />;
