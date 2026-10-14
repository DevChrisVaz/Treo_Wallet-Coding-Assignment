import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Avatar, BottomSheet, Button, TextField, initials } from 'wallet-web-ui';

/*
 * Hoja inferior modal (DSG-17): sube desde abajo en teléfono y es un panel centrado en el
 * dashboard. Va abierta y sola en su tarjeta (cardMode single, 480×520): es `fixed` y enfoca su
 * primer control al abrirse.
 */

const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const noop = () => undefined;

/**
 * La hoja es `fixed` y se ancla abajo del marco: el marco llena el viewport de la tarjeta sin el
 * margen del body (que solo existe en las capturas `?story=`), para que la hoja no quede recortada.
 */
function Frame({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(472);
  useLayoutEffect(() => {
    const { paddingTop, paddingBottom } = getComputedStyle(document.body);
    const free = window.innerHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
    setHeight(Math.max(free, 472));
  }, []);
  return (
    <div className="bg-surface-canvas" style={{ height }}>
      {children}
    </div>
  );
}

/** El menú de la cuenta de AppHeader. */
export const AccountMenu = () => (
  <Frame>
    <BottomSheet open onClose={noop} title="Tu cuenta">
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <Avatar tone="brand" initials={initials(user.name)} />
          <div className="min-w-0">
            <p className="truncate text-label text-fg">{user.name}</p>
            <p className="truncate text-caption text-fg-muted">{user.email}</p>
          </div>
        </div>
        <Button variant="secondary" icon="logout" onClick={noop}>
          Cerrar sesión
        </Button>
      </div>
    </BottomSheet>
  </Frame>
);

/** Las fechas de los filtros de Movimientos. */
export const DateFilters = () => (
  <Frame>
    <BottomSheet open onClose={noop} title="Filtrar movimientos">
      <div className="grid gap-5">
        <TextField label="Desde" type="date" defaultValue="2026-10-01" />
        <TextField label="Hasta" type="date" defaultValue="2026-10-13" />
        <Button>Aplicar</Button>
      </div>
    </BottomSheet>
  </Frame>
);
