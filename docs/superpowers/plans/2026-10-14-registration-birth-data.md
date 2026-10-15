# Registro con datos de nacimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El registro pide nombres, apellido paterno, apellido materno (opcional), fecha de nacimiento y entidad de nacimiento, y valida fecha y entidad contra lo que codifica la CURP.

**Architecture:** La regla vive una sola vez en `contract/` (`registerForm`, catálogo `BIRTH_STATES`, `curpBirthState`); la API la reusa con `registerFormAt` y compone/guarda `fullName` en el caso de uso; la web usa el mismo esquema en su resolver. Contrato 1.4.0 primero, luego la API (migración + caso de uso) y al final la web.

**Tech Stack:** TypeScript, Zod 4 (`contract/`), OpenAPI 3.1 + `openapi-typescript`, Express + TypeORM + PostgreSQL + Vitest (`api/`), Next.js 16 + react-hook-form + Vitest + Playwright (`web/`).

**Spec:** `openspec/changes/registration-birth-data/` (`proposal.md`, `design.md`, `tasks.md` y deltas en `specs/{identity,api-contract,web-app}/spec.md`). Requisitos: IDN-02, CTR-13, CTR-21, WEB-11.

## Global Constraints

- Idioma de textos de usuario y de commits/pruebas: español (es-MX). Palabras clave de OpenSpec en inglés.
- Contrato `1.3.0` → `1.4.0` (`contract/package.json` `version` e `info.version` de `openapi.yaml` deben ser iguales; `npm run check:version`).
- Cada parte del nombre: de 1 a 100 caracteres, sin espacios al inicio, al final ni repetidos, solo letras (con acentos y ñ), apóstrofo, guion y punto. `maternalSurname` vacío = omitido.
- `birthDate`: `YYYY-MM-DD`, existente, igual a la fecha de la CURP, no futura, ≥ 18 años al día de hoy en `America/Mexico_City`. Códigos: `INVALID_FORMAT` (forma o no coincide con la CURP), `INVALID_DATE` (futura o inexistente), `DATE_OUT_OF_RANGE` (menor de 18). Mensajes: «La fecha no coincide con tu CURP».
- `birthState`: uno de 33 códigos (`AS BC BS CC CL CM CS CH DF DG GT GR HG JC MC MN MS NT NL OC PL QT QR SP SL SR TC TS TL VZ YN ZS NE`), igual a los caracteres 12 y 13 de la CURP. Mensaje: «La entidad no coincide con tu CURP».
- Las reglas entre campos solo aplican cuando los campos implicados son válidos por separado.
- `fullName` se compone en la API (`nombres apellidoPaterno [apellidoMaterno]`, unidos por un espacio) y se guarda en `users.full_name` (máximo 100 caracteres). El resto de la app sigue leyendo `fullName`.
- Constraints e índices con nombre y prefijo (`ck_`, `uq_`, …).
- Commits: Conventional Commits con el proyecto como scope, trailers `Task: registration-birth-data#<n.m>` y `Refs: <IDs>`, y `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Un commit nunca cubre dos tareas de `tasks.md`. Los títulos de las pruebas empiezan con el ID del requisito (`IDN-02 …`).
- No tocar `/mobile` ni `/design-tokens`. No hacer commit de los cambios ajenos que ya haya en el árbol (`git add` solo los archivos de cada tarea).

## Review Focus

Entradas que el spec implica pero que ninguna tarea cubre de forma obvia (cada una tiene su prueba en la tarea indicada):

1. **Nombre compuesto de más de 100 caracteres** (cada parte ≤ 100 pero la suma no): `ck_users_full_name_length` daría 500. Se rechaza con `TOO_LONG` en `/firstNames` (Tarea 2, y enmienda al spec en la Tarea 2).
2. **`maternalSurname` de solo espacios** (`"   "`): no es «vacío», es inválido (`INVALID_FORMAT`), no se trata como omitido (Tarea 2).
3. **Fecha con forma casi correcta** (`1990-1-1`, `1990-01-01T00:00:00Z`, `01/01/1990`): `INVALID_FORMAT` en `/birthDate` (Tarea 2).
4. **Código de entidad en minúsculas** (`df`) o con espacios: `INVALID_FORMAT` en `/birthState`, sin normalizar (Tarea 2).
5. **Nacida en 2000 o después y nacido en el extranjero**: CURP con letra en la posición 17 y `birthDate` `20yy-…`; CURP con `NE` y `birthState` `NE` se acepta (Tareas 2 y 3).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `contract/src/validators/birth-states.ts` (nuevo) | Catálogo `BIRTH_STATES`, `BIRTH_STATE_CODES` y `isBirthStateCode`. |
| `contract/src/validators/curp.ts` | Agrega `curpBirthState` junto a `curpBirthDate`. |
| `contract/src/validators/fields.ts` | Agrega `namePart`, `optionalNamePart`, `birthDate` y `birthState` (validadores por campo). |
| `contract/src/validators/forms.ts` | `registerShape` y las reglas entre campos de `registerForm`. |
| `contract/openapi.yaml`, `contract/src/generated/api.d.ts`, `contract/package.json` | `NamePart`, `BirthDate`, `BirthState`, `RegisterRequest` y versión 1.4.0. |
| `contract/test/…` | Pruebas del catálogo, de los campos, del formulario y de paridad. |
| `api/migrations/1760900000000-registration-birth-data.ts` (nuevo), `api/migrations/index.ts` | Cinco columnas nuevas en `app.users`. |
| `api/src/modules/identity/domain/full-name.ts` (nuevo) | `composeFullName`. |
| `api/src/modules/identity/application/{users,register-user}.ts`, `infrastructure/{entities,pg-user-repository}.ts` | Datos nuevos en el registro, el registro de usuario y el repositorio. |
| `api/src/seed/{demo-users,generated-users}.ts`, `api/test/helpers/factories.ts` | Semillas y fábrica con los datos nuevos. |
| `web/components/auth/RegisterForm.tsx` | Formulario con los campos nuevos. |
| `web/components/auth/RegisterForm.test.tsx`, `web/app/actions/auth.test.ts`, `web/e2e/{register.spec.ts,fake-api.mjs}`, `web/test/fixtures.ts` | Pruebas y arneses. |
| `README.md`, `docs/traceability.md`, `openspec/changes/registration-birth-data/tasks.md` | Documentación y casillas. |

---

### Task 1: Catálogo de entidades y `curpBirthState` (tasks.md 1.2)

**Files:**
- Create: `contract/src/validators/birth-states.ts`
- Modify: `contract/src/validators/curp.ts` (después de `curpBirthDate`), `contract/src/validators/index.ts`
- Test: `contract/test/validators/birth-states.test.ts` (nuevo)

**Interfaces:**
- Produces: `BIRTH_STATES: readonly { code: BirthStateCode; name: string }[]`, `type BirthStateCode`, `BIRTH_STATE_CODES: readonly BirthStateCode[]`, `isBirthStateCode(value: string): value is BirthStateCode`, `curpBirthState(value: string): string | null` (`null` si la CURP no tiene la forma).

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// contract/test/validators/birth-states.test.ts
import { describe, expect, it } from 'vitest';
import {
  BIRTH_STATES,
  BIRTH_STATE_CODES,
  curpBirthState,
  isBirthStateCode,
} from '../../src/index';

const CURP_WITH = (state: string) => `GOMC900101H${state}NLR09`;

describe('catálogo de entidades de nacimiento', () => {
  it('CTR-21 tiene 33 entradas sin códigos repetidos y NE al final', () => {
    expect(BIRTH_STATES).toHaveLength(33);
    expect(new Set(BIRTH_STATES.map((state) => state.code)).size).toBe(33);
    expect(BIRTH_STATES.at(-1)).toEqual({ code: 'NE', name: 'Nacido en el extranjero' });
  });

  it('CTR-21 DF es Ciudad de México', () => {
    expect(BIRTH_STATES.find((state) => state.code === 'DF')?.name).toBe('Ciudad de México');
  });

  it.each(BIRTH_STATE_CODES)('CTR-21 el patrón de la CURP acepta %s', (code) => {
    expect(curpBirthState(CURP_WITH(code))).toBe(code);
  });

  it.each(['XX', 'ZZ'])('CTR-21 el patrón de la CURP rechaza %s', (code) => {
    expect(curpBirthState(CURP_WITH(code))).toBeNull();
  });

  it.each(['DF', 'NE', 'JC'])('CTR-21 isBirthStateCode acepta %s', (code) => {
    expect(isBirthStateCode(code)).toBe(true);
  });

  it.each(['df', 'XX', '', 'DFX', ' DF'])('CTR-21 isBirthStateCode rechaza %j', (code) => {
    expect(isBirthStateCode(code)).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd contract && npx vitest run test/validators/birth-states.test.ts`
