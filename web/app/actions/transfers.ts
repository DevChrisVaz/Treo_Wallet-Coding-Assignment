'use server';

import {
  otpCode,
  transferForm,
  type OtpChallenge,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import * as z from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { ActionFailure, sessionAction } from '@/lib/server/action';

const IDEMPOTENCY_KEY = z.uuid();
const transferIdForm = z.strictObject({ transferId: z.uuid() });
const confirmForm = z.strictObject({ transferId: z.uuid(), otp: otpCode });

/**
 * La llave la genera el navegador una vez por intento (WEB-17). La web la reenvía sin cambios y
 * nunca la inventa: sin una llave válida no llama a la API (WEB-10).
 */
function requireIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new ActionFailure({
      type: '/problems/idempotency-key-missing',
      title: 'Falta la llave de idempotencia',
      status: 400,
      code: 'IDEMPOTENCY_KEY_MISSING',
    });
  }
  const parsed = IDEMPOTENCY_KEY.safeParse(value);
  if (!parsed.success) {
    throw new ActionFailure({
      type: '/problems/idempotency-key-invalid',
      title: 'Llave de idempotencia inválida',
      status: 400,
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }
  return parsed.data;
}

/**
 * Crea la transferencia con la `Idempotency-Key` del navegador, en exactamente una llamada a la API
 * (sin reintentos de la web). `replayed` indica que la API respondió el estado actual de un intento
 * anterior con la misma llave (`200` con `Idempotent-Replayed: true`).
 */
export async function createTransfer(
  input: unknown,
  idempotencyKey: unknown,
): Promise<ActionResult<{ transfer: Transfer; replayed: boolean }>> {
  return sessionAction(transferForm, input, async ({ data, api }) => {
    const key = requireIdempotencyKey(idempotencyKey);
    const { data: transfer, response } = await api.POST('/transfers', {
      params: { header: { 'Idempotency-Key': key } },
      body: data,
    });
    if (!transfer) throw new Error('createTransfer respondió sin transferencia');
    return { transfer, replayed: response.headers.get('Idempotent-Replayed') === 'true' };
  });
}

/** Confirma una transferencia `PENDING_OTP` con el código de 6 dígitos (WEB-18). */
export async function confirmTransfer(input: unknown): Promise<ActionResult<Transfer>> {
  return sessionAction(confirmForm, input, async ({ data, api }) => {
    const { data: transfer } = await api.POST('/transfers/{transferId}/confirm', {
      params: { path: { transferId: data.transferId } },
      body: { otp: data.otp },
    });
    if (!transfer) throw new Error('confirmTransfer respondió sin transferencia');
    return transfer;
  });
}

/** Reenvía el código de una transferencia pendiente (WEB-18). */
export async function resendTransferOtp(input: unknown): Promise<ActionResult<OtpChallenge>> {
  return sessionAction(transferIdForm, input, async ({ data, api }) => {
    const { data: challenge } = await api.POST('/transfers/{transferId}/otp/resend', {
      params: { path: { transferId: data.transferId } },
    });
    if (!challenge) throw new Error('resendTransferOtp respondió sin reto');
    return challenge;
  });
}
