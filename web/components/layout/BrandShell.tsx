import type { ReactNode } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';
import { MAIN_CONTENT_ID, SkipLink } from './PageShell';

/**
 * Pantallas públicas sobre la superficie de marca (WEB-31): a pantalla completa en la forma de app
 * (verde arriba, hoja blanca abajo) y en panel dividido en el dashboard.
 */
export function BrandShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-hero dashboard:flex-row">
      <SkipLink />
      <div className="mx-auto flex w-full max-w-app items-end px-5 pt-16 pb-8 dashboard:max-w-none dashboard:flex-1 dashboard:items-center dashboard:justify-center dashboard:p-16">
        <div className="grid gap-3">
          <Wordmark tone="inverse" />
          <p className="text-body text-fg-on-hero-muted">
            Tu billetera digital en pesos mexicanos.
          </p>
        </div>
      </div>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto grid w-full max-w-app flex-1 content-start gap-6 rounded-t-lg bg-surface px-5 pt-8 pb-10 focus-visible:outline-none dashboard:max-w-none dashboard:flex-1 dashboard:content-center dashboard:rounded-none dashboard:px-16"
      >
        <div className="mx-auto grid w-full max-w-md gap-6">
          <h1 className="text-h1 text-fg">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