Expected: FAIL (`BIRTH_STATES` no está exportado).

- [ ] **Step 3: Implementar**

```ts
// contract/src/validators/birth-states.ts
/** Entidad de nacimiento de la CURP: las 32 entidades federativas y `NE` (nacido en el extranjero). */
export const BIRTH_STATES = [
  { code: 'AS', name: 'Aguascalientes' },
  { code: 'BC', name: 'Baja California' },
  { code: 'BS', name: 'Baja California Sur' },
  { code: 'CC', name: 'Campeche' },
  { code: 'CS', name: 'Chiapas' },
  { code: 'CH', name: 'Chihuahua' },
  { code: 'DF', name: 'Ciudad de México' },
  { code: 'CL', name: 'Coahuila' },
  { code: 'CM', name: 'Colima' },
  { code: 'DG', name: 'Durango' },
  { code: 'GT', name: 'Guanajuato' },
  { code: 'GR', name: 'Guerrero' },
  { code: 'HG', name: 'Hidalgo' },
  { code: 'JC', name: 'Jalisco' },
  { code: 'MC', name: 'México' },
  { code: 'MN', name: 'Michoacán' },
  { code: 'MS', name: 'Morelos' },
  { code: 'NT', name: 'Nayarit' },
  { code: 'NL', name: 'Nuevo León' },
  { code: 'OC', name: 'Oaxaca' },
  { code: 'PL', name: 'Puebla' },
  { code: 'QT', name: 'Querétaro' },
  { code: 'QR', name: 'Quintana Roo' },
  { code: 'SP', name: 'San Luis Potosí' },
  { code: 'SL', name: 'Sinaloa' },
  { code: 'SR', name: 'Sonora' },
  { code: 'TC', name: 'Tabasco' },
  { code: 'TS', name: 'Tamaulipas' },
  { code: 'TL', name: 'Tlaxcala' },
  { code: 'VZ', name: 'Veracruz' },
  { code: 'YN', name: 'Yucatán' },
  { code: 'ZS', name: 'Zacatecas' },
  { code: 'NE', name: 'Nacido en el extranjero' },
] as const;

export type BirthStateCode = (typeof BIRTH_STATES)[number]['code'];

export const BIRTH_STATE_CODES: readonly BirthStateCode[] = BIRTH_STATES.map((state) => state.code);

/** Indica si `value` es exactamente uno de los códigos del catálogo (sin normalizar mayúsculas). */
export function isBirthStateCode(value: string): value is BirthStateCode {
  return (BIRTH_STATE_CODES as readonly string[]).includes(value);
}
```

En `contract/src/validators/curp.ts`, justo después de `curpBirthDate`:

```ts
/**
 * Entidad de nacimiento que codifica una CURP (caracteres 12 y 13), o `null` si la CURP no tiene la
 * forma. No revisa la fecha ni el dígito verificador.
 */
export function curpBirthState(value: string): string | null {
  return CURP.test(value) ? value.slice(11, 13) : null;
}
```

En `contract/src/validators/index.ts`, agregar `export * from './birth-states';` (orden alfabético: antes de `clabe`).

- [ ] **Step 4: Verificar que pasa**

Run: `cd contract && npx vitest run test/validators/birth-states.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contract/src/validators/birth-states.ts contract/src/validators/curp.ts contract/src/validators/index.ts contract/test/validators/birth-states.test.ts
git commit -m "feat(contract): add the birth state catalog and curpBirthState" -m "Task: registration-birth-data#1.2
Refs: CTR-21

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(La parte de `openapi.yaml` de 1.2 —`BirthState`— se hace en la Tarea 2, junto al resto del esquema, porque `RegisterRequest` la referencia.)

---

### Task 2: Formulario de registro del contrato 1.4.0 (tasks.md 1.1, 1.3)

**Files:**
- Modify: `contract/src/validators/fields.ts`, `contract/src/validators/forms.ts`, `contract/openapi.yaml` (`RegisterRequest` ≈ línea 935 y schemas nuevos junto a `PersonName` ≈ línea 894), `contract/package.json` (`version`), `contract/src/generated/api.d.ts` (regenerado), `contract/test/vectors/{fields,identity}.ts`, `contract/test/validators/{forms,parity}.test.ts`
- Modify (spec): `openspec/changes/registration-birth-data/specs/{api-contract,identity}/spec.md`
- Reinstalar: `api/` y `web/` (`npm install`)

**Interfaces:**
- Consumes: `isBirthStateCode`, `curpBirthState`, `BIRTH_STATE_CODES` (Tarea 1); `curpBirthDate`, `hasReachedAge`, `isValidCalendarDate`, `mexicoCityDate`, `textField`, `addFieldIssue` (ya existentes).
- Produces: `namePart`, `optionalNamePart`, `birthDate`, `birthState` (validadores de campo); `registerForm`/`registerFormAt(instant)` con forma `{ email, password, firstNames, paternalSurname, maternalSurname?, birthDate, birthState, curp, rfc, phone }`; tipo `RegisterRequest` en `api.d.ts` con esas propiedades.

- [ ] **Step 1: Enmendar el spec con la regla del nombre compuesto (Review Focus 1)**

En `openspec/changes/registration-birth-data/specs/api-contract/spec.md` (CTR-13), después de la viñeta de `firstNames, paternalSurname…`, agregar:

```
- el nombre completo que resulta de unir `firstNames`, `paternalSurname` y `maternalSurname` con un espacio no pasa de 100 caracteres (`TOO_LONG`, en `/firstNames`);
```

y un escenario:

```
#### Scenario: Nombre completo demasiado largo
- **WHEN** el formulario de registro trae `firstNames` de 50 caracteres, `paternalSurname` de 40 y `maternalSurname` de 20
- **THEN** el esquema lo rechaza en `/firstNames` con `TOO_LONG`
```

En `identity/spec.md` (IDN-02), agregar a la viñeta de los nombres «…, y cuya unión con espacios no pase de 100 caracteres (`TOO_LONG` en `/firstNames`)» y el escenario equivalente («La API responde `422 VALIDATION_FAILED` con `pointer` igual a `/firstNames` y `code` `TOO_LONG`, y no crea ningún usuario»).

Run: `npx openspec validate registration-birth-data` — Expected: `Change 'registration-birth-data' is valid`.

- [ ] **Step 2: Escribir las pruebas que fallan**

En `contract/test/validators/forms.test.ts`, reemplazar `validRegister` por:

```ts
const validRegister = {
  email: 'ana@example.com',
  password: 'una-contraseña-1',
  firstNames: 'Ana',
  paternalSurname: 'Gómez',
  maternalSurname: 'Núñez',
  birthDate: '1990-01-01',
  birthState: 'DF',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};
