import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { parse } from 'yaml';

/** El contrato tal como lo publica el paquete: fuente independiente del código bajo prueba. */
export const contractPath = createRequire(import.meta.url).resolve(
  '@devchrisvaz/wallet-contract/openapi.yaml',
);

type Json = Record<string, unknown>;

export interface OpenApiDocument {
  paths: Record<string, Record<string, Json>>;
  components: {
    schemas: Record<string, Json & { enum?: string[] }>;
    responses: Record<string, Json>;
    parameters: Record<string, Json>;
    headers: Record<string, Json>;
  };
}

export const contract = parse(readFileSync(contractPath, 'utf8')) as OpenApiDocument;

export function contractEnum(schemaName: string): string[] {
  const values = contract.components.schemas[schemaName]?.enum;
  if (!values) throw new Error(`El esquema ${schemaName} no tiene enum en el contrato`);
  return values;
}

// OpenAPI 3.1 usa el dialecto JSON Schema 2020-12. `strict: false` ignora palabras propias de
// OpenAPI como `discriminator` (la unión se valida igual con `oneOf`).
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;
const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true }));
ajv.addSchema({ ...contract, $id: 'openapi' });

/** Referencia al documento `openapi` con un puntero JSON (RFC 6901) a partir de segmentos. */
function ref(segments: readonly string[]): string {
  return `openapi#/${segments.map((s) => s.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

interface OperationLocation {
  readonly path: string;
  readonly method: string;
  readonly responses: Record<string, Json>;
}

const operations = new Map<string, OperationLocation>();
for (const [path, methods] of Object.entries(contract.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    const operationId = operation.operationId as string | undefined;
    if (operationId) {
      operations.set(operationId, {
        path,
        method,
        responses: operation.responses as Record<string, Json>,
      });
    }
  }
}

const validators = new Map<string, ValidateFunction>();
function validatorAt(schemaRef: string): ValidateFunction {
  let validate = validators.get(schemaRef);
  if (!validate) {
    validate = ajv.compile({ $ref: schemaRef });
    validators.set(schemaRef, validate);
  }
  return validate;
}

/** Lo mínimo de una respuesta de supertest que necesita la verificación. */
export interface ContractResponse {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly text: string;
}

function header(res: ContractResponse, name: string): string | undefined {
  const value = res.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Verifica que una respuesta cumpla lo que `openapi.yaml` declara para esa operación y status
 * (PLT-12): status declarado, Content-Type, esquema del cuerpo (Ajv 2020-12 con formatos),
 * headers declarados y `X-Request-Id` (PLT-05). Lanza un error que nombra la operación y el campo.
 */
export function expectToMatchContract(res: ContractResponse, operationId: string): void {
  const operation = operations.get(operationId);
  if (!operation) throw new Error(`La operación ${operationId} no existe en el contrato`);
  const where = `${operationId} ${res.status}`;

  let response = operation.responses[String(res.status)];
  let location: string[] = [
    'paths',
    operation.path,
    operation.method,
    'responses',
    String(res.status),
  ];
  if (!response) {
    throw new Error(`${where}: el contrato no declara el status ${res.status} para ${operationId}`);
  }
  if (typeof response.$ref === 'string') {
    const name = response.$ref.split('/').pop() as string;
    response = contract.components.responses[name] as Json;
    location = ['components', 'responses', name];
  }

  if (!header(res, 'X-Request-Id')) throw new Error(`${where}: falta el header X-Request-Id`);

  const declaredHeaders = (response.headers ?? {}) as Record<string, Json>;
  for (const [name, spec] of Object.entries(declaredHeaders)) {
    const value = header(res, name);
    if (value === undefined) continue;
    const schemaRef =
      typeof spec.$ref === 'string'
        ? `openapi${spec.$ref}/schema`
        : ref([...location, 'headers', name, 'schema']);
    const candidate = /^-?[0-9]+$/.test(value) ? Number(value) : value;
    const validate = validatorAt(schemaRef);
    if (!validate(candidate) && !validate(value)) {
      throw new Error(`${where}: el header ${name}=${value} no cumple el contrato`);
    }
  }
  if (res.status === 429 && !header(res, 'Retry-After')) {
    throw new Error(`${where}: falta el header Retry-After`);
  }

  const content = response.content as Record<string, Json> | undefined;
  if (!content) {
    if (res.text)
      throw new Error(`${where}: el contrato no declara cuerpo y la respuesta trae uno`);
    return;
  }
  const contentType = (header(res, 'Content-Type') ?? '').split(';')[0]?.trim() ?? '';
  const mediaType = Object.keys(content).find((type) => type === contentType);
  if (!mediaType) {
    throw new Error(
      `${where}: Content-Type "${contentType}" no es ${Object.keys(content).join(' ni ')}`,
    );
  }
  const validate = validatorAt(ref([...location, 'content', mediaType, 'schema']));
  if (!validate(res.body)) {
    const details = (validate.errors ?? [])
      .map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`)
      .join('; ');
    throw new Error(`${where}: el cuerpo no cumple el contrato: ${details}`);
  }
  if (mediaType === 'application/problem+json') {
    const status = (res.body as { status?: unknown }).status;
    if (status !== res.status) {
      throw new Error(`${where}: el campo status del problem (${String(status)}) no coincide`);
    }
  }
}
