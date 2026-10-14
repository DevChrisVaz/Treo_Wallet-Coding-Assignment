import { describe, expect, it } from 'vitest';
import {
  DayChangedWhileWaiting,
  TransferLocker,
} from '../../../src/modules/transfers/application/transfer-locker.js';
import type { ResolvedRoute } from '../../../src/modules/transfers/application/destination-resolver.js';
import { PgAccountLocks } from '../../../src/modules/transfers/infrastructure/pg-account-locks.js';
import { PgDailyUsage } from '../../../src/modules/transfers/infrastructure/pg-daily-usage.js';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { Money } from '../../../src/shared/money.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

function locker(clock: FakeClock) {
  return new TransferLocker(
    new PgDailyUsage(harness.app),
    new PgAccountLocks(harness.app),
    clock,
    Money.parse('50000.00'),
  );
}

const runner = () => new TypeormTransactionRunner(harness.app);

describe('TRF-24 bloqueos de una transferencia', () => {
  it('TRF-13 una transferencia a terceros crea y bloquea la fila contador del día de CDMX', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const clock = new FakeClock('2026-10-14T05:30:00.000Z'); // 23:30 del 13 en CDMX
    const route: ResolvedRoute = {
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principalId,
      toAccountId: luis.principalId,
      beneficiaryId: null,
    };
    const acquired = await runner().run((tx) => locker(clock).acquire(tx, ana.userId, route));
    expect(acquired.day).toBe('2026-10-13');
    expect(acquired.counter?.used.toDecimalString()).toBe('0.00');
    expect(acquired.counter?.limit.toDecimalString()).toBe('50000.00');
    expect(acquired.from.id).toBe(ana.principalId);
    expect(acquired.to.id).toBe(luis.principalId);
    const rows = await harness.migrator.query(
      `SELECT day::text, used_cents, limit_cents FROM app.daily_transfer_usage WHERE user_id = $1`,
      [ana.userId],
    );
    expect(rows).toEqual([{ day: '2026-10-13', used_cents: '0', limit_cents: '5000000' }]);
  });

  it('TRF-06 la propiedad se verifica en la sentencia de bloqueo: un origen ajeno es 404', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const route: ResolvedRoute = {
      kind: 'OWN',
      fromAccountId: luis.principalId,
      toAccountId: ana.ahorroId,
      beneficiaryId: null,
    };
    await expect(
      runner().run((tx) => locker(new FakeClock()).acquire(tx, ana.userId, route)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('TRF-06 bajo el bloqueo un destino propio que es de otro usuario es 404', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    // La resolución previa ya dijo "propio", pero la cuenta es de Luis: el bloqueo lo vuelve a comprobar.
    const route: ResolvedRoute = {
      kind: 'OWN',
      fromAccountId: ana.principalId,
      toAccountId: luis.principalId,
      beneficiaryId: null,
    };
    await expect(
      runner().run((tx) => locker(new FakeClock()).acquire(tx, ana.userId, route)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('TRF-06 bajo el bloqueo el destino de un beneficiario debe ser una cuenta de usuario: Tesorería es 404', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const route: ResolvedRoute = {
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principalId,
      toAccountId: TREASURY_ACCOUNT_ID,
      beneficiaryId: null,
    };
    await expect(
      runner().run((tx) => locker(new FakeClock()).acquire(tx, ana.userId, route)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('TRF-12 si la medianoche de CDMX llega mientras se esperan los bloqueos, pide reintentar', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const clock = new FakeClock();
    clock.queue('2026-10-14T05:59:59.900Z', '2026-10-14T06:00:00.100Z');
    const route: ResolvedRoute = {
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principalId,
      toAccountId: luis.principalId,
      beneficiaryId: null,
    };
    await expect(
      runner().run((tx) => locker(clock).acquire(tx, ana.userId, route)),
    ).rejects.toBeInstanceOf(DayChangedWhileWaiting);
  });

  it('TRF-13 la fila contador hace esperar a otra transferencia a terceros del mismo usuario', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const route: ResolvedRoute = {
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principalId,
      toAccountId: luis.principalId,
      beneficiaryId: null,
    };
    const otherRoute: ResolvedRoute = { ...route, fromAccountId: ana.ahorroId };
    const events: string[] = [];
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const firstLocked = new Promise<void>((resolve) => (locked = resolve));
    const first = runner().run(async (tx) => {
      await locker(new FakeClock()).acquire(tx, ana.userId, route);
      events.push('primera bloqueó');
      locked();
      await hold;
      events.push('primera confirma');
    });
    await firstLocked;
    const second = runner().run(async (tx) => {
      await locker(new FakeClock()).acquire(tx, ana.userId, otherRoute);
      events.push('segunda bloqueó');
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(events).toEqual(['primera bloqueó']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['primera bloqueó', 'primera confirma', 'segunda bloqueó']);
  });

  it('TRF-24 las cuentas se bloquean en orden de id aunque el origen sea mayor que el destino', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const [a, b] = [ana.principalId, ana.ahorroId].sort();
    const route: ResolvedRoute = {
      kind: 'OWN',
      fromAccountId: b as string,
      toAccountId: a as string,
      beneficiaryId: null,
    };
    const acquired = await runner().run((tx) =>
      locker(new FakeClock()).acquire(tx, ana.userId, route),
    );
    expect([acquired.from.id, acquired.to.id]).toEqual([b, a]);
    expect(acquired.counter).toBeNull();
  });
});