```

Agregar este bloque (nuevo `describe`, al final del archivo, usando los helpers `errorsOf` y `withCheckDigit` ya definidos arriba):

```ts
describe('registerForm con datos de nacimiento', () => {
  it('CTR-13 acepta el formulario sin apellido materno o con uno vacío', () => {
    const { maternalSurname: _omitted, ...without } = validRegister;
    expect(errorsOf(registerForm, without)).toEqual([]);
    expect(errorsOf(registerForm, { ...validRegister, maternalSurname: '' })).toEqual([]);
  });

  it('CTR-13 un apellido materno de solo espacios es inválido, no omitido', () => {
    expect(errorsOf(registerForm, { ...validRegister, maternalSurname: '   ' })).toEqual([
      expect.objectContaining({ pointer: '/maternalSurname', code: 'INVALID_FORMAT' }),
    ]);
  });

  it.each([
    ['firstNames', ''],
    ['firstNames', 'Ana2'],
    ['firstNames', ' Ana'],
    ['paternalSurname', 'Gómez  López'],
    ['paternalSurname', 'Gó@mez'],
  ])('CTR-13 rechaza %s = %j', (field, value) => {
    const errors = errorsOf(registerForm, { ...validRegister, [field]: value });
    expect(errors).toEqual([expect.objectContaining({ pointer: `/${field}` })]);
  });

  it('CTR-13 acepta nombres compuestos, acentos, ñ, apóstrofo, guion y punto', () => {
    expect(
      errorsOf(registerForm, {
        ...validRegister,
        firstNames: 'María-José Ñ.',
        paternalSurname: "O'Brien",
        maternalSurname: 'de la Cruz',
      }),
    ).toEqual([]);
  });

  it('CTR-13 rechaza un nombre completo de más de 100 caracteres, en /firstNames', () => {
    const errors = errorsOf(registerForm, {
      ...validRegister,
      firstNames: 'N'.repeat(50),
      paternalSurname: 'P'.repeat(40),
      maternalSurname: 'M'.repeat(20),
    });
    expect(errors).toEqual([expect.objectContaining({ pointer: '/firstNames', code: 'TOO_LONG' })]);
  });

  it.each(['1990-1-1', '1990-01-01T00:00:00Z', '01/01/1990', ' 1990-01-01', 'hoy'])(
    'CTR-13 la fecha %j da INVALID_FORMAT en /birthDate',
    (birthDate) => {
      expect(errorsOf(registerForm, { ...validRegister, birthDate })).toEqual([
        expect.objectContaining({ pointer: '/birthDate', code: 'INVALID_FORMAT' }),
      ]);
    },
  );

  it('CTR-13 una fecha inexistente da INVALID_DATE en /birthDate', () => {
    expect(errorsOf(registerForm, { ...validRegister, birthDate: '1990-02-30' })).toEqual([
      expect.objectContaining({ pointer: '/birthDate', code: 'INVALID_DATE' }),
    ]);
  });

  it('CTR-13 una fecha distinta de la de la CURP da INVALID_FORMAT en /birthDate', () => {
    expect(errorsOf(registerForm, { ...validRegister, birthDate: '1990-01-02' })).toEqual([
      expect.objectContaining({
        pointer: '/birthDate',
        code: 'INVALID_FORMAT',
        message: 'La fecha no coincide con tu CURP',
      }),
    ]);
  });

  it.each(['df', ' DF', 'XX', 'DFX'])('CTR-13 la entidad %j da INVALID_FORMAT en /birthState', (birthState) => {
    expect(errorsOf(registerForm, { ...validRegister, birthState })).toEqual([
      expect.objectContaining({ pointer: '/birthState', code: 'INVALID_FORMAT' }),
    ]);
  });

  it('CTR-13 una entidad distinta de la de la CURP da INVALID_FORMAT en /birthState', () => {
    expect(errorsOf(registerForm, { ...validRegister, birthState: 'JC' })).toEqual([
      expect.objectContaining({
        pointer: '/birthState',
        code: 'INVALID_FORMAT',
        message: 'La entidad no coincide con tu CURP',
      }),
    ]);
  });

  it('CTR-13 fecha y entidad distintas de la CURP se reportan juntas', () => {
    expect(
      errorsOf(registerForm, { ...validRegister, birthDate: '1990-01-02', birthState: 'JC' }),
    ).toEqual([
      expect.objectContaining({ pointer: '/birthDate' }),
      expect.objectContaining({ pointer: '/birthState' }),
    ]);
  });

  it('CTR-13 acepta NE cuando la CURP codifica NE', () => {
    const curp = withCheckDigit('GOMC900101HNENLR0');
    expect(errorsOf(registerForm, { ...validRegister, curp, birthState: 'NE' })).toEqual([]);
  });

  it('CTR-13 nacida en 2000 o después: la letra del carácter 17 da el siglo', () => {
    const curp = withCheckDigit('GOMC080315HDFNLRA');
    const form = { ...validRegister, curp, rfc: 'GOMC080315AB1', birthDate: '2008-03-15' };
    expect(errorsOf(registerFormAt(new Date('2026-10-14T18:00:00Z')), form)).toEqual([]);
  });
});
```

Adaptar las pruebas existentes de edad (≈ líneas 342–387): cada caso construye `birthDate` con la fecha de la CURP y espera el error en `'/birthDate'` (no en `'/curp'`) con los mismos códigos `DATE_OUT_OF_RANGE` / `INVALID_DATE`. Por ejemplo, el caso de 29 de febrero:

```ts
const input = { ...validRegister, curp: code, rfc: `${code.slice(0, 10)}AB1`, birthDate: '2008-02-29' };
```

Las pruebas con `fullName` (≈ líneas 154–162 y 409–411) pasan a `firstNames` (`pointer: '/firstNames'`); la de `REQUIRED` usa `firstNames: '   '` esperando `INVALID_FORMAT` en `/firstNames`… ajusta: `''` da `REQUIRED`, `'   '` da `INVALID_FORMAT`.

En `contract/test/vectors/fields.ts` agregar vectores (misma forma `{ input, valid }` que los demás; consultar `types.ts` para `contractExpectation`):

```ts
export const namePartVectors: Vector[] = [
  { input: 'Ana', valid: true },
  { input: 'José Luis', valid: true },
  { input: "O'Brien", valid: true },
  { input: 'María-José Ñ.', valid: true },
  { input: '', valid: false },
  { input: ' Ana', valid: false },
  { input: 'Ana ', valid: false },
  { input: 'Ana  Luz', valid: false },
  { input: 'Ana2', valid: false },
  { input: 'N'.repeat(100), valid: true },
  { input: 'N'.repeat(101), valid: false },
];
```

En `contract/test/vectors/identity.ts`:

```ts
export const birthDateVectors: Vector[] = [
  { input: '1990-01-01', valid: true },
  { input: '2008-02-29', valid: true },
  { input: '1990-1-1', valid: false },
  { input: '1990-01-01T00:00:00Z', valid: false },
  { input: '01/01/1990', valid: false },
  { input: '1990-13-01', valid: false },
];

export const birthStateVectors: Vector[] = [
  { input: 'DF', valid: true },
  { input: 'NE', valid: true },
  { input: 'df', valid: false },
  { input: 'XX', valid: false },
  { input: 'DFX', valid: false },
  { input: '', valid: false },
];
```

(`1990-02-30` no entra en paridad: el patrón del contrato acepta su forma y la existencia se valida fuera del schema, como la CURP.)

En `parity.test.ts`, importar `birthDate`, `birthState`, `namePart` de `../../src/index`, los tres vectores nuevos, y agregar al arreglo `parity`:

```ts
  ['NamePart', namePart, namePartVectors],
  ['BirthDate', birthDate, birthDateVectors],
  ['BirthState', birthState, birthStateVectors],
```

- [ ] **Step 3: Verificar que falla**

Run: `cd contract && npx vitest run test/validators`
Expected: FAIL (`namePart`/`birthDate`/`birthState` no existen; `validRegister` ya no valida con `fullName`).

- [ ] **Step 4: Implementar los campos**

En `contract/src/validators/fields.ts` (importar `isValidCalendarDate` de `./dates`, `isBirthStateCode` de `./birth-states`, `addFieldIssue`/`textField` de `./field-errors` si no están ya importados):

```ts
const NAME_PART = /^\p{L}[\p{L}\p{M}'.-]*( \p{L}[\p{L}\p{M}'.-]*)*$/u;

/**
 * Nombres, apellido paterno o apellido materno del registro (`NamePart`): de 1 a 100 caracteres, una
 * o más palabras separadas por un solo espacio, solo letras (con acentos y ñ), apóstrofo, guion y punto.
 */
export const namePart = textField('Este dato es obligatorio', (value, ctx) => {
  if ([...value].length > 100) return addFieldIssue(ctx, 'TOO_LONG', 'Máximo 100 caracteres');
  if (!NAME_PART.test(value)) {
    addFieldIssue(
      ctx,
      'INVALID_FORMAT',
      'Solo letras, espacios, apóstrofo, guion y punto; sin espacios al inicio, al final ni repetidos',
    );
  }
});

/** Apellido materno: ausente o vacío significa «sin apellido materno»; si hay texto, debe ser un `NamePart`. */
export const optionalNamePart = z.optional(
  z
    .unknown()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(namePart.optional()),
);

const BIRTH_DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

/** Fecha de nacimiento (`BirthDate`): `YYYY-MM-DD` existente en el calendario. */
export const birthDate = textField('La fecha de nacimiento es obligatoria', (value, ctx) => {
  if (!BIRTH_DATE.test(value)) {
    return addFieldIssue(ctx, 'INVALID_FORMAT', 'Escribe la fecha como AAAA-MM-DD');
  }
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  if (!isValidCalendarDate(year, month, day)) {
    addFieldIssue(ctx, 'INVALID_DATE', 'La fecha de nacimiento no existe');
  }
});

