import { isPeriodBeforeCreation } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { AppLogger } from '../../../shared/logger.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { StatementPeriod, StatementPeriodError } from '../domain/statement-period.js';
import {
  StatementReconciliationError,
  StatementSummary,
  type ReconciledSummary,
} from '../domain/statement-summary.js';
import type { StatementReader, StatementRenderer } from './ports.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GeneratedStatement {
  readonly bytes: Uint8Array;
  /** `estado-de-cuenta-<periodo>-<últimos 4 dígitos de la CLABE>.pdf`. */
  readonly filename: string;
}

function notFound(): DomainError {
  return new DomainError('NOT_FOUND', 'La cuenta no existe');
}

/** El periodo validado contra el reloj; un periodo inválido es 422 en `/period` (PLT-02). */
function parsePeriod(value: string, clock: Clock): StatementPeriod {
  try {
    return StatementPeriod.parse(value, clock);
  } catch (error) {
    if (!(error instanceof StatementPeriodError)) throw error;
    throw new DomainError('VALIDATION_FAILED', 'Revisa el periodo', {
      errors: [{ pointer: '/period', code: error.code, message: error.message }],
    });
  }
}

/**
 * `GET /accounts/{accountId}/statements/{period}` (HIS-11, HIS-12, AUD-07; D2 de
 * account-statements):
 * 1. valida el periodo contra el `Clock` (422);
 * 2. abre la instantánea del lector y verifica ahí la propiedad de la cuenta (404, ACC-06) y que
 *    el periodo no sea anterior al mes de apertura de la cuenta en CDMX (422 en `/period`, HIS-11);
 * 3. acumula el resumen mientras el renderizador recibe los renglones por tandas;
 * 4. verifica la conciliación: si no cuadra, log ERROR con alerta y 500, y el documento no sale;
 * 5. registra `STATEMENT_EXPORTED` en su propia transacción (no acompaña un cambio de negocio,
 *    AUD-03); si falla, la petición falla y no se entrega nada;
 * 6. devuelve los bytes y el nombre del archivo.
 * Los rechazos (404, 422) ocurren antes de auditar, así que no dejan evento.
 */
export class GenerateStatement {
  constructor(
    private readonly deps: {
      readonly reader: StatementReader;
      readonly renderer: StatementRenderer;
      readonly audit: AuditWriter;
      readonly clock: Clock;
      readonly logger: AppLogger;
    },
  ) {}

  async execute(
    userId: string,
    accountId: string,
    periodValue: string,
  ): Promise<GeneratedStatement> {
    const period = parsePeriod(periodValue, this.deps.clock);
    if (!UUID.test(accountId)) throw notFound();

    const read = await this.deps.reader.withSnapshot(async (snapshot) => {
      const account = await snapshot.account(userId, accountId);
      if (!account) throw notFound();
      // Después de la propiedad: una cuenta ajena sigue siendo 404 y no revela su fecha de apertura.
      if (isPeriodBeforeCreation(period.value, account.createdAt)) {
        throw new DomainError('VALIDATION_FAILED', 'Revisa el periodo', {
          errors: [
            {
              pointer: '/period',
              code: 'DATE_OUT_OF_RANGE',
              message: 'El periodo es anterior a la apertura de tu cuenta',
            },
          ],
        });
      }
      const summary = StatementSummary.open(
        await snapshot.openingBalance(account.id, period.start),
      );
      const document = this.deps.renderer.begin({ account, period });
      for await (const batch of snapshot.movements(account.id, period.start, period.endExclusive)) {
        for (const row of batch) summary.add(row);
        document.addRows(batch);
      }
      return { account, summary, document };
    });

    const summary = this.reconcile(read.summary, read.account.id, period.value);
    const bytes = await read.document.finish(summary);
    await this.deps.audit.recordStandalone({
      action: 'STATEMENT_EXPORTED',
      actor: { type: 'USER', userId },
      entity: { type: 'ACCOUNT', id: read.account.id },
      metadata: { period: period.value },
    });
    return {
      bytes,
      filename: `estado-de-cuenta-${period.value}-${read.account.clabe.slice(-4)}.pdf`,
    };
  }

  private reconcile(
    summary: StatementSummary,
    accountId: string,
    period: string,
  ): ReconciledSummary {
    try {
      return summary.close();
    } catch (error) {
      if (!(error instanceof StatementReconciliationError)) throw error;
      this.deps.logger.error(
        {
          alert: true,
          accountId,
          period,
          openingCents: error.openingCents.toString(),
          creditsCents: error.creditsCents.toString(),
          debitsCents: error.debitsCents.toString(),
          closingCents: error.closingCents.toString(),
        },
        'statement does not reconcile',
      );
      throw new DomainError('INTERNAL_ERROR');
    }
  }
}
