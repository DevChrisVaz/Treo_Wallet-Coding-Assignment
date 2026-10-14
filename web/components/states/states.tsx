'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { describeError } from '@/lib/client/problem-messages';

/** Estado de carga (WEB-20): esqueletos ocultos y un anuncio para lectores de pantalla. */
export function LoadingState({
  label,
  variant = 'line',
  count = 3,
}: {
  label: string;
  variant?: 'line' | 'card';
  count?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant={variant} />
      ))}
    </div>
  );
}

/**
 * Estado de error (WEB-20): mensaje por `code` y "Reintentar" que repite la lectura. El botón va
 * debajo de la alerta, a todo lo ancho, como en las pantallas de la app móvil (WEB-25).
 */
export function ErrorState({
  title,
  error,
  onRetry,
  children,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <InlineAlert tone="danger" title={title}>
        <p>{describeError(error)}</p>
        {children}
      </InlineAlert>
      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