/** Entidad de nacimiento (`BirthState`): uno de los 33 códigos del catálogo, en mayúsculas. */
export const birthState = textField('La entidad de nacimiento es obligatoria', (value, ctx) => {
  if (!isBirthStateCode(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'Elige una entidad de la lista');
  }
});
```

(`optionalNamePart` repite el patrón de `optionalReference`; si `z` no está importado en `fields.ts`, ya lo está porque `optionalReference` lo usa.)

En `contract/src/validators/forms.ts`: importar `birthDate`, `birthState`, `namePart`, `optionalNamePart` de `./fields`, y `curpBirthState` de `./curp`. Reemplazar `fullName: personName` en `registerShape` (no tocar `personName`: lo siguen usando su validador y su esquema `PersonName`):

```ts
const registerShape = {
  email: normalizedEmail,
  password: newPassword,
  firstNames: namePart,
  paternalSurname: namePart,
  maternalSurname: optionalNamePart,
  birthDate,
  birthState,
  curp,
  rfc,
  phone,
};
```

Y reemplazar el cuerpo de `registerFormWith` por:

```ts
function registerFormWith(today: () => string) {
  return z.strictObject(registerShape).superRefine((form, ctx) => {
    // Las reglas entre campos solo aplican cuando cada campo, por separado, ya es válido.
    const parts = [form.firstNames, form.paternalSurname, form.maternalSurname];
    if (
      namePart.safeParse(form.firstNames).success &&
      namePart.safeParse(form.paternalSurname).success &&
      parts.filter((part) => part !== undefined && part !== '').join(' ').length > 100
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['firstNames'],
        message: 'El nombre completo no puede pasar de 100 caracteres',
        params: { fieldCode: 'TOO_LONG' },
      });
    }

    const curpValue = curp.safeParse(form.curp).success ? form.curp : undefined;
    const dateValue = birthDate.safeParse(form.birthDate).success ? form.birthDate : undefined;
    const stateValue = birthState.safeParse(form.birthState).success ? form.birthState : undefined;

    if (dateValue !== undefined) {
      const curpDate = curpValue === undefined ? null : curpBirthDate(curpValue);
      if (curpDate !== null && dateValue !== curpDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['birthDate'],
          message: 'La fecha no coincide con tu CURP',
          params: { fieldCode: 'INVALID_FORMAT' },
        });
      } else {
        const now = today();
        if (dateValue > now) {
          ctx.addIssue({
            code: 'custom',
            path: ['birthDate'],
            message: 'La fecha de nacimiento está en el futuro',
            params: { fieldCode: 'INVALID_DATE' },
          });
        } else if (!hasReachedAge(dateValue, now, MINIMUM_AGE)) {
          ctx.addIssue({
            code: 'custom',
            path: ['birthDate'],
            message: 'Debes tener al menos 18 años para registrarte',
            params: { fieldCode: 'DATE_OUT_OF_RANGE' },
          });
        }
      }
    }
    if (
      curpValue !== undefined &&
      stateValue !== undefined &&
      curpBirthState(curpValue) !== stateValue
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthState'],
        message: 'La entidad no coincide con tu CURP',
        params: { fieldCode: 'INVALID_FORMAT' },
      });
    }
    if (
      curpValue !== undefined &&
      rfc.safeParse(form.rfc).success &&
      !rfcMatchesCurp(form.rfc, curpValue)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['rfc'],
        message: 'El RFC no coincide con tu CURP',
        params: { fieldCode: 'INVALID_FORMAT' },
      });
    }
  });
}
```

Actualizar el comentario de `registerForm` (dice «la CURP corresponda a una persona de 18 años»): ahora «la fecha de nacimiento (igual a la de la CURP) corresponda a una persona de 18 años o más… error en `/birthDate`; fecha y entidad iguales a las de la CURP, errores en `/birthDate` y `/birthState`».

- [ ] **Step 5: Actualizar `openapi.yaml`, versión y tipos generados**

En `contract/openapi.yaml`, junto a `PersonName`, agregar:

```yaml
    NamePart:
      description: |
        Nombres, apellido paterno o apellido materno del registro: de 1 a 100 caracteres, una o más
        palabras separadas por un solo espacio, sin espacios al inicio ni al final. Solo admite letras
        (con acentos y ñ), apóstrofo, guion y punto; sin dígitos ni otros símbolos.
      type: string
      minLength: 1
      maxLength: 100
      pattern: "^\\p{L}[\\p{L}\\p{M}'.-]*( \\p{L}[\\p{L}\\p{M}'.-]*)*$"
    BirthDate:
      description: Fecha de nacimiento `YYYY-MM-DD`. Que exista en el calendario se valida fuera del schema.
      type: string
      pattern: '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    BirthState:
      description: |
        Entidad de nacimiento: código de dos letras de la CURP (las 32 entidades federativas) o `NE`
        para nacido en el extranjero.
      type: string
      enum: [AS, BC, BS, CC, CL, CM, CS, CH, DF, DG, GT, GR, HG, JC, MC, MN, MS, NT, NL, OC, PL, QT, QR, SP, SL, SR, TC, TS, TL, VZ, YN, ZS, NE]
```

Y en `RegisterRequest`: al listado de reglas de la descripción, agregar las viñetas

```
        - **Nombre:** `firstNames`, `paternalSurname` y `maternalSurname` (opcional); la unión de las tres
          con espacios no puede pasar de 100 caracteres (`TOO_LONG` en `/firstNames`).
        - **Fecha y entidad de nacimiento:** deben ser las que codifica la CURP; si no, `INVALID_FORMAT`
          en `/birthDate` («La fecha no coincide con tu CURP») o en `/birthState` («La entidad no
          coincide con tu CURP»). La fecha futura da `INVALID_DATE` y la de una persona menor de 18 años
          `DATE_OUT_OF_RANGE`, ambas en `/birthDate`.
```

quitar la frase sobre la edad de la viñeta **CURP** (ahora vive en la fecha), y cambiar `required` y `properties`:

```yaml
      required: [email, password, firstNames, paternalSurname, birthDate, birthState, curp, rfc, phone]
      properties:
        email: { $ref: '#/components/schemas/Email' }
        password: { $ref: '#/components/schemas/Password' }
        firstNames: { $ref: '#/components/schemas/NamePart' }
        paternalSurname: { $ref: '#/components/schemas/NamePart' }
        maternalSurname: { $ref: '#/components/schemas/NamePart' }
        birthDate: { $ref: '#/components/schemas/BirthDate' }
        birthState: { $ref: '#/components/schemas/BirthState' }
        curp: { $ref: '#/components/schemas/Curp' }
        rfc: { $ref: '#/components/schemas/Rfc' }
        phone: { $ref: '#/components/schemas/PhoneInput' }
```

Subir `info.version` a `1.4.0` en `openapi.yaml` y `version` a `1.4.0` en `contract/package.json` y en `package-lock.json` (`npm install --package-lock-only`).

Run: `cd contract && npm run generate && npm run lint:contract && npm run check:version`
Expected: `api.d.ts` regenerado con `firstNames`…; lint y versión sin errores.

- [ ] **Step 6: Verificar todo el paquete**

Run: `cd contract && npm run typecheck && npm run lint && npx vitest run && npm run build && npm run check:exports`
Expected: PASS (todo el paquete, incluidas la paridad y las pruebas de edad adaptadas).

- [ ] **Step 7: Reinstalar el contrato en la API y la web**

Run: `cd ../api && npm install && cd ../web && npm install`
Expected: `node_modules/@devchrisvaz/wallet-contract/package.json` con `"version": "1.4.0"` en ambos (`grep '"version"' node_modules/@devchrisvaz/wallet-contract/package.json`). `api` y `web` no compilan hasta sus tareas.

- [ ] **Step 8: Commits (dos, uno por tarea de `tasks.md`)**

```bash
git add contract/package.json contract/package-lock.json contract/openapi.yaml contract/src/generated/api.d.ts api/package-lock.json web/package-lock.json
git commit -m "chore(contract): bump the contract to 1.4.0" -m "Task: registration-birth-data#1.1
Refs: CTR-02

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"

git add contract/src/validators contract/test openspec/changes/registration-birth-data/specs
git commit -m "feat(contract): ask for names and birth data in the register form" -m "Task: registration-birth-data#1.3
Refs: CTR-13, IDN-02

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Si `api/package-lock.json` o `web/package-lock.json` no cambian, omítelos del `git add`.

---

### Task 3: Migración, caso de uso, repositorio, semillas y pruebas de la API (tasks.md 2.1, 2.2, 2.3)

**Files:**
- Create: `api/migrations/1760900000000-registration-birth-data.ts`, `api/src/modules/identity/domain/full-name.ts`, `api/test/unit/identity/full-name.test.ts`
- Modify: `api/migrations/index.ts`, `api/src/modules/identity/application/{users,register-user}.ts`, `api/src/modules/identity/infrastructure/{entities,pg-user-repository}.ts`, `api/src/modules/identity/infrastructure/http/schemas.ts` (solo comentario), `api/src/seed/{demo-users,generated-users}.ts`, `api/test/helpers/factories.ts`, `api/test/unit/identity/identity-validators.test.ts`, `api/test/integration/identity/register.test.ts` y cualquier prueba que construya un `UserRecord`/`NewUser`/registro.

