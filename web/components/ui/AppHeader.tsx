'use client';

import { useState } from 'react';
import { Avatar, initials } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export interface AppHeaderProps {
  user: { name: string; email: string };
  /** Título de la pestaña; sin él, saluda con el nombre (Inicio). */
  title?: string;
  onLogout?: () => void;
  className?: string;
}

/** Encabezado de la forma de app (WEB-27): saludo o título y el menú de la cuenta. */
export function AppHeader({ user, title, onLogout, className = '' }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (
    <header
      className={`flex items-center justify-between gap-4 px-5 pt-6 pb-4 ${className}`.trim()}
    >
      {title ? (
        <h1 className="text-h2 text-fg">{title}</h1>
      ) : (
        <h1 className="grid">
          <span className="text-body-sm text-fg-secondary">Hola,</span>{' '}
          <span className="text-h2 text-fg">{firstName}</span>
        </h1>
      )}
      <button
        type="button"
        aria-label="Menú de la cuenta"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-pill"
      >
        <Avatar tone="hero" initials={initials(user.name)} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <Avatar tone="brand" initials={initials(user.name)} />
            <div className="min-w-0">
              <p className="truncate text-label text-fg">{user.name}</p>
              <p className="truncate text-caption text-fg-muted">{user.email}</p>
            </div>
          </div>
          {onLogout ? (
            <Button variant="secondary" icon="logout" onClick={onLogout}>
              Cerrar sesión
            </Button>
          ) : null}
        </div>
      </BottomSheet>
    </header>
  );
}
