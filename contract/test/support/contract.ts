import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

/** El contrato real, leído del disco: fuente independiente del código bajo prueba. */
export const contract = parse(readFileSync(resolve(__dirname, '../../openapi.yaml'), 'utf8')) as {
  components: { schemas: Record<string, { enum?: string[] } & Record<string, unknown>> };
};

export function contractEnum(schemaName: string): string[] {
  const values = contract.components.schemas[schemaName]?.enum;
  if (!values) throw new Error(`El esquema ${schemaName} no tiene enum en el contrato`);
  return values;
}