**Interfaces:**
- Consumes: `registerFormAt(now)` de Tarea 2 (la forma `{ firstNames, paternalSurname, maternalSurname?, birthDate, birthState, … }`), `curpBirthDate`, `curpBirthState`.
- Produces:
  - `composeFullName(parts: { firstNames: string; paternalSurname: string; maternalSurname?: string | null }): string`
  - `RegisterUserInput` con `firstNames`, `paternalSurname`, `maternalSurname?`, `birthDate`, `birthState` (sin `fullName`).
  - `UserRecord`/`NewUser` con `firstNames: string`, `paternalSurname: string`, `maternalSurname: string | null`, `birthDate: string` (`YYYY-MM-DD`), `birthState: string`.
  - `SeedPerson` con `firstNames`, `paternalSurname`, `maternalSurname: string | null` (sin `fullName`).
  - `newRegistration()` devuelve el cuerpo de la petición (con las claves nuevas, sin `fullName`).

- [ ] **Step 1: Prueba unitaria de `composeFullName` (falla)**

```ts
// api/test/unit/identity/full-name.test.ts
import { describe, expect, it } from 'vitest';
import { composeFullName } from '../../../src/modules/identity/domain/full-name.js';

describe('composeFullName', () => {
  it('IDN-02 une nombres, apellido paterno y apellido materno con un espacio', () => {
    expect(
      composeFullName({ firstNames: 'José Luis', paternalSurname: 'Gómez', maternalSurname: 'Cruz' }),
    ).toBe('José Luis Gómez Cruz');
  });

  it.each([undefined, null, ''])('IDN-02 sin apellido materno (%j) no deja espacios sobrantes', (maternalSurname) => {
    expect(composeFullName({ firstNames: 'Ana', paternalSurname: 'Pérez', maternalSurname })).toBe(
      'Ana Pérez',
    );
  });
});
```

Run: `cd api && npx vitest run --project unit test/unit/identity/full-name.test.ts` — Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `composeFullName`**

```ts
// api/src/modules/identity/domain/full-name.ts
/** Nombre completo del titular: nombres, apellido paterno y, si existe, apellido materno, con un espacio. */
export function composeFullName(parts: {
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname?: string | null;
}): string {
  return [parts.firstNames, parts.paternalSurname, parts.maternalSurname]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' ');
}
```

Run de nuevo: Expected: PASS.

- [ ] **Step 3: Migración**

```ts
// api/migrations/1760900000000-registration-birth-data.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Códigos de entidad de la CURP (las 32 entidades y `NE`); mismo catálogo que `BIRTH_STATES` del contrato. */
const BIRTH_STATES =
  "'AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE'";

/**
 * Datos de nacimiento y nombre separado en `users` (IDN-02). `full_name` se sigue guardando: la API
 * lo compone con los tres campos. Las columnas son `NOT NULL` y sin valor por defecto: es un
 * ambiente de pruebas sin usuarios que conservar, así que la migración no rellena nada; las filas
 * que ya existan en una base local se corrigen antes con SQL directo.
 *
 * `down` quita las cinco columnas; se pierde el nombre separado y los datos de nacimiento.
 */
export class RegistrationBirthData1760900000000 implements MigrationInterface {
  name = 'RegistrationBirthData1760900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.users
        ADD COLUMN first_names      text NOT NULL
                    CONSTRAINT ck_users_first_names_length CHECK (char_length(first_names) BETWEEN 1 AND 100),
        ADD COLUMN paternal_surname text NOT NULL
                    CONSTRAINT ck_users_paternal_surname_length CHECK (char_length(paternal_surname) BETWEEN 1 AND 100),
        ADD COLUMN maternal_surname text
                    CONSTRAINT ck_users_maternal_surname_length CHECK (char_length(maternal_surname) BETWEEN 1 AND 100),
        ADD COLUMN birth_date       date NOT NULL,
        ADD COLUMN birth_state      char(2) NOT NULL
                    CONSTRAINT ck_users_birth_state CHECK (birth_state IN (${BIRTH_STATES}))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.users
        DROP COLUMN birth_state,
        DROP COLUMN birth_date,
        DROP COLUMN maternal_surname,
        DROP COLUMN paternal_surname,
        DROP COLUMN first_names
    `);
  }
}
```

En `api/migrations/index.ts`, importar `import { RegistrationBirthData1760900000000 } from './1760900000000-registration-birth-data.js';` y agregar `RegistrationBirthData1760900000000,` al final del arreglo (después de `ScheduledForInstant1760800001000`).

- [ ] **Step 4: Tipos, entidad y repositorio**

`users.ts` — `UserRecord` agrega, después de `fullName`:

```ts
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  /** Código de entidad de la CURP (`DF`, `JC`, … o `NE`). */
  readonly birthState: string;
```

`entities.ts` — `UserRow` agrega los mismos cinco campos (`maternalSurname: string | null`) y `columns`:

```ts
    firstNames: { type: 'text', name: 'first_names' },
    paternalSurname: { type: 'text', name: 'paternal_surname' },
    maternalSurname: { type: 'text', name: 'maternal_surname', nullable: true },
    birthDate: { type: 'date', name: 'birth_date' },
    birthState: { type: 'char', length: 2, name: 'birth_state' },
```

`pg-user-repository.ts` — `RawUser` agrega `first_names: string; paternal_surname: string; maternal_surname: string | null; birth_date: string; birth_state: string;`; `fromRaw` mapea `firstNames: row.first_names, paternalSurname: row.paternal_surname, maternalSurname: row.maternal_surname, birthDate: row.birth_date, birthState: row.birth_state`; y el `SELECT` de `findByEmailForUpdate` pasa a:

```ts
      `SELECT id, email, password_hash, full_name, first_names, paternal_surname, maternal_surname,
              birth_date::text AS birth_date, birth_state, curp, rfc, phone, email_verified_at, created_at
         FROM users WHERE email = $1 FOR UPDATE`,
```

(`::text` porque `pg` devuelve `date` como `Date`; así queda `YYYY-MM-DD`. Con TypeORM, `type: 'date'` ya entrega `string`.)

- [ ] **Step 5: Caso de uso**

En `register-user.ts`: importar `import { composeFullName } from '../domain/full-name.js';`, y

```ts
export interface RegisterUserInput {
  /** Ya normalizado (IDN-02). */
  readonly email: string;
  readonly password: string;
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname?: string | undefined;
  /** `YYYY-MM-DD`, igual a la fecha de la CURP. */
  readonly birthDate: string;
  /** Código de entidad, igual al de la CURP. */
  readonly birthState: string;
  readonly curp: string;
  readonly rfc: string;
  /** Ya en E.164. */
  readonly phone: string;
}
```

En `attempt`, antes de `users.insert`: `const fullName = composeFullName(input);` y el `insert` pasa:

```ts
        fullName,
        firstNames: input.firstNames,
        paternalSurname: input.paternalSurname,
        maternalSurname: input.maternalSurname ?? null,
        birthDate: input.birthDate,
        birthState: input.birthState,
```

y el `return { kind: 'CODE', fullName, code: issued.code }` usa esa variable. El comentario de `registerRequestSchemaAt` en `schemas.ts` cambia «nombre de persona» por «nombres y apellidos, fecha y entidad de nacimiento iguales a los de la CURP» y «CURP de una persona mayor de edad» por «fecha de nacimiento de una persona mayor de edad» (sin cambios de código: ya delega en `registerFormAt`).

- [ ] **Step 6: Semillas y fábrica**

`generated-users.ts`: `SeedPerson` reemplaza `fullName` por `firstNames: string; paternalSurname: string; maternalSurname: string | null;`; `generatedPeople` devuelve `firstNames: first, paternalSurname: last1, maternalSurname: last2` (en lugar de `fullName`). Los parámetros no cambian CURP/RFC (ya tienen `DF` y fecha real).

`demo-users.ts`: Ana → `firstNames: 'Ana', paternalSurname: 'Gómez', maternalSurname: 'Cruz'`; Luis → `'Luis', 'Pérez', 'López'`. En `seedUsers`, importar `curpBirthDate`, `curpBirthState` de `@devchrisvaz/wallet-contract` y `composeFullName`, y en el `users.insert`:

```ts
        fullName: composeFullName(demo),
        firstNames: demo.firstNames,
        paternalSurname: demo.paternalSurname,
        maternalSurname: demo.maternalSurname,
        birthDate: curpBirthDate(demo.curp) as string,
        birthState: curpBirthState(demo.curp) as string,
