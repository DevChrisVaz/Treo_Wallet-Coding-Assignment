'use client';

import { toneIcon } from '@devchrisvaz/wallet-design-tokens';
import { useEffect, useRef, type ReactNode } from 'react';
import { TONE_CLASSES } from '@/lib/conventions';
import { Icon } from './Icon';

export type AlertTone = 'success' | 'warning' | 'danger' | 'info';

export interface InlineAlertProps {
  tone: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Mueve el foco a la alerta al aparecer, para anunciar un error de operación (WEB-23). */
  focusOnMount?: boolean;
  className?: string;
}

/** Alerta en línea: `role="alert"` para errores y `role="status"` para el resto (D7). */
export function InlineAlert({
  tone,
  title,
  children,
  focusOnMount = false,
  className = '',
}: InlineAlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      role={tone === 'danger' ? 'alert' : 'status'}
      tabIndex={focusOnMount ? -1 : undefined}
      className={`flex gap-3 rounded-md p-4 text-body-sm ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      <Icon name={toneIcon[tone]} />
      <div className="grid gap-1">
        {title ? <p className="text-label">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
