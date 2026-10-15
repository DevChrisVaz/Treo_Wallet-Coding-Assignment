'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { logout } from '@/app/actions/auth';
import { buttonClasses } from '@/components/ui/Button';
import { RouterLinkProvider, type LinkComponent } from '@/components/ui/RouterLink';
import { AccountSelectionProvider } from '@/lib/client/account-selection';
import { SessionUserProvider } from '@/lib/client/session-user';
import { appSection } from '@/lib/navigation';
import { AppShell } from './AppShell';

export interface AppFrameProps {
  user: { name: string; email: string };
  children: ReactNode;
}

/** next/link con la firma del kit: navega sin recargar y conserva la caché. */
const NextLink: LinkComponent = ({ href, children, ...props }) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

const PRIMARY = {
  transfer: { href: '/transfers/new', label: 'Nueva transferencia' },
  beneficiary: { href: '/beneficiaries/new', label: 'Agregar beneficiario' },
} as const;

/**
 * Cierra la sesión (WEB-05); aunque la acción falle, borra la caché y lleva al inicio de sesión.
 * `pending` deja los botones de cierre en "Cerrando…" mientras corre la acción.
 */
export function useLogout(): { logout: () => Promise<void>; pending: boolean } {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Candado síncrono: un segundo clic puede llegar antes de que React pinte el botón deshabilitado.
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await logout();
    } catch {
      // La cookie y la sesión se borran en el servidor; sin respuesta, la próxima petición sin
      // sesión válida también termina en el inicio de sesión.
    }
    // Los datos de la sesión no deben quedar en la caché del navegador.
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }, [queryClient, router]);
  return { logout: run, pending };
}

/**
 * Estructura de las pantallas con sesión (WEB-24, WEB-26, WEB-27): AppShell con el destino, el título
 * y la forma de la ruta actual, enlaces de Next, la cuenta elegida compartida y el cierre de sesión
 * desde la navegación lateral y desde el menú del avatar.
 */
export function AppFrame({ user, children }: AppFrameProps) {
  const section = appSection(usePathname());
  const { logout: onLogout, pending } = useLogout();
  const primary = PRIMARY[section.primary];
  return (
    <RouterLinkProvider value={NextLink}>
      <SessionUserProvider user={user}>
        <AccountSelectionProvider>
          <AppShell
            current={section.current}
            title={section.title}
            mode={section.mode}
            user={user}
            onLogout={() => void onLogout()}
            loggingOut={pending}
            primaryAction={
              <Link href={primary.href} className={buttonClasses('primary')}>
                {primary.label}
              </Link>
            }
          >
            {children}
          </AppShell>
        </AccountSelectionProvider>
      </SessionUserProvider>
    </RouterLinkProvider>
  );
}
