const FROM = '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f';
const TO = '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D';

export const baseTransfer = {
  fromAccountId: FROM,
  destination: { type: 'BENEFICIARY', beneficiaryId: TO },
  amount: '1250.5',
  concept: 'Renta',
  reference: '1234567',
};

export interface TransferBodyVector {
  readonly name: string;
  readonly body: unknown;
  /** Errores esperados como `pointer code`; vacío = el cuerpo es válido. */
  readonly errors: readonly string[];
  /** `true` si Ajv, sin `ajv-formats`, no puede cotejar la regla con `openapi.yaml` (formatos `uuid` y `date-time`, o una regla que JSON Schema no expresa). */
  readonly beyondJsonSchema?: boolean;
}

function without(key: keyof typeof baseTransfer): Record<string, unknown> {
  return Object.fromEntries(Object.entries(baseTransfer).filter(([name]) => name !== key));
}

/**
 * Cuerpos de `CreateTransferRequest` con el resultado que MUST dar la validación compartida: el
 * paquete (`transferForm`) y la API (`createTransferRequestSchema`, que compone el esquema del
 * paquete) comparten estos casos, y los que expresa JSON Schema también se cotejan con `openapi.yaml`.
 */
export const transferBodyVectors: readonly TransferBodyVector[] = [
  { name: 'cuerpo completo válido', body: baseTransfer, errors: [] },
  { name: 'sin referencia', body: without('reference'), errors: [] },
  {
    name: 'referencia vacía (sin referencia)',
    body: { ...baseTransfer, reference: '' },
    errors: [],
    beyondJsonSchema: true,
  },
  {
    name: 'destino OWN_ACCOUNT',
    body: { ...baseTransfer, destination: { type: 'OWN_ACCOUNT', accountId: TO } },
    errors: [],
  },
  { name: 'monto entero', body: { ...baseTransfer, amount: '100' }, errors: [] },
  {
    name: 'instante programado con desfase',
    body: { ...baseTransfer, scheduledFor: '2026-10-20T14:30:00-06:00' },
    errors: [],
  },
  {
    name: 'campo no declarado',
    body: { ...baseTransfer, extra: 1 },
    errors: ['/extra UNKNOWN_FIELD'],
  },
  {
    name: 'sin fromAccountId',
    body: without('fromAccountId'),
    errors: ['/fromAccountId REQUIRED'],
  },
  {
    name: 'fromAccountId que no es UUID',
    body: { ...baseTransfer, fromAccountId: 'abc' },
    errors: ['/fromAccountId INVALID_FORMAT'],
    beyondJsonSchema: true,
  },
  {
    name: 'fromAccountId numérico',
    body: { ...baseTransfer, fromAccountId: 5 },
    errors: ['/fromAccountId INVALID_TYPE'],
  },
  { name: 'sin destino', body: without('destination'), errors: ['/destination REQUIRED'] },
  {
    name: 'destino que no es objeto',
    body: { ...baseTransfer, destination: 'x' },
    errors: ['/destination INVALID_TYPE'],
  },
  {
    name: 'destino sin tipo',
    body: { ...baseTransfer, destination: { beneficiaryId: TO } },
    errors: ['/destination/type REQUIRED'],
  },
  {
    name: 'destino con tipo desconocido',
    body: { ...baseTransfer, destination: { type: 'CLABE', beneficiaryId: TO } },
    errors: ['/destination/type INVALID_FORMAT'],
  },
  {
    name: 'OWN_ACCOUNT con beneficiaryId',
    body: { ...baseTransfer, destination: { type: 'OWN_ACCOUNT', beneficiaryId: TO } },
    errors: ['/destination/beneficiaryId UNKNOWN_FIELD', '/destination/accountId REQUIRED'],
  },
  {
    name: 'BENEFICIARY sin id',
    body: { ...baseTransfer, destination: { type: 'BENEFICIARY' } },
    errors: ['/destination/beneficiaryId REQUIRED'],
  },
  {
    name: 'destino con id que no es UUID',
    body: { ...baseTransfer, destination: { type: 'BENEFICIARY', beneficiaryId: 'x' } },
    errors: ['/destination/beneficiaryId INVALID_FORMAT'],
    beyondJsonSchema: true,
  },
  {
    name: 'destino con id numérico',
    body: { ...baseTransfer, destination: { type: 'OWN_ACCOUNT', accountId: 3 } },
    errors: ['/destination/accountId INVALID_TYPE'],
  },
  {
    name: 'destino con campo de más',
    body: {
      ...baseTransfer,
      destination: { type: 'OWN_ACCOUNT', accountId: TO, beneficiaryId: TO },
    },
    errors: ['/destination/beneficiaryId UNKNOWN_FIELD'],
  },
  { name: 'sin monto', body: without('amount'), errors: ['/amount REQUIRED'] },
  {
    name: 'monto con tres decimales',
    body: { ...baseTransfer, amount: '100.005' },
    errors: ['/amount TOO_MANY_DECIMALS'],
  },
  {
    name: 'monto cero',
    body: { ...baseTransfer, amount: '0.00' },
    errors: ['/amount NOT_POSITIVE'],
  },
  {
    name: 'monto con separador de miles',
    body: { ...baseTransfer, amount: '1,250.50' },
    errors: ['/amount INVALID_FORMAT'],
  },
  {
    name: 'monto en notación científica',
    body: { ...baseTransfer, amount: '1e3' },
    errors: ['/amount INVALID_FORMAT'],
  },
  {
    name: 'monto de 13 dígitos enteros',
    body: { ...baseTransfer, amount: '1000000000000' },
    errors: ['/amount TOO_LARGE'],
  },
  {
    name: 'monto como número JSON',
    body: { ...baseTransfer, amount: 1250.5 },
    errors: ['/amount INVALID_TYPE'],
  },
  { name: 'sin concepto', body: without('concept'), errors: ['/concept REQUIRED'] },
  { name: 'concepto vacío', body: { ...baseTransfer, concept: '' }, errors: ['/concept REQUIRED'] },
  {
    name: 'concepto de 41 caracteres',
    body: { ...baseTransfer, concept: 'a'.repeat(41) },
    errors: ['/concept TOO_LONG'],
  },
  {
    name: 'concepto de 40 caracteres',
    body: { ...baseTransfer, concept: 'é'.repeat(40) },
    errors: [],
  },
  {
    name: 'concepto con espacios en los extremos',
    body: { ...baseTransfer, concept: ' Renta ' },
    errors: ['/concept INVALID_FORMAT'],
  },
  {
    name: 'referencia de 8 dígitos',
    body: { ...baseTransfer, reference: '12345678' },
    errors: ['/reference TOO_LONG'],
  },
  {
    name: 'referencia con letras',
    body: { ...baseTransfer, reference: '12A' },
    errors: ['/reference INVALID_FORMAT'],
  },
  {
    name: 'referencia numérica',
    body: { ...baseTransfer, reference: 123 },
    errors: ['/reference INVALID_TYPE'],
  },
  {
    name: 'instante programado solo con fecha',
    body: { ...baseTransfer, scheduledFor: '2026-10-20' },
    errors: ['/scheduledFor INVALID_FORMAT'],
  },
  {
    name: 'instante programado con segundos',
    body: { ...baseTransfer, scheduledFor: '2026-10-20T14:30:15-06:00' },
    errors: ['/scheduledFor INVALID_FORMAT'],
  },
  {
    name: 'instante programado inexistente',
    body: { ...baseTransfer, scheduledFor: '2026-02-30T14:30:00Z' },
    errors: ['/scheduledFor INVALID_FORMAT'],
    beyondJsonSchema: true,
  },
  {
    name: 'instante programado numérico',
    body: { ...baseTransfer, scheduledFor: 7 },
    errors: ['/scheduledFor INVALID_TYPE'],
  },
];
