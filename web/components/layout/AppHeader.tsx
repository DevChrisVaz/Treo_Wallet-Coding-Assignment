'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';

const SECTIONS = [
  { href: '/', label: 'Cuentas' },
  { href: '/beneficiaries', label: 'Beneficiarios' },
  { href: '/transfers/new', label: 'Transferir' },
  { href: '/transfers/scheduled', label: 'Programadas' },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/accounts');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación principal; la sección actual lleva `aria-current="page"`. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-wrap gap-1">
        {SECTIONS.map(({ href, label }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-pill px-4 text-label ${
                  current ? 'bg-surface-brand text-action' : 'text-fg-secondary hover:text-action'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Cierra la sesión (WEB-05); aunque la acción falle, lleva al inicio de sesión. */
export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await logout();
    } catch {
      // La cookie y la sesión se borran en el servidor; si no hubo respuesta, la próxima
      // petición sin sesión válida también termina en el inicio de sesión.
    }
    // Los datos de la sesión no deben quedar en la caché del navegador.
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="secondary" loading={pending} loadingLabel="Cerrando…" onClick={onLogout}>
      Cerrar sesión
    </Button>
  );
}
