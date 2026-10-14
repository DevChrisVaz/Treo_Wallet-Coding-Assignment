import { Button, Wordmark } from 'wallet-web-ui';

export const Full = () => <Wordmark />;

export const Compact = () => <Wordmark variant="compact" />;

export const Variants = () => (
  <div className="flex flex-wrap items-baseline gap-8">
    <Wordmark />
    <Wordmark variant="compact" />
  </div>
);

export const CompactHeader = () => (
  <header className="max-w-md border-b border-border bg-surface">
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <Wordmark variant="compact" />
      <Button variant="ghost">Cerrar sesión</Button>
    </div>
  </header>
);

/** `tone="inverse"` sobre superficies oscuras (navegación lateral y pantallas de marca). */
export const Inverse = () => (
  <div className="flex max-w-md flex-wrap items-baseline gap-8 rounded-lg bg-surface-hero p-6">
    <Wordmark tone="inverse" />
    <Wordmark variant="compact" tone="inverse" />
  </div>
);
