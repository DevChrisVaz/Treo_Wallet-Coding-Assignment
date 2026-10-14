import { EntitySchema } from 'typeorm';
import { bigintTransformer } from '../../../platform/persistence/bigint-transformer.js';

/** Fila de `accounts`. `balance_cents` es BIGINT y se lee como `bigint`, nunca como `number`. */
export interface AccountRow {
  id: string;
  userId: string | null;
  type: 'USER' | 'SYSTEM';
  name: string;
  clabe: string | null;
  balanceCents: bigint;
  createdAt: Date;
}

export const AccountEntity = new EntitySchema<AccountRow>({
  name: 'Account',
  tableName: 'accounts',
  columns: {
    id: { type: 'uuid', primary: true },
    userId: { type: 'uuid', name: 'user_id', nullable: true },
    type: { type: 'text' },
    name: { type: 'text' },
    clabe: { type: 'text', nullable: true },
    balanceCents: { type: 'bigint', name: 'balance_cents', transformer: bigintTransformer },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});
