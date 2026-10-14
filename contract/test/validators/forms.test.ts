import { describe, expect, it } from 'vitest';
import {
  beneficiaryForm,
  loginForm,
  registerForm,
  toFieldErrors,
  transferForm,
  transferFormAt,
  verifyEmailForm,
} from '../../src/index';

const validTransfer = {
  fromAccountId: '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f',
  destination: { type: 'BENEFICIARY', beneficiaryId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' },
  amount: '1500.5',
  concept: 'Renta de octubre',
  reference: '1234567',
};

const validRegister = {
  email: 'ana@example.com',
  password: 'una-contraseña-larga',
  fullName: 'Ana Gómez Núñez',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

function errorsOf(schema: { safeParse: (input: unknown) => unknown }, input: unknown) {
  const result = schema.safeParse(input) as
    { success: true } | { success: false; error: Parameters<typeof toFieldErrors>[0] };
  return result.success ? [] : toFieldErrors(result.error);
}

describe('esquemas de formularios', () => {
  it.each([
    ['registerForm', registerForm, validRegister],
    ['verifyEmailForm', verifyEmailForm, { email: 'ana@example.com', code: '123456' }],
    ['loginForm', loginForm, { email: 'ana@example.com', password: 'x' }],
    [
      'beneficiaryForm',
      beneficiaryForm,
      { name: 'Luis Pérez', alias: 'Luis', clabe: '032180000118359719' },
    ],
    ['transferForm', transferForm, validTransfer],
  ])('CTR-13 %s acepta un formulario válido', (_name, schema, input) => {
    expect(errorsOf(schema, input)).toEqual([]);
  });

  it('CTR-11 registerForm acepta un RFC que no coincide con la CURP', () => {
    // La CURP es de 1990-01-01 y el RFC de 1985-06-15: no se exige que se correspondan.
    expect(errorsOf(registerForm, { ...validRegister, rfc: 'PEGL850615XY2' })).toEqual([]);
  });

  it('CTR-13 transferForm rechaza un destino OWN_ACCOUNT con beneficiaryId', () => {
    const errors = errorsOf(transferForm, {
      ...validTransfer,
      destination: { type: 'OWN_ACCOUNT', beneficiaryId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/destination/beneficiaryId', code: 'UNKNOWN_FIELD' }),
        expect.objectContaining({ pointer: '/destination/accountId', code: 'REQUIRED' }),
      ]),
    );
  });

  it('CTR-13 identifica a la vez el monto con 3 decimales y el concepto vacío', () => {
    const errors = errorsOf(transferForm, { ...validTransfer, amount: '100.005', concept: '' });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/amount', code: 'TOO_MANY_DECIMALS' }),
        expect.objectContaining({ pointer: '/concept', code: 'REQUIRED' }),
      ]),
    );
    expect(errors).toHaveLength(2);
  });

  it('CTR-13 un campo que no existe en el contrato se reporta como UNKNOWN_FIELD', () => {
    const errors = errorsOf(beneficiaryForm, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: '032180000118359719',
      bank: 'BBVA',
    });

    expect(errors).toEqual([expect.objectContaining({ pointer: '/bank', code: 'UNKNOWN_FIELD' })]);
  });

  it('CTR-13 registerForm exige contraseñas de al menos 12 caracteres', () => {
    const errors = errorsOf(registerForm, { ...validRegister, password: 'corta-11-ch' });

    expect(errors).toEqual([expect.objectContaining({ pointer: '/password', code: 'TOO_SHORT' })]);
  });

  it('CTR-13 registerForm rechaza un correo con formato inválido', () => {
    const errors = errorsOf(registerForm, { ...validRegister, email: 'ana@' });

    expect(errors).toEqual([
      expect.objectContaining({ pointer: '/email', code: 'INVALID_FORMAT' }),
    ]);
  });
});

