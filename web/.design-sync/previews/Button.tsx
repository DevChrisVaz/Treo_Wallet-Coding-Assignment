import { Button } from 'wallet-web-ui';

/*
 * Botones en píldora sobre el lienzo de la app (bg-surface-canvas). Los textos son los de las
 * pantallas rediseñadas: Iniciar sesión, los pasos del flujo, Filtros de Movimientos, el menú de la
 * cuenta y el diálogo de cancelar una programada.
 */

export const Variants = () => (
  <div className="flex max-w-xl flex-wrap items-center gap-3 bg-surface-canvas p-5">
    <Button>Continuar</Button>
    <Button variant="secondary">Ver mis cuentas</Button>
    <Button variant="ghost">Editar</Button>
    <Button variant="destructive">Cancelar transferencia</Button>
  </div>
);

export const WithIcon = () => (
  <div className="flex max-w-xl flex-wrap items-center gap-3 bg-surface-canvas p-5">
    <Button variant="ghost" icon="filter">
      Filtros
    </Button>
    <Button variant="secondary" icon="logout">
      Cerrar sesión
    </Button>
  </div>
);

export const Loading = () => (
  <div className="flex max-w-xl flex-wrap items-center gap-3 bg-surface-canvas p-5">
    <Button loading loadingLabel="Enviando…">
      Enviar
    </Button>
    <Button variant="ghost" loading loadingLabel="Reenviando…">
      Reenviar código
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex max-w-xl flex-wrap items-center gap-3 bg-surface-canvas p-5">
    <Button disabled>Continuar</Button>
    <Button variant="ghost" disabled>
      Editar
    </Button>
  </div>
);

/** A todo lo ancho, como en las pantallas de marca y en el pie de los pasos en teléfono. */
export const FullWidth = () => (
  <div className="grid max-w-[390px] gap-3 bg-surface-canvas p-5">
    <Button className="w-full">Iniciar sesión</Button>
    <Button variant="ghost" className="w-full">
      Hacer otra transferencia
    </Button>
  </div>
);
