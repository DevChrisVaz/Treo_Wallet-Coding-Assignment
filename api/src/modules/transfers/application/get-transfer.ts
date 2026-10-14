import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { notFound } from './destination-resolver.js';
import { toTransferView, type OtpPolicy, type TransferDetailsReader } from './transfer-view.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `GET /transfers/{transferId}` (TRF-26, TRF-19): la transferencia como comprobante, solo para quien
 * la envió (el dueño de la cuenta de origen). Un id mal formado, inexistente, ajeno o de un fondeo
 * responde 404 por igual. El estado `EXPIRED` se calcula al leer.
 */
export class GetTransfer {
  constructor(
    private readonly deps: {
      readonly details: TransferDetailsReader;
      readonly clock: Clock;
      readonly otpPolicy: OtpPolicy;
    },
  ) {}

  async execute(userId: string, transferId: string): Promise<Transfer> {
    if (!UUID.test(transferId)) throw notFound();
    const details = await this.deps.details.find(transferId.toLowerCase());
    if (!details || details.userId !== userId || details.kind === 'FUNDING') throw notFound();
    return toTransferView(details, this.deps.clock.now(), this.deps.otpPolicy);
  }
}
