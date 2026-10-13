import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'yaml';

/** El contrato tal como lo publica el paquete: fuente independiente del código bajo prueba. */
export const contractPath = createRequire(import.meta.url).resolve(
  '@devchrisvaz/wallet-contract/openapi.yaml',
);

export interface OpenApiDocument {
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: {
    schemas: Record<string, Record<string, unknown> & { enum?: string[] }>;
    responses: Record<string, Record<string, unknown>>;
    parameters: Record<string, Record<string, unknown>>;
    headers: Record<string, Record<string, unknown>>;
  };
}

export const contract = parse(readFileSync(contractPath, 'utf8')) as OpenApiDocument;

export function contractEnum(schemaName: string): string[] {
  const values = contract.components.schemas[schemaName]?.enum;
  if (!values) throw new Error(`El esquema ${schemaName} no tiene enum en el contrato`);
  return values;
}
