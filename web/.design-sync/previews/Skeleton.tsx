import { ListSection, Skeleton } from 'wallet-web-ui';

/*
 * Esqueletos sobre el lienzo de la app. La tarjeta ocupa el lugar de una AccountCard y, mientras
 * Inicio carga, el del hero; las líneas van dentro de una ListSection, como la lista que reemplazan.
 */

export const Line = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Skeleton />
  </div>
);

export const Card = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <Skeleton variant="card" />
  </div>
);

export const TextBlock = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection>
      <div className="grid gap-3">
        <Skeleton />
        <Skeleton className="max-w-sm" />
        <Skeleton className="max-w-56" />
      </div>
    </ListSection>
  </div>
);

/** Inicio cargando: el hero, las dos tarjetas de cuenta y la lista. */
export const HomeLoading = () => (
  <div className="grid max-w-[390px] gap-5 bg-surface-canvas p-5">
    <Skeleton variant="card" />
    <div className="grid gap-3">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
    <ListSection>
      <div className="grid gap-3">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </ListSection>
  </div>
);
