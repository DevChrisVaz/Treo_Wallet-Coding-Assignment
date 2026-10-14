/**
 * `npm run db:fund -- --account <id|clabe> --amount <monto>` (ACC-15): fondea una cuenta USER
 * desde la Tesorería con el mismo servicio de asientos que las transferencias, con actor SYSTEM.
 * El monto se valida con `Money.parse` antes de abrir la conexión: si es inválido no se escribe nada.
 */
import { parseArgs } from 'node:util';
import { createContainer } from '../src/composition.js';
import { loadConfig } from '../src/platform/config/config.js';
import { createAppDataSource } from '../src/platform/persistence/data-sources.js';
import { DomainError } from '../src/shared/errors.js';
import { Money, MoneyParseError } from '../src/shared/money.js';

const USAGE = 'Uso: npm run db:fund -- --account <id|clabe> --amount <monto, p. ej. 1000.00>';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

let values: { account?: string | undefined; amount?: string | undefined };
try {
  ({ values } = parseArgs({
    options: { account: { type: 'string' }, amount: { type: 'string' } },
    strict: true,
  }));
} catch {
  fail(USAGE);
}
if (!values.account || !values.amount) fail(USAGE);

let amount: Money;
try {
  amount = Money.parse(values.amount);
} catch (error) {
  fail(
    `Monto inválido: ${error instanceof MoneyParseError ? error.message : 'formato no reconocido'}`,
  );
}

const config = loadConfig(process.env);
const dataSource = createAppDataSource(config.databaseUrl);
await dataSource.initialize();
try {
  const container = await createContainer(config, { dataSource });
  const result = await container.ledger.fundAccount.execute({ account: values.account, amount });
  process.stdout.write(
    `Fondeo ${result.transferId}: +${amount.toDecimalString()} MXN; saldo ${result.balanceAfter.toDecimalString()}\n`,
  );
} catch (error) {
  if (error instanceof DomainError && error.code === 'NOT_FOUND') {
    fail('La cuenta no existe o no es una cuenta de usuario');
  }
  throw error;
} finally {
  await dataSource.destroy();
}
