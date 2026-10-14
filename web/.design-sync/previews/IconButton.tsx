import { IconButton } from 'wallet-web-ui';

/* Botón o enlace solo con icono: 44 px y nombre accesible obligatorio (DSG-15). */

const noop = () => undefined;

export const Default = () => (
  <div className="flex items-center gap-2">
    <IconButton icon="close" label="Cerrar" onClick={noop} />
    <IconButton icon="back" label="Volver" href="#" />
    <IconButton icon="filter" label="Filtros" onClick={noop} />
  </div>
);

/** Sobre superficies oscuras: texto claro y anillo de foco lima (R13). */
export const OnDark = () => (
  <div className="flex max-w-xs items-center gap-2 rounded-lg bg-surface-hero p-4">
    <IconButton icon="close" label="Cerrar" tone="onDark" onClick={noop} />
    <IconButton icon="logout" label="Cerrar sesión" tone="onDark" onClick={noop} />
  </div>
);