```

`factories.ts` (`newRegistration`): reemplazar `fullName` y agregar fecha y entidad (la fecha sale de la misma `birth` de la CURP; el siglo es 1900 porque el diferenciador es un dígito):

```ts
  return {
    email: `persona${n}.${run}@example.com`,
    password: 'contraseña muy segura 2026',
    firstNames: 'Persona',
    paternalSurname: spelled(n),
    maternalSurname: 'Prueba',
    birthDate: birth.toISOString().slice(0, 10),
    birthState: 'DF',
    curp,
    rfc,
    phone,
    ...overrides,
  };
```

- [ ] **Step 7: Pruebas de la API**

`identity-validators.test.ts` (unit): `validRegistration` cambia `fullName: 'Ana Gómez'` por `firstNames: 'Ana', paternalSurname: 'Gómez', birthDate: '<fecha de su CURP>', birthState: 'DF'` (ver su `curp`); los casos de nombre (≈ líneas 109–116 y 158) pasan a `/firstNames`/`/paternalSurname`; agregar los de coincidencia:

```ts
  it('IDN-02 una fecha de nacimiento distinta de la CURP se rechaza en /birthDate', () => {
    expect(fieldErrors({ ...validRegistration, birthDate: '1990-01-02' })).toEqual([
      expect.objectContaining({ pointer: '/birthDate', code: 'INVALID_FORMAT' }),
    ]);
  });

  it('IDN-02 una entidad distinta de la CURP se rechaza en /birthState', () => {
    expect(fieldErrors({ ...validRegistration, birthState: 'JC' })).toEqual([
      expect.objectContaining({ pointer: '/birthState', code: 'INVALID_FORMAT' }),
    ]);
  });
```

(Ajusta la fecha `'1990-01-02'` a «un día distinto de la de `validRegistration.curp`».)

`register.test.ts` (integración): en la tabla de rechazos (≈ líneas 214–217) cambiar los casos de nombre a `{ firstNames: 'Ana2' }` → `/firstNames`, `{ paternalSurname: 'Gómez  López' }` → `/paternalSurname`, y agregar `['fecha distinta de la CURP', { birthDate: '1990-01-02' }, '/birthDate']`, `['entidad distinta de la CURP', { birthState: 'JC' }, '/birthState']`, `['entidad fuera del catálogo', { birthState: 'XX' }, '/birthState']`. `bornOn(yymmdd)` devuelve también `birthDate: \`20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}\`` y `birthState: 'DF'`. La prueba de línea ≈ 65 compara `full_name` con `` `${person.firstNames} ${person.paternalSurname} ${person.maternalSurname}` `` y además lee las columnas nuevas. Agregar estas pruebas:

```ts
  it('IDN-02 guarda nombres, apellidos, fecha y entidad, y compone full_name', async () => {
    const person = newRegistration({ firstNames: 'José Luis', paternalSurname: 'Gómez', maternalSurname: 'Cruz' });
    expect((await register(person)).status).toBe(202);
    const [user] = await harness.migrator.query(
      `SELECT full_name, first_names, paternal_surname, maternal_surname, birth_date::text AS birth_date, birth_state
         FROM app.users WHERE email = $1`,
      [person.email],
    );
    expect(user).toEqual({
      full_name: 'José Luis Gómez Cruz',
      first_names: 'José Luis',
      paternal_surname: 'Gómez',
      maternal_surname: 'Cruz',
      birth_date: person.birthDate,
      birth_state: 'DF',
    });
  });

  it('IDN-02 sin apellido materno guarda NULL y full_name sin espacios sobrantes', async () => {
    const { maternalSurname: _omitted, ...person } = newRegistration({ firstNames: 'Ana', paternalSurname: 'Pérez' });
    expect((await register(person)).status).toBe(202);
    const [user] = await usersWith('email', person.email);
    expect(user).toMatchObject({ full_name: 'Ana Pérez', maternal_surname: null });
  });

  it('IDN-02 acepta nacido en el extranjero (NE)', async () => {
    const first17 = 'GOMC900101HNENLR1';
    const curp = `${first17}${curpCheckDigit(first17)}`;
    const person = newRegistration({ curp, rfc: 'GOMC900101XY1', birthDate: '1990-01-01', birthState: 'NE' });
    expect((await register(person)).status).toBe(202);
  });

  it('IDN-02 un nombre completo de más de 100 caracteres da 422 en /firstNames y no crea nada', async () => {
    const person = newRegistration({ firstNames: 'N'.repeat(50), paternalSurname: 'P'.repeat(40), maternalSurname: 'M'.repeat(20) });
    const res = await register(person);
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([expect.objectContaining({ pointer: '/firstNames', code: 'TOO_LONG' })]);
    expect(await usersWith('email', person.email)).toHaveLength(0);
  });
```

Adaptar las demás pruebas que usen `person.fullName`, `fullName: 'Otro Nombre'` (≈ línea 91 → `firstNames: 'Otro'`) o construyan usuarios (`grep -rn "fullName\|full_name" api/test api/src --include=*.ts`) para que compilen con el tipo nuevo; las que insertan usuarios por SQL directo (`INSERT INTO app.users …`) deben incluir las cinco columnas nuevas (usar un helper compartido si hay varias).

- [ ] **Step 8: Verificar**

Run: `cd api && npm run typecheck && npm run lint && npm test`
Expected: PASS (requiere la base de pruebas arriba; ver README «Pruebas»). Si el arnés usa `db:migrate` sobre una base ya creada, la migración nueva se aplica en limpio (tablas vacías).

- [ ] **Step 9: Base local: corregir las filas existentes con SQL directo (sin lógica en la migración)**

Run: `cd api && psql "$MIGRATION_DATABASE_URL" -c "SELECT count(*) FROM app.users"` (la URL está en `api/.env`; puerto 5433).

- Si el conteo es `0`: `npm run db:migrate` y listo.
- Si hay usuarios (semillas `ana`, `luis`, `usuarioNN`): crear **fuera del repositorio** `$SCRATCH/fix-users.sql` con este contenido, correrlo con `psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f $SCRATCH/fix-users.sql` y luego `npm run db:migrate` **no** se ejecuta para esta migración (el script ya la deja registrada):

```sql
BEGIN;
ALTER TABLE app.users
  ADD COLUMN first_names text,
  ADD COLUMN paternal_surname text,
  ADD COLUMN maternal_surname text,
  ADD COLUMN birth_date date,
  ADD COLUMN birth_state char(2);

UPDATE app.users u SET
  first_names = CASE WHEN n.cnt >= 3 THEN array_to_string(n.words[1:n.cnt - 2], ' ') ELSE n.words[1] END,
  paternal_surname = CASE WHEN n.cnt >= 3 THEN n.words[n.cnt - 1] ELSE n.words[n.cnt] END,
  maternal_surname = CASE WHEN n.cnt >= 3 THEN n.words[n.cnt] ELSE NULL END,
  birth_date = to_date(
    (CASE WHEN substr(u.curp, 17, 1) ~ '[0-9]' THEN '19' ELSE '20' END) || substr(u.curp, 5, 6),
    'YYYYMMDD'),
  birth_state = substr(u.curp, 12, 2)
FROM (
  SELECT id, string_to_array(full_name, ' ') AS words, cardinality(string_to_array(full_name, ' ')) AS cnt
    FROM app.users
) n
WHERE n.id = u.id;

ALTER TABLE app.users
  ALTER COLUMN first_names SET NOT NULL,
  ALTER COLUMN paternal_surname SET NOT NULL,
  ALTER COLUMN birth_date SET NOT NULL,
  ALTER COLUMN birth_state SET NOT NULL,
  ADD CONSTRAINT ck_users_first_names_length CHECK (char_length(first_names) BETWEEN 1 AND 100),
  ADD CONSTRAINT ck_users_paternal_surname_length CHECK (char_length(paternal_surname) BETWEEN 1 AND 100),
  ADD CONSTRAINT ck_users_maternal_surname_length CHECK (char_length(maternal_surname) BETWEEN 1 AND 100),
  ADD CONSTRAINT ck_users_birth_state CHECK (birth_state IN ('AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE'));

INSERT INTO app.typeorm_migrations ("timestamp", name) VALUES (1760900000000, 'RegistrationBirthData1760900000000');
COMMIT;
```

