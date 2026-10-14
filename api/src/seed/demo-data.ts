import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { PgAuditWriter } from '../modules/audit/infrastructure/pg-audit-writer.js';
import { FundAccount } from '../modules/transfers/application/fund-account.js';
import { LedgerPoster } from '../modules/transfers/application/ledger-poster.js';
import { PgAccountLocks } from '../modules/transfers/infrastructure/pg-account-locks.js';
import { PgLedgerStore } from '../modules/transfers/infrastructure/pg-ledger-store.js';
import { PgTransferStore } from '../modules/transfers/infrastructure/pg-transfer-store.js';
import { TypeormTransactionRunner } from '../platform/persistence/transaction.js';
import type { Clock } from '../shared/clock.js';
import { Money } from '../shared/money.js';
import { DEMO_USERS, seedUsers } from './demo-users.js';
import { generatedPeople } from './generated-users.js';

export interface SeededAccount {
  readonly id: string;
  readonly clabe: string;
}

export interface SeededUser {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly principal: SeededAccount;
  readonly ahorro: SeededAccount;
}

export interface DemoData {
  readonly ana: SeededUser;
  /** Luis y los usuarios generados. */
  readonly others: readonly SeededUser[];
  /** Beneficiarios de Ana (id y cuenta destino), en orden de alias. */
  readonly anaBeneficiaries: readonly { readonly id: string; readonly accountId: string }[];
  /** Beneficiario "Ana" de cada usuario de `others`, por id de usuario. */
  readonly beneficiaryToAna: ReadonlyMap<string, string>;
}

export interface DemoDataOptions {
  readonly clabe: { readonly bankCode: string; readonly plazaCode: string };
  /** Usuarios generados además de Ana y Luis (50 en el seed completo). */
  readonly generatedUsers: number;
  /** Momento del fondeo inicial (antes de la ventana de movimientos, nunca "hoy"). */
  readonly fundedAt: Date;
}

/** Fondeo inicial (ACC-15): poco para Ana, que recibe más con el tiempo, y holgado para los demás. */
export const INITIAL_FUNDING = {
  ana: Money.parse('10000.00'),
  others: Money.parse('600000.00'),
};
/** Beneficiarios de Ana: Luis y los primeros usuarios generados. */
const ANA_BENEFICIARIES = 10;

async function loadUsers(migrator: DataSource, emails: readonly string[]): Promise<SeededUser[]> {
  const rows: {
    user_id: string;
    email: string;
    full_name: string;
    name: string;
    id: string;
    clabe: string;
  }[] = await migrator.query(
    `SELECT u.id AS user_id, u.email, u.full_name, a.name, a.id, a.clabe
       FROM app.users u JOIN app.accounts a ON a.user_id = u.id
      WHERE u.email = ANY($1)`,
    [[...emails]],
  );
  return emails.map((email) => {
    const mine = rows.filter((row) => row.email === email);
    const account = (name: string): SeededAccount => {
      const row = mine.find((candidate) => candidate.name === name);
      if (!row) throw new Error(`Falta la cuenta ${name} de ${email}`);
      return { id: row.id, clabe: row.clabe };
    };
    const first = mine[0];
    if (!first) throw new Error(`Falta el usuario ${email}`);
    return {
      userId: first.user_id,
      email,
      fullName: first.full_name,
      principal: account('Principal'),
      ahorro: account('Ahorro'),
    };
  });
}

/** Beneficiario por contenido (idempotente por la CLABE del usuario); devuelve su id. */
async function ensureBeneficiary(
  migrator: DataSource,
  owner: SeededUser,
  target: SeededUser,
  alias: string,
  createdAt: Date,
): Promise<string> {
  await migrator.query(
    `INSERT INTO app.beneficiaries (id, user_id, account_id, name, alias, clabe, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ON CONSTRAINT uq_beneficiaries_user_clabe DO NOTHING`,
    [
      randomUUID(),
      owner.userId,
      target.principal.id,
      target.fullName,
      alias,
      target.principal.clabe,
      createdAt,
    ],
  );
  const [row] = await migrator.query(
    `SELECT id FROM app.beneficiaries WHERE user_id = $1 AND clabe = $2`,
    [owner.userId, target.principal.clabe],
  );
  return row.id as string;
}

/**
 * Datos demo base (HIS-10, ACC-15, BEN-01), idempotentes:
 * - Ana, Luis y `generatedUsers` personas sintéticas, verificados y con "Principal" y "Ahorro";
 * - beneficiarios de Ana (Luis, que la app móvil necesita, y otros) y "Ana" para cada usuario, para
 *   que las transferencias a terceros del seed tengan beneficiario como las de la API;
 * - fondeo inicial de cada "Principal" desde la Tesorería con el servicio de fondeo, que registra
 *   `FUNDING_POSTED`, solo si la cuenta aún no tiene movimientos.
 */
export async function seedDemoData(
  migrator: DataSource,
  options: DemoDataOptions,
): Promise<DemoData> {
  const clock: Clock = { now: () => new Date(options.fundedAt) };
  const people = [...DEMO_USERS, ...generatedPeople(options.generatedUsers)];
  await seedUsers(migrator, people, { clabe: options.clabe, clock });
  const [ana, ...others] = await loadUsers(
    migrator,
    people.map((person) => person.email),
  );
  if (!ana) throw new Error('Falta la usuaria demo Ana');

  const anaBeneficiaries: { id: string; accountId: string }[] = [];
  for (const target of others.slice(0, ANA_BENEFICIARIES)) {
    // Alias únicos: Luis por su nombre y los generados por nombre y primer apellido.
    const alias =
      target.email === 'luis@example.com'
        ? 'Luis'
        : target.fullName.split(' ').slice(0, 2).join(' ');
    const id = await ensureBeneficiary(migrator, ana, target, alias, options.fundedAt);
    anaBeneficiaries.push({ id, accountId: target.principal.id });
  }
  const beneficiaryToAna = new Map<string, string>();
  for (const owner of others) {
    beneficiaryToAna.set(
      owner.userId,
      await ensureBeneficiary(migrator, owner, ana, 'Ana', options.fundedAt),
    );
  }

  const fundAccount = new FundAccount({
    transactions: new TypeormTransactionRunner(migrator),
    transfers: new PgTransferStore(),
    locks: new PgAccountLocks(migrator),
    poster: new LedgerPoster(new PgLedgerStore()),
    audit: new PgAuditWriter(migrator, clock),
    clock,
  });
  for (const user of [ana, ...others]) {
    const [{ n }] = await migrator.query(
      `SELECT count(*)::int AS n FROM app.ledger_entries WHERE account_id = $1`,
      [user.principal.id],
    );
    if (n > 0) continue;
    await fundAccount.execute({
      account: user.principal.id,
      amount: user === ana ? INITIAL_FUNDING.ana : INITIAL_FUNDING.others,
      concept: 'Fondeo inicial',
    });
  }
  return { ana, others, anaBeneficiaries, beneficiaryToAna };
}
