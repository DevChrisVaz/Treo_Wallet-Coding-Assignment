import type { ApiClient, CreateTransferRequest } from '@devchrisvaz/wallet-contract';

import { required } from '@/features/accounts/queries';

import type { TransferTransport } from './transfer-attempt';

/**
 * Transporte de `TransferAttempt` sobre el cliente de la API. El cuerpo de `createTransfer` es el
 * payload congelado tal cual (mismo fingerprint en cada reintento); `Idempotent-Replayed: true`
 * marca la respuesta a un reintento reconocido.
 */
export function createTransferTransport(api: ApiClient): TransferTransport {
  return {
    async create(key, payload) {
      const { data, response } = await api.POST('/transfers', {
        params: { header: { 'Idempotency-Key': key } },
        body: JSON.parse(payload) as CreateTransferRequest,
        bodySerializer: () => payload,
      });
      return {
        transfer: required(data),
        replayed: response.headers.get('Idempotent-Replayed') === 'true',
      };
    },
    async confirm(transferId, otp) {
      const { data } = await api.POST('/transfers/{transferId}/confirm', {
        params: { path: { transferId } },
        body: { otp },
      });
      return required(data);
    },
    async resend(transferId) {
      const { data } = await api.POST('/transfers/{transferId}/otp/resend', {
        params: { path: { transferId } },
      });
      return required(data);
    },
  };
}
