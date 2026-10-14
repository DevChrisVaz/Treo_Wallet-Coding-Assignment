/*
 * Regreso tras iniciar sesión (WEB-22): `next` solo acepta rutas de esta misma web. Se rechaza todo
 * lo que un navegador podría interpretar como otro origen (`//host`, `/\host`, esquemas) y los
 * caracteres de control.
 */

import { navDestinations, type IconConcept } from '@devchrisvaz/wallet-design-tokens';

const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/;
const PUBLIC_PATHS = ['/login', '/register', '/verify-email'];

/** Ruta interna segura para volver, o `/` (el resumen de cuentas). */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || !INTERNAL_PATH.test(value)) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return '/';
  }
  // Caracteres de control codificados (%0d%0a) no son parte de una ruta legítima.
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return '/';
  const pathname = value.split(/[?#]/, 1)[0] ?? '/';
  if (PUBLIC_PATHS.includes(pathname)) return '/';
  return value;
}

/** Inicio de sesión con la ruta de regreso y, si aplica, el aviso de sesión expirada. */
export function loginPath(next?: string | null, reason?: 'expired'): string {
  const params = new URLSearchParams();
  const target = safeNextPath(next);
  if (target !== '/') params.set('next', target);
  if (reason) params.set('reason', reason);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

/**
 * Destinos de la navegación de la web: los compartidos con móvil (`navDestinations` del paquete de
 * diseño) y "Programadas" (WEB-34), que solo existe en la web. Su icono es el concepto `scheduled`
 * del paquete (CalendarClock, R58), distinto del de "Transferir".
 */
export const APP_DESTINATIONS = {
  ...navDestinations,
  scheduled: { label: 'Programadas', icon: 'scheduled' },
} as const satisfies Record<string, { label: string; icon: IconConcept }>;

export type AppDestination = keyof typeof APP_DESTINATIONS;

/** Página de las transferencias programadas (WEB-34). */
export const SCHEDULED_TRANSFERS_PATH = '/transfers/scheduled';

export interface AppSection {
  current: AppDestination | null;
  title: string;
  mode: 'tabs' | 'flow';
  /** Acción principal de la barra superior del dashboard. */
  primary: 'transfer' | 'beneficiary';
}

const MOVEMENTS_PATH = /^\/accounts\/[^/]+\/movements$/;

/** Destino actual, título y forma de cada ruta con sesión (WEB-26, WEB-27). */
export function appSection(pathname: string): AppSection {
  if (pathname === '/transfers/new') {
    return { current: 'transfer', title: 'Transferir', mode: 'flow', primary: 'transfer' };
  }
  if (pathname === SCHEDULED_TRANSFERS_PATH) {
    // En la navegación lateral se marca "Programadas"; en teléfono no es pestaña (WEB-27): ninguna
    // queda marcada, como en el detalle de una transferencia.
    return {
      current: 'scheduled',
      title: 'Transferencias programadas',
      mode: 'tabs',
      primary: 'transfer',
    };
  }
  if (pathname.startsWith('/transfers/')) {
    return { current: null, title: 'Transferencia', mode: 'tabs', primary: 'transfer' };
  }
  if (pathname === '/movements' || MOVEMENTS_PATH.test(pathname)) {
    return { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' };
  }
  if (pathname === '/beneficiaries/new') {
    return {
      current: 'beneficiaries',
      title: 'Agregar beneficiario',
      mode: 'tabs',
      primary: 'transfer',
    };
  }
  if (pathname === '/beneficiaries' || pathname.startsWith('/beneficiaries/')) {
    return {
      current: 'beneficiaries',
      title: 'Beneficiarios',
      mode: 'tabs',
      primary: 'beneficiary',
    };
  }
  return { current: 'home', title: 'Inicio', mode: 'tabs', primary: 'transfer' };
}
