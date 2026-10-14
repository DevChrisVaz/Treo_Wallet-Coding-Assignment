import { Avatar, initials } from 'wallet-web-ui';

/* Círculo con iniciales o icono (cuenta, beneficiarios, movimientos, estados vacíos). Decorativo. */

export const Tones = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Avatar tone="brand" initials={initials('Luis Pérez Ramírez')} />
    <Avatar tone="success" initials="AR" />
    <Avatar tone="neutral" initials="MG" />
    <Avatar tone="hero" initials={initials('Ana Gómez Castillo')} />
  </div>
);

/** Los iconos de los movimientos: entradas en verde, salidas en neutro. */
export const MovementIcons = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Avatar tone="success" icon="moneyIn" />
    <Avatar tone="neutral" icon="moneyOut" />
    <Avatar tone="success" icon="deposit" />
    <Avatar tone="neutral" icon="ownTransfer" />
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Avatar size="sm" initials="AG" />
    <Avatar size="md" initials="AG" />
    <Avatar size="lg" icon="account" />
  </div>
);
