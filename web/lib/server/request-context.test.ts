import { describe, expect, it, vi } from 'vitest';
import { forwardHeaders, getRequestContext, requestContextFrom } from './request-context';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' }),
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('requestContextFrom', () => {
  it('WEB-10 reutiliza el X-Request-Id que trae la petición del navegador', () => {
    const context = requestContextFrom(new Headers({ 'x-request-id': 'bff-123' }));
    expect(context.requestId).toBe('bff-123');
  });

  it('WEB-10 genera un X-Request-Id nuevo si no viene o no tiene una forma segura', () => {
    expect(requestContextFrom(new Headers()).requestId).toMatch(UUID);
    const injected = requestContextFrom(
      new Headers({ 'x-request-id': 'id con espacios;<script>' }),
    );
    expect(injected.requestId).toMatch(UUID);
    expect(requestContextFrom(new Headers({ 'x-request-id': 'x'.repeat(200) })).requestId).toMatch(
      UUID,
    );
  });

  it('WEB-10 toma la IP del cliente de X-Forwarded-For', () => {
    const context = requestContextFrom(new Headers({ 'x-forwarded-for': '203.0.113.7' }));
    expect(context.clientIp).toBe('203.0.113.7');
  });

  it('WEB-10 con varios saltos usa la última IP, la que agregó el proxy delante de la web', () => {
    const context = requestContextFrom(
      new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' }),
    );
    expect(context.clientIp).toBe('203.0.113.7');
  });

  it('WEB-10 acepta IPv6 y usa la dirección de loopback si falta o no es una IP', () => {
    expect(requestContextFrom(new Headers({ 'x-forwarded-for': '::1' })).clientIp).toBe('::1');
    expect(requestContextFrom(new Headers()).clientIp).toBe('127.0.0.1');
    expect(requestContextFrom(new Headers({ 'x-forwarded-for': 'no-es-ip' })).clientIp).toBe(
      '127.0.0.1',
    );
  });
});

describe('User-Agent del navegador', () => {
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36';

  it('WEB-10 toma el User-Agent tal como lo envió el navegador', () => {
    const context = requestContextFrom(new Headers({ 'user-agent': CHROME }));
    expect(context.userAgent).toBe(CHROME);
  });

  it('WEB-10 sin User-Agent no inventa uno', () => {
    expect(requestContextFrom(new Headers()).userAgent).toBeUndefined();
    expect(requestContextFrom(new Headers({ 'user-agent': '  ' })).userAgent).toBeUndefined();
    expect(forwardHeaders({ requestId: 'r', clientIp: '203.0.113.7' })).not.toHaveProperty(
      'User-Agent',
    );
  });

  it('WEB-10 un User-Agent enorme se recorta a 512 caracteres', () => {
    const context = requestContextFrom(new Headers({ 'user-agent': 'A'.repeat(5_000) }));
    expect(context.userAgent).toHaveLength(512);
  });

  it('WEB-10 lo reenvía en los headers hacia la API', () => {
    expect(
      forwardHeaders({ requestId: 'r', clientIp: '203.0.113.7', userAgent: CHROME }),
    ).toMatchObject({ 'User-Agent': CHROME });
  });
});

describe('forwardHeaders', () => {
  it('WEB-10 arma los headers hacia la API con la IP del cliente y el request id', () => {
    expect(forwardHeaders({ requestId: 'bff-123', clientIp: '203.0.113.7' })).toEqual({
      'X-Request-Id': 'bff-123',
      'X-Forwarded-For': '203.0.113.7',
    });
  });
});

describe('getRequestContext', () => {
  it('WEB-10 lee los headers de la petición en curso', async () => {
    expect(await getRequestContext()).toEqual({ requestId: 'bff-123', clientIp: '203.0.113.7' });
  });
});