Verificar: `psql "$MIGRATION_DATABASE_URL" -c "SELECT email, full_name, first_names, paternal_surname, maternal_surname, birth_date, birth_state FROM app.users ORDER BY email LIMIT 5"` — Expected: `ana@example.com | Ana Gómez Cruz | Ana | Gómez | Cruz | 1992-03-15 | DF`; y `npm run db:migrate` — Expected: «No migrations are pending».

(Esto solo toca la base local de desarrollo, nunca la de pruebas de integración, que el arnés reinicia.)

- [ ] **Step 10: Reiniciar la API local y probar de punta a punta**

Run: `cd api && npm run build`, reiniciar `node --env-file=.env dist/src/main.js` (puerto 4000; si ya corre, detenerlo antes con su proceso y volverlo a lanzar). Luego:

```bash
curl -s -X POST localhost:4000/auth/register -H 'content-type: application/json' -d '{"email":"nueva@example.com","password":"contraseña-larga-1","firstNames":"Ana","paternalSurname":"Gómez","birthDate":"1990-01-01","birthState":"DF","curp":"GOMC900101HDFNLR09","rfc":"GOMC900101AB1","phone":"5599998888"}' -w '\n%{http_code}\n'
```

Expected: `202`. Con `"birthState":"JC"`: `422` con `/birthState`. (Si el correo ya existe por una corrida previa, cambia el email.)

- [ ] **Step 11: Commits (tres, uno por tarea de `tasks.md`)**

```bash
# 2.1
git add api/src/modules/identity/infrastructure/http/schemas.ts api/test/unit/identity
git commit -m "test(api): cover the birth data rules of the register schema" -m "Task: registration-birth-data#2.1
Refs: IDN-02

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"

# 2.2
git add api/migrations
git commit -m "feat(api): add the birth data columns to users" -m "Task: registration-birth-data#2.2
Refs: IDN-02

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"

# 2.3
git add api/src api/test
git commit -m "feat(api): store the names and birth data when registering" -m "Task: registration-birth-data#2.3
Refs: IDN-02

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Si `schemas.ts` ya no tiene cambios aparte del comentario, súmalo al commit 2.3 y deja 2.1 solo con las pruebas unitarias.

---

### Task 4: Formulario web, pruebas y arneses (tasks.md 3.1, 3.2)

**Files:**
- Modify: `web/components/auth/RegisterForm.tsx`, `web/components/auth/RegisterForm.test.tsx`, `web/app/actions/auth.test.ts` (`REGISTRATION`, línea ≈ 128), `web/e2e/register.spec.ts`, `web/e2e/fake-api.mjs` (solo si valida la forma; hoy solo mira `curp/rfc/phone`), `web/test/fixtures.ts` (solo si arma un registro; su `fullName` es del usuario de sesión y no cambia)

**Interfaces:**
- Consumes: `registerFormAt` y `BIRTH_STATES` de `@devchrisvaz/wallet-contract`; el componente `Select` de `@/components/ui/Select`.
- Produces: formulario con los campos «Nombre(s)», «Apellido paterno», «Apellido materno (opcional)», «Fecha de nacimiento» (`type="date"`) y «Entidad de nacimiento» (`<select>`), que envía `{ email, password, firstNames, paternalSurname, maternalSurname?, birthDate, birthState, curp, rfc, phone }`.

- [ ] **Step 1: Pruebas que fallan (`RegisterForm.test.tsx`)**

Reemplazar `VALID` y `fill`:

```tsx
const VALID = {
  email: 'ana@example.com',
  password: 'contraseña-larga-1',
  firstNames: 'Ana',
  paternalSurname: 'Gómez',
  maternalSurname: 'Castillo',
  birthDate: '1990-01-01',
  birthState: 'DF',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

async function fill(values: Partial<typeof VALID> & { confirmPassword?: string } = {}) {
  const data = { ...VALID, confirmPassword: VALID.password, ...values };
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), data.email);
  await user.type(screen.getByLabelText('Contraseña'), data.password);
  await user.type(screen.getByLabelText('Confirmar contraseña'), data.confirmPassword);
  await user.type(screen.getByLabelText('Nombre(s)'), data.firstNames);
  await user.type(screen.getByLabelText('Apellido paterno'), data.paternalSurname);
  if (data.maternalSurname) {
    await user.type(screen.getByLabelText('Apellido materno (opcional)'), data.maternalSurname);
  }
  await user.type(screen.getByLabelText('Fecha de nacimiento'), data.birthDate);
  await user.selectOptions(screen.getByLabelText('Entidad de nacimiento'), data.birthState);
  await user.type(screen.getByLabelText('CURP'), data.curp);
  await user.type(screen.getByLabelText('RFC'), data.rfc);
  await user.type(screen.getByLabelText('Teléfono'), data.phone);
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}
```

Cambiar la prueba existente de «Validación al salir del campo» (usaba un nombre de una palabra) para teclear `Ana2` en «Nombre(s)` y pasar al siguiente campo, esperando un mensaje bajo el campo. Agregar:

```tsx
  it('WEB-11 el apellido materno es opcional y no se envía si está vacío', async () => {
    registerMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    render(<RegisterForm />);

    await fill({ maternalSurname: '' });

    const { maternalSurname: _omitted, ...expected } = VALID;
    expect(registerMock).toHaveBeenCalledWith(expected);
  });

  it('WEB-11 la entidad se elige por nombre y se envía como código', async () => {
    render(<RegisterForm />);
    const select = screen.getByLabelText('Entidad de nacimiento');
    await userEvent.selectOptions(select, 'Ciudad de México');
    expect((select as HTMLSelectElement).value).toBe('DF');
  });

  it('WEB-11 marca la fecha y la entidad que no coinciden con la CURP al salir del campo', async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('CURP'), VALID.curp);
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1990-01-02');
    await user.selectOptions(screen.getByLabelText('Entidad de nacimiento'), 'Jalisco');
    await user.tab();
    expect(await screen.findByText('La fecha no coincide con tu CURP')).toBeVisible();
    expect(await screen.findByText('La entidad no coincide con tu CURP')).toBeVisible();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('WEB-11 no rellena la fecha ni la entidad a partir de la CURP', async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText('CURP'), VALID.curp);
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('');
    expect(screen.getByLabelText('Entidad de nacimiento')).toHaveValue('');
  });
```

(Si `selectOptions` por etiqueta de visible text no encuentra «Ciudad de México», el `<option>` debe mostrar `state.name`; así queda en el Step 3.) Actualizar también `REGISTRATION` en `web/app/actions/auth.test.ts` con las claves nuevas (mismos valores que `VALID` sin la confirmación).

Run: `cd web && npx vitest run components/auth/RegisterForm.test.tsx app/actions/auth.test.ts`
Expected: FAIL (no existen los campos).

- [ ] **Step 2: Implementar `RegisterForm.tsx`**

Cambios (el resto del archivo no cambia):

- Imports: `import { BIRTH_STATES, registerFormAt } from '@devchrisvaz/wallet-contract';` y `import { Select } from '@/components/ui/Select';`.
- `RegisterValues`: quitar `fullName`; agregar `firstNames: string; paternalSurname: string; maternalSurname: string; birthDate: string; birthState: string;` (el apellido materno es `string` en el formulario; el contrato lo vuelve `undefined` si está vacío).
- `RegisterOutput` pasa a `Omit<RegisterValues, 'confirmPassword' | 'maternalSurname'> & { maternalSurname?: string | undefined }`.
- `FIELDS = ['email', 'password', 'firstNames', 'paternalSurname', 'maternalSurname', 'birthDate', 'birthState', 'curp', 'rfc', 'phone'] as const;`
- `defaultValues`: `firstNames: '', paternalSurname: '', maternalSurname: '', birthDate: '', birthState: ''` en lugar de `fullName: ''`.
- `revalidate` recibe varios dependientes y la CURP los dispara:

```tsx
  function revalidate(...dependents: ('confirmPassword' | 'rfc' | 'birthDate' | 'birthState')[]) {
    for (const dependent of dependents) {
      if (getValues(dependent) !== '') void trigger(dependent);
    }
  }
```

  con `register('curp', { onChange: () => revalidate('rfc', 'birthDate', 'birthState') })`, y `register('birthDate', …)`/`register('birthState', …)` sin dependientes (la CURP no se revalida al cambiarlos: el error sale en su propio campo).
- Reemplazar el campo «Nombre completo» por:

