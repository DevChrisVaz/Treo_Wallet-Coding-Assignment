import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import {
  clearSessionCookie,
  newSessionId,
  readSessionId,
  sessionCookieName,
  writeSessionCookie,
} from './session-cookie';

function setCookieHeader(write: (response: NextResponse) => void): string {
  const response = NextResponse.json({});
  write(response);
  return response.headers.get('set-cookie') ?? '';
}

function attributes(header: string): string[] {
  return header
    .split(';')
    .slice(1)
    .map((part) => part.trim().toLowerCase());
}

describe('cookie de sesión', () => {
  it('WEB-02 en HTTPS se llama __Host-sid y es HttpOnly, Secure, SameSite=Strict y Path=/', () => {
    const header = setCookieHeader((response) =>
      writeSessionCookie(response.cookies, 'abc', { secure: true }),
    );
    expect(header.startsWith('__Host-sid=abc;')).toBe(true);
    expect(attributes(header)).toEqual(
      expect.arrayContaining(['path=/', 'secure', 'httponly', 'samesite=strict']),
    );
  });

  it('WEB-02 en http://localhost se llama sid, sin Secure ni prefijo __Host-', () => {
    const header = setCookieHeader((response) =>
      writeSessionCookie(response.cookies, 'abc', { secure: false }),
    );
    expect(header.startsWith('sid=abc;')).toBe(true);
    expect(attributes(header)).toEqual(
      expect.arrayContaining(['path=/', 'httponly', 'samesite=strict']),
    );
    expect(attributes(header)).not.toContain('secure');
  });

  it('WEB-02 es una cookie de sesión del navegador: sin Max-Age ni Expires', () => {
    const header = setCookieHeader((response) =>
      writeSessionCookie(response.cookies, 'abc', { secure: true }),
    );
    expect(header.toLowerCase()).not.toMatch(/max-age|expires/);
  });

  it('WEB-02 toma Secure de SESSION_COOKIE_SECURE cuando no se indica', () => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true');
    const header = setCookieHeader((response) => writeSessionCookie(response.cookies, 'abc'));
    expect(header.startsWith('__Host-sid=abc;')).toBe(true);
  });

  it('WEB-05 al borrarla conserva Path=/ y Secure para que el navegador acepte el borrado', () => {
    const header = setCookieHeader((response) =>
      clearSessionCookie(response.cookies, { secure: true }),
    );
    expect(header.startsWith('__Host-sid=;')).toBe(true);
    expect(attributes(header)).toEqual(
      expect.arrayContaining(['path=/', 'secure', 'httponly', 'samesite=strict']),
    );
    expect(header.toLowerCase()).toMatch(/expires=thu, 01 jan 1970|max-age=0/);
  });

  it('WEB-01 lee el id de la cookie con el nombre del entorno y rechaza valores con otra forma', () => {
    const id = newSessionId();
    const cookies = new Map<string, { value: string }>([[sessionCookieName(false), { value: id }]]);
    const store = { get: (name: string) => cookies.get(name) };
    expect(readSessionId(store, { secure: false })).toBe(id);
    expect(readSessionId(store, { secure: true })).toBeUndefined();
    cookies.set('sid', { value: '../../etc/passwd' });
    expect(readSessionId(store, { secure: false })).toBeUndefined();
  });
});

describe('newSessionId', () => {
  it('WEB-01 son 32 bytes aleatorios en base64url (43 caracteres) y no se repiten', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newSessionId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
