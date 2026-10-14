import { vi } from 'vitest';

/**
 * Sustituto de `next/navigation` para componentes cliente:
 * `vi.mock('next/navigation', () => import('@/test/support/next-navigation'))`.
 */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

const state = { pathname: '/', search: new URLSearchParams() };

export function useRouter() {
  return router;
}

export function usePathname() {
  return state.pathname;
}

export function useSearchParams() {
  return state.search;
}

export function redirect(url: string): never {
  throw new Error(`NEXT_REDIRECT:${url}`);
}

/** Fija la ruta actual y reinicia las llamadas al router. */
export function setLocation(pathname: string, search = '') {
  state.pathname = pathname;
  state.search = new URLSearchParams(search);
  for (const fn of Object.values(router)) fn.mockReset();
}
