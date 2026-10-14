import { DailyLimitMeter, ListSection } from 'wallet-web-ui';

/*
 * Límite diario. Con `showHeader` el medidor pone su propio "Límite diario" y el límite arriba de la
 * barra; así va en Inicio, dentro de una ListSection sin título. Sin él, solo la barra y lo que queda.
 */
const base = {
  limit: '50000.00',
  resetsAt: '2026-10-14T06:00:00.000Z',
  timeZone: 'America/Mexico_City' as const,
};

export const Default = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection>
      <DailyLimitMeter dailyLimit={{ ...base, used: '18500.00', remaining: '31500.00' }} showHeader />
    </ListSection>
  </div>
);

export const Unused = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection>
      <DailyLimitMeter dailyLimit={{ ...base, used: '0.00', remaining: '50000.00' }} showHeader />
    </ListSection>
  </div>
);

export const NearlyReached = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection>
      <DailyLimitMeter dailyLimit={{ ...base, used: '46500.00', remaining: '3500.00' }} showHeader />
    </ListSection>
  </div>
);

export const Reached = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection>
      <DailyLimitMeter dailyLimit={{ ...base, used: '50000.00', remaining: '0.00' }} showHeader />
    </ListSection>
  </div>
);

/** Sin encabezado (por omisión): la barra y lo que queda, bajo un título que pone la pantalla. */
export const WithoutHeader = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <ListSection title="Límite diario de transferencias">
      <DailyLimitMeter dailyLimit={{ ...base, used: '18500.00', remaining: '31500.00' }} />
    </ListSection>
  </div>
);
