import type { ScheduledTransferList } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { toTransferView, type OtpPolicy, type ScheduledTransfersReader } from './transfer-view.js';

/**
 * `GET /transfers/scheduled` (TRF-33, D9): las programadas del usuario autenticado en SCHEDULED,
 * por `scheduledFor` y luego por creación, con el mismo mapeo que `getTransfer`. Las ejecutadas,
 * fallidas, canceladas, vencidas y las que esperan su OTP no están en SCHEDULED, así que no salen.
 */
export class ListScheduledTransfers {
  constructor(
    private readonly deps: {
      readonly reader: ScheduledTransfersReader;
      readonly clock: Clock;
      readonly otpPolicy: OtpPolicy;
    },
  ) {}

  async execute(userId: string): Promise<ScheduledTransferList> {
    const { reader, clock, otpPolicy } = this.deps;
    const now = clock.now();
    const items = await reader.listScheduled(userId);
    return { items: items.map((details) => toTransferView(details, now, otpPolicy)) };
  }
}
