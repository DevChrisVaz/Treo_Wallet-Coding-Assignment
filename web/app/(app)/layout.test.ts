import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import AppLayout from './layout';

vi.mock('next/headers', () => import('@/test/support/next-headers'));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const PATH = '/accounts/0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a/movements';

function renderLayout() {
  return AppLayout({ children: null, params: Promise.resolve({}) } as never);
}

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
});

describe('layout protegido (app)', () => {
  it('WEB-22 sin sesión lleva al inicio de sesión con la ruta de regreso', async () => {
    resetRequest({ headers: { 'x-wallet-path': PATH } });
    await expect(renderLayout()).rejects.toThrow(
      `NEXT_REDIRECT:/login?next=${encodeURIComponent(PATH)}`,
    );
  });

  it('WEB-03 con la cookie de una sesión expirada pasa por el borrado de la cookie', async () => {
    resetRequest({ headers: { 'x-wallet-path': PATH }, cookies: { sid: SESSION_ID } });
    await expect(renderLayout()).rejects.toThrow(
      `NEXT_REDIRECT:/bff/session/expired?next=${encodeURIComponent(PATH)}`,
    );
  });

  it('WEB-22 con sesión activa muestra la pantalla y renueva el plazo de inactividad', async () => {
    const before = new Date(Date.now() - 60_000);
    await sessionStore().set(SESSION_ID, sessionData({ lastSeenAt: before.toISOString() }));
    resetRequest({ headers: { 'x-wallet-path': PATH }, cookies: { sid: SESSION_ID } });

    await expect(renderLayout()).resolves.toBeTruthy();

    const session = await sessionStore().get(SESSION_ID);
    expect(Date.parse(session?.lastSeenAt ?? '')).toBeGreaterThan(before.getTime());
  });
});