describe('longitudes y formato de los campos de los formularios', () => {
  const validBeneficiary = { name: 'Luis Pérez', alias: 'Luis', clabe: '032180000118359719' };
  const ownAccount = '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f';

  it('CTR-12 el correo acepta 254 caracteres y rechaza 255 con INVALID_FORMAT', () => {
    const at254 = `${'a'.repeat(249)}@b.co`;
    const at255 = `${'a'.repeat(250)}@b.co`;

    expect(errorsOf(registerForm, { ...validRegister, email: at254 })).toEqual([]);
    expect(errorsOf(registerForm, { ...validRegister, email: at255 })).toEqual([
      expect.objectContaining({ pointer: '/email', code: 'INVALID_FORMAT' }),
    ]);
  });

  it('CTR-12 la contraseña nueva acepta 128 caracteres y rechaza 129 con TOO_LONG', () => {
    expect(errorsOf(registerForm, { ...validRegister, password: 'x'.repeat(128) })).toEqual([]);
    expect(errorsOf(registerForm, { ...validRegister, password: 'x'.repeat(129) })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' }),
    ]);
  });

  it('CTR-12 la contraseña se mide en puntos de código, no en unidades UTF-16', () => {
    // 128 emojis son 256 unidades UTF-16 pero 128 caracteres.
    expect(errorsOf(registerForm, { ...validRegister, password: '🔑'.repeat(128) })).toEqual([]);
    expect(errorsOf(registerForm, { ...validRegister, password: '🔑'.repeat(129) })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' }),
    ]);
  });

  it('CTR-12 loginForm exige contraseña y la limita a 128 caracteres, sin mínimo', () => {
    const login = { email: 'ana@example.com' };

    expect(errorsOf(loginForm, { ...login, password: '' })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'REQUIRED' }),
    ]);
    expect(errorsOf(loginForm, { ...login, password: 'x'.repeat(129) })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' }),
    ]);
    expect(errorsOf(loginForm, { ...login, password: 'x'.repeat(128) })).toEqual([]);
  });

  it('CTR-12 el nombre completo en blanco es REQUIRED y de más de 100 caracteres es TOO_LONG', () => {
    expect(errorsOf(registerForm, { ...validRegister, fullName: '   ' })).toEqual([
      expect.objectContaining({ pointer: '/fullName', code: 'REQUIRED' }),
    ]);
    expect(errorsOf(registerForm, { ...validRegister, fullName: 'N'.repeat(100) })).toEqual([]);
    expect(errorsOf(registerForm, { ...validRegister, fullName: 'N'.repeat(101) })).toEqual([
      expect.objectContaining({ pointer: '/fullName', code: 'TOO_LONG' }),
    ]);
  });

  it('CTR-12 el alias del beneficiario es obligatorio, también en blanco', () => {
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: '' })).toEqual([
      expect.objectContaining({ pointer: '/alias', code: 'REQUIRED' }),
    ]);
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: '   ' })).toEqual([
      expect.objectContaining({ pointer: '/alias', code: 'REQUIRED' }),
    ]);
  });

  it('CTR-12 el alias acepta 30 caracteres y rechaza 31 con TOO_LONG, contados por puntos de código', () => {
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: 'a'.repeat(30) })).toEqual([]);
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: '🏠'.repeat(30) })).toEqual([]);
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: 'a'.repeat(31) })).toEqual([
      expect.objectContaining({ pointer: '/alias', code: 'TOO_LONG' }),
    ]);
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: '🏠'.repeat(31) })).toEqual([
      expect.objectContaining({ pointer: '/alias', code: 'TOO_LONG' }),
    ]);
  });

  it.each([' Luis', 'Luis ', ' Luis '])(
    'CTR-12 el alias "%s" con espacios en los extremos es INVALID_FORMAT',
    (alias) => {
      expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias })).toEqual([
        expect.objectContaining({ pointer: '/alias', code: 'INVALID_FORMAT' }),
      ]);
    },
  );

  it('CTR-12 el alias admite espacios en medio', () => {
    expect(errorsOf(beneficiaryForm, { ...validBeneficiary, alias: 'Luis Pérez' })).toEqual([]);
  });

  it.each(['no-es-un-uuid', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', '6f1c2a3e-4b5d-4c6e-8f70'])(
    'CTR-12 el identificador "%s" se rechaza con INVALID_FORMAT',
    (fromAccountId) => {
      expect(errorsOf(transferForm, { ...validTransfer, fromAccountId })).toEqual([
        expect.objectContaining({ pointer: '/fromAccountId', code: 'INVALID_FORMAT' }),
      ]);
    },
  );

  it('CTR-13 transferForm acepta un destino OWN_ACCOUNT con accountId', () => {
    const destination = { type: 'OWN_ACCOUNT', accountId: ownAccount };

    expect(errorsOf(transferForm, { ...validTransfer, destination })).toEqual([]);
  });

  it('CTR-13 transferForm rechaza un tipo de destino desconocido', () => {
    const errors = errorsOf(transferForm, {
      ...validTransfer,
      destination: { type: 'EXTERNAL', accountId: ownAccount },
    });

    expect(errors).toEqual([expect.objectContaining({ pointer: '/destination/type' })]);
  });
});

describe('fecha programada del formulario de transferencia', () => {
  // 2026-10-14 12:00 en la Ciudad de México: el rango programable es del 15 de octubre al 12 de enero.
  const now = new Date('2026-10-14T18:00:00Z');

  it('CTR-13 transferForm acepta una transferencia sin fecha y una con fecha', () => {
    expect(errorsOf(transferForm, validTransfer)).toEqual([]);
    expect(errorsOf(transferForm, { ...validTransfer, scheduledFor: '2026-10-20' })).toEqual([]);
  });

  it('CTR-13 transferForm rechaza una fecha que no existe con INVALID_DATE', () => {
    const errors = errorsOf(transferForm, { ...validTransfer, scheduledFor: '2026-02-30' });

    expect(errors).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'INVALID_DATE' }),
    ]);
  });

  it.each(['2026-10-14', '2027-01-13', '2026-10-01'])(
    'CTR-13 transferFormAt rechaza %s con DATE_OUT_OF_RANGE',
    (scheduledFor) => {
      const errors = errorsOf(transferFormAt(now), { ...validTransfer, scheduledFor });

      expect(errors).toEqual([
        expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
      ]);
    },
  );

  it.each(['2026-10-15', '2027-01-12'])('CTR-13 transferFormAt acepta %s', (scheduledFor) => {
    expect(errorsOf(transferFormAt(now), { ...validTransfer, scheduledFor })).toEqual([]);
  });

  it('CTR-13 transferFormAt reporta la fecha junto con los demás campos inválidos', () => {
    const errors = errorsOf(transferFormAt(now), {
      ...validTransfer,
      amount: '100.005',
      scheduledFor: '2026-10-14',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/amount', code: 'TOO_MANY_DECIMALS' }),
        expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
      ]),
    );
  });
});