```tsx
        <TextField
          label="Nombre(s)"
          autoComplete="given-name"
          hint="Solo letras, como en tu identificación."
          error={errors.firstNames?.message}
          {...register('firstNames')}
        />
        <TextField
          label="Apellido paterno"
          autoComplete="family-name"
          error={errors.paternalSurname?.message}
          {...register('paternalSurname')}
        />
        <TextField
          label="Apellido materno (opcional)"
          hint="Déjalo vacío si solo tienes un apellido."
          error={errors.maternalSurname?.message}
          {...register('maternalSurname')}
        />
        <TextField
          label="Fecha de nacimiento"
          type="date"
          autoComplete="bday"
          hint="Debe ser la misma que aparece en tu CURP."
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        <Select
          label="Entidad de nacimiento"
          hint="Debe ser la misma que aparece en tu CURP."
          error={errors.birthState?.message}
          {...register('birthState')}
        >
          <option value="">Selecciona una entidad</option>
          {BIRTH_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </Select>
```

(El orden —nombres, apellidos, fecha, entidad, CURP— deja la CURP después de los datos que contrasta.) Actualizar el comentario del componente: «…incluido el dígito verificador de la CURP y que la fecha y la entidad de nacimiento coincidan con ella».

- [ ] **Step 3: Verificar las pruebas del componente**

Run: `cd web && npx vitest run components/auth/RegisterForm.test.tsx app/actions/auth.test.ts && npm run typecheck && npm run lint`
Expected: PASS. Si el `TextField` de fecha no deja escribir con `user.type`, usar `fireEvent.change(input, { target: { value: data.birthDate } })` en `fill` (jsdom acepta valores ISO en `type="date"`).

- [ ] **Step 4: Commit 3.1**

```bash
git add web/components/auth/RegisterForm.tsx web/components/auth/RegisterForm.test.tsx web/app/actions/auth.test.ts
git commit -m "feat(web): ask for names and birth data on the register form" -m "Task: registration-birth-data#3.1
Refs: WEB-11

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: E2E y API simulada (3.2)**

`web/e2e/register.spec.ts`: sustituir la línea de «Nombre completo» por (la CURP `TAKEN.curp` `SEPB851121HDFRRL08` nació el 1985-11-21 en `DF`):

```ts
  await page.getByLabel('Nombre(s)').fill('Beatriz');
  await page.getByLabel('Apellido paterno').fill('Sepúlveda');
  await page.getByLabel('Apellido materno (opcional)').fill('Romero');
  await page.getByLabel('Fecha de nacimiento').fill('1985-11-21');
  await page.getByLabel('Entidad de nacimiento').selectOption('DF');
```

(antes de `fill` de la CURP) y agregar una prueba:

```ts
test('WEB-11 una fecha y una entidad distintas de la CURP se marcan en su campo y no se envía el registro', async ({ page }) => {
  await scenario(page, {});
  await page.goto('/register');
  await page.getByLabel('CURP').fill(TAKEN.curp);
  await page.getByLabel('Fecha de nacimiento').fill('1985-11-22');
  await page.getByLabel('Entidad de nacimiento').selectOption('JC');
  await page.getByLabel('RFC').click();
  await expect(page.getByText('La fecha no coincide con tu CURP')).toBeVisible();
  await expect(page.getByText('La entidad no coincide con tu CURP')).toBeVisible();
  const registers = (await apiRequests(page)).filter((r) => r.path === '/auth/register');
  expect(registers).toHaveLength(0);
});
```

`fake-api.mjs` no necesita cambios (solo lee `curp`, `rfc`, `phone`); confirmarlo con `grep -n "fullName" web/e2e/fake-api.mjs` (la línea 22 es el usuario de sesión).

Run: `cd web && npm run build && npx playwright test e2e/register.spec.ts` (el e2e arranca su propio servidor y la API simulada; no usar el puerto 3100, que gestiona otra sesión).
Expected: PASS.

- [ ] **Step 6: Suite completa de la web**

Run: `cd web && npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 7: Commit 3.2**

```bash
git add web/e2e web/test
git commit -m "test(web): cover the birth data fields in the register e2e" -m "Task: registration-birth-data#3.2
Refs: WEB-11

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Documentación, trazabilidad y cierre (tasks.md 4.1)

**Files:**
- Modify: `README.md`, `docs/traceability.md` (solo sobre `<!-- trace.sh:end -->`, regenerado), `openspec/changes/registration-birth-data/tasks.md` (casillas)

- [ ] **Step 1: Documentar los campos nuevos**

Buscar dónde se documentan los datos de registro: `grep -n "fullName\|CURP" README.md docs/*.md | head -30`. Actualizar toda mención del cuerpo de `POST /auth/register` (de `fullName` a `firstNames`, `paternalSurname`, `maternalSurname?`, `birthDate`, `birthState`) y agregar una línea: «La fecha y la entidad de nacimiento deben coincidir con las de la CURP; `NE` es nacido en el extranjero.» En la sección «¿Qué haría con más tiempo?» quitar de «Lo que falta hoy» (bullet KYC) la frase que dice que la fecha de nacimiento solo se contrasta entre CURP y RFC si ya no es cierta, y mencionar que ahora fecha y entidad se contrastan con la CURP.

- [ ] **Step 2: Regenerar la matriz de trazabilidad**

Run: `grep -rn "trace.sh" docs/traceability.md | head -3; ls scripts docs | grep -i trace` para ubicar el script; correrlo (respeta la memoria del repo: **solo se regenera por encima de `<!-- trace.sh:end -->`**; las notas manuales de abajo se conservan).
Expected: `git diff docs/traceability.md` solo cambia filas de IDN-02, CTR-13, CTR-21 y WEB-11.

- [ ] **Step 3: Marcar las casillas de `tasks.md`**

Cambiar `- [ ]` por `- [x]` en las 10 tareas de `openspec/changes/registration-birth-data/tasks.md` (1.1–1.3, 2.1–2.3, 3.1–3.2, 4.1).

Run: `npx openspec validate registration-birth-data` — Expected: válido.

- [ ] **Step 4: Verificación final de todo el repositorio**

Run (cada uno en su carpeta): `contract: npm run typecheck && npm run lint && npx vitest run && npm run check:version`; `api: npm run typecheck && npm run lint && npm test`; `web: npm run typecheck && npm run lint && npm test`.
Expected: todo PASS. Además, la prueba manual de la Tarea 3 Step 10 contra la API local, y revisar visualmente `/register` en un navegador (el servidor de :3100 es de otra sesión: no lo reinicies; si hace falta ver el cambio, pide a esa sesión `npm run build` + `agent-term restart treo-web-3100`).

- [ ] **Step 5: Commit 4.1**

```bash
git add README.md docs/traceability.md openspec/changes/registration-birth-data/tasks.md
git commit -m "docs: document the birth data fields and update the traceability matrix" -m "Task: registration-birth-data#4.1
Refs: IDN-02, CTR-13, CTR-21, WEB-11

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

El commit del punto C en el README (`README.md`, sección «Perfil KYC completo en el registro») y los archivos de `openspec/changes/registration-birth-data/` se commitean antes de la Tarea 1, en `docs: propose the registration birth data change`.

---

## Self-Review

**Cobertura del spec.** IDN-02 → Tareas 2 y 3 (nombres, fecha, entidad, composición de `fullName`, edad en `/birthDate`, `NE`, apellido materno ausente); CTR-13 → Tarea 2; CTR-21 → Tarea 1 (catálogo, paridad con el patrón de la CURP, entidad de una CURP); WEB-11 → Tarea 4 (campos, validación al salir, no rellena desde la CURP, entidad por nombre, materno opcional). `tasks.md` 1.1 a 4.1 tienen una tarea o paso con commit propio. El punto C del README y el spec se commitean aparte (último párrafo de la Tarea 5).

**Placeholders.** Los únicos pasos con instrucción de «adaptar» son las pruebas existentes que cambian de campo (se dice qué cambia y qué esperan); el código nuevo está completo.

**Consistencia de tipos.** `namePart`/`optionalNamePart`/`birthDate`/`birthState` (Tarea 2) y `curpBirthState`/`isBirthStateCode` (Tarea 1) se usan con esos nombres en las Tareas 2 y 3; `composeFullName` (Tarea 3 Step 2) lo usan el caso de uso y las semillas; `RegisterValues`/`RegisterOutput` (Tarea 4) coinciden con la forma de `registerFormAt`.

**Review Focus.** Cada línea tiene prueba: (1) nombre compuesto largo → contrato y API (Tareas 2 y 3); (2) materno de espacios → Tarea 2; (3) fechas con forma casi correcta → Tarea 2 y vectores de paridad; (4) entidad en minúsculas → Tarea 2 y vectores; (5) siglo 2000 y `NE` → Tareas 2 y 3.

**Pendientes a propósito.** `PersonName`/`personName` quedan en el contrato sin usarse en el registro (no se retiran en este change para no cambiar la API pública del paquete); `/mobile` no cambia.
