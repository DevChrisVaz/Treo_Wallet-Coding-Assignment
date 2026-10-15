import { describe, expect, it } from 'vitest';
import type { SessionData, SessionStore } from '@/lib/server/session-store';
import { sessionData } from './session';

/** Cómo se crea y se hace avanzar el tiempo de una implementación del `SessionStore`. */
export interface SessionStoreHarness {
  /** Plazo de inactividad con el que se crea el almacén. */
  idleMs: number;
  create(): SessionStore;
  /** Avanza el tiempo: reloj falso en memoria, espera real en Redis. */
  advance(ms: number): Promise<void>;
}

/**
 * Comportamiento de WEB-03 que cumple toda implementación del puerto (D6 de web-redis-sessions).
 * Los tiempos son fracciones del plazo, con margen para las implementaciones con tiempo real.
 */
export function describeSessionStoreContract(name: string, harness: () => SessionStoreHarness) {
  describe(`${name}: contrato del SessionStore`, () => {
    function session(overrides: Partial<SessionData> = {}): SessionData {
      return sessionData(overrides, new Date());
    }

    it('WEB-03 devuelve la sesión tal como se guardó', async () => {
      const store = harness().create();
      const data = session();
      await store.set('sid-1', data);
      expect(await store.get('sid-1')).toEqual(data);
    });

    it('WEB-03 la sesión sigue activa antes de que pase el plazo de inactividad', async () => {
      const { create, advance, idleMs } = harness();
      const store = create();
      await store.set('sid-1', session());
      await advance(idleMs * 0.5);
      expect(await store.get('sid-1')).not.toBeNull();
    });

    it('WEB-03 touch renueva el plazo: sigue activa pasado el plazo original', async () => {
      const { create, advance, idleMs } = harness();
      const store = create();
      await store.set('sid-1', session());
      await advance(idleMs * 0.6);
      const touchedAt = new Date();
      await store.touch('sid-1', touchedAt);
      await advance(idleMs * 0.6);
      expect((await store.get('sid-1'))?.lastSeenAt).toBe(touchedAt.toISOString());
    });

    it('WEB-03 sin peticiones durante el plazo de inactividad la sesión se descarta', async () => {
      const { create, advance, idleMs } = harness();
      const store = create();
      await store.set('sid-1', session());
      await advance(idleMs * 1.3);
      expect(await store.get('sid-1')).toBeNull();
    });

    it('WEB-03 la sesión expira cuando la familia del refresh alcanza su vigencia absoluta', async () => {
      const { create, advance, idleMs } = harness();
      const store = create();
      const deadline = new Date(Date.now() + idleMs * 0.3).toISOString();
      await store.set('sid-1', session({ refreshTokenExpiresAt: deadline }));
      await advance(idleMs * 0.6);
      await store.touch('sid-1', new Date());
      expect(await store.get('sid-1')).toBeNull();
    });

    it('WEB-05 delete elimina la sesión', async () => {
      const store = harness().create();
      await store.set('sid-1', session());
      await store.delete('sid-1');
      expect(await store.get('sid-1')).toBeNull();
    });

    it('WEB-03 touch de una sesión inexistente no la crea', async () => {
      const store = harness().create();
      await store.touch('no-existe', new Date());
      expect(await store.get('no-existe')).toBeNull();
    });
  });
}
