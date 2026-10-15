/**
 * Intento de transferencia en vuelo (MOB-11): la `Idempotency-Key`, el payload congelado y el
 * borrador, guardados en el almacenamiento seguro para sobrevivir a que el sistema mate la app
 * mientras se envía o queda incierto. Al reabrir, repetir la misma llave y los mismos bytes hace
 * que la API devuelva el estado real (`Idempotent-Replayed`). Nunca AsyncStorage, y no guarda más
 * de lo que el intento ya necesita: ni tokens, ni código OTP, ni nombres o saldos.
 *
 * Vence a las 24 horas. Ese plazo lo elige la app, no la API: la llave de idempotencia es una
 * columna única de `transfers` (`uq_transfers_user_idempotency_key`, api/migrations) sin TTL ni
 * purga, así que la API la reconoce mientras exista la transferencia; la tabla genérica con TTL
 * sigue pendiente en "qué haría con más tiempo". Pasado el día, el estado se consulta en
 * Movimientos y no se reenvía a ciegas un pago viejo. La sesión lo borra al cerrarse o al iniciar
 * otra (como la preferencia de desbloqueo).
 */
import * as SecureStore from 'expo-secure-store';

export const PENDING_TRANSFER_KEY = 'treowallet.pendingTransfer';

/** Vigencia del intento guardado. */
export const PENDING_TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingTransfer {
  key: string;
  payload: string;
  draft: {
    fromAccountId: string;
    beneficiaryId: string;
    amount: string;
    concept: string;
    reference: string;
  };
}

interface StoredPendingTransfer extends PendingTransfer {
  /** Milisegundos desde la época en que se guardó; fija el vencimiento. */
  savedAt: number;
}

// Las mismas opciones que el refresh token: solo con el dispositivo desbloqueado y sin respaldos.
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const DRAFT_FIELDS = ['fromAccountId', 'beneficiaryId', 'amount', 'concept', 'reference'] as const;

function isStored(value: unknown): value is StoredPendingTransfer {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const draft = record.draft as Record<string, unknown> | null | undefined;
  return (
    typeof record.key === 'string' &&
    record.key !== '' &&
    typeof record.payload === 'string' &&
    typeof record.savedAt === 'number' &&
    typeof draft === 'object' &&
    draft !== null &&
    DRAFT_FIELDS.every((field) => typeof draft[field] === 'string')
  );
}

/** Guarda el intento; si el almacenamiento falla, el envío sigue sin protección ante un cierre. */
export async function savePendingTransfer(
  pending: PendingTransfer,
  now: () => number = Date.now,
): Promise<void> {
  const stored: StoredPendingTransfer = {
    key: pending.key,
    payload: pending.payload,
    draft: pending.draft,
    savedAt: now(),
  };
  try {
    await SecureStore.setItemAsync(PENDING_TRANSFER_KEY, JSON.stringify(stored), SECURE_OPTIONS);
  } catch {
    console.warn('No se pudo guardar la transferencia en curso en el almacenamiento seguro.');
  }
}

/** El intento guardado, o `null` si no hay, está dañado o venció (en esos dos casos lo borra). */
export async function loadPendingTransfer(
  now: () => number = Date.now,
): Promise<PendingTransfer | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(PENDING_TRANSFER_KEY, SECURE_OPTIONS);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!isStored(parsed) || now() - parsed.savedAt >= PENDING_TRANSFER_TTL_MS) {
    await clearPendingTransfer();
    return null;
  }
  return { key: parsed.key, payload: parsed.payload, draft: parsed.draft };
}

export async function clearPendingTransfer(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_TRANSFER_KEY, SECURE_OPTIONS);
  } catch {
    console.warn('No se pudo borrar la transferencia en curso del almacenamiento seguro.');
  }
}
