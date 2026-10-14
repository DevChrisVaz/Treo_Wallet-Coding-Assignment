import { describe, expect, it } from 'vitest';
import {
  beneficiaryForm,
  curpCheckDigit,
  loginForm,
  registerForm,
  registerFormAt,
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

function withCheckDigit(first17: string): string {
  return `${first17}${curpCheckDigit(first17)}`;
}

const validRegister = {
  email: 'ana@example.com',
  password: 'una-contraseña-1',
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
    expect(errorsOf(registerForm, { ...validRegister, password: `${'x'.repeat(127)}1` })).toEqual(
      [],
    );
    expect(errorsOf(registerForm, { ...validRegister, password: `${'x'.repeat(128)}1` })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' }),
    ]);
  });

  it('CTR-12 la contraseña se mide en puntos de código, no en unidades UTF-16', () => {
    // 128 emojis son 256 unidades UTF-16 pero 128 caracteres.
    expect(errorsOf(registerForm, { ...validRegister, password: `${'🔑'.repeat(126)}a1` })).toEqual(
      [],
    );
    expect(errorsOf(registerForm, { ...validRegister, password: `${'🔑'.repeat(127)}a1` })).toEqual(
      [expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' })],
    );
  });

  it('CTR-12 loginForm exige contraseña y la limita a 128 caracteres, sin mínimo', () => {
    const login = { email: 'ana@example.com' };

    expect(errorsOf(loginForm, { ...login, password: '' })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'REQUIRED' }),
    ]);
    expect(errorsOf(loginForm, { ...login, password: `${'x'.repeat(128)}1` })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'TOO_LONG' }),
    ]);
    expect(errorsOf(loginForm, { ...login, password: `${'x'.repeat(127)}1` })).toEqual([]);
  });

  it('CTR-12 el nombre completo en blanco es REQUIRED y de más de 100 caracteres es TOO_LONG', () => {
    expect(errorsOf(registerForm, { ...validRegister, fullName: '   ' })).toEqual([
      expect.objectContaining({ pointer: '/fullName', code: 'REQUIRED' }),
    ]);
    expect(
      errorsOf(registerForm, { ...validRegister, fullName: `${'N'.repeat(49)} ${'N'.repeat(50)}` }),
    ).toEqual([]);
    expect(
      errorsOf(registerForm, { ...validRegister, fullName: `${'N'.repeat(50)} ${'N'.repeat(50)}` }),
    ).toEqual([expect.objectContaining({ pointer: '/fullName', code: 'TOO_LONG' })]);
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

describe('referencia opcional del formulario de transferencia', () => {
  const withoutReference: Partial<typeof validTransfer> = { ...validTransfer };
  delete withoutReference.reference;

  it('TRF-03 transferForm acepta una transferencia sin referencia y con referencia vacía', () => {
    expect(errorsOf(transferForm, withoutReference)).toEqual([]);
    expect(errorsOf(transferForm, { ...validTransfer, reference: '' })).toEqual([]);
  });

  it('TRF-03 una referencia vacía queda omitida en el resultado', () => {
    const parsed = transferForm.parse({ ...validTransfer, reference: '' });

    expect(parsed.reference).toBeUndefined();
  });

  it.each([
    ['12345678', 'TOO_LONG'],
    ['12a', 'INVALID_FORMAT'],
  ])('TRF-03 transferForm rechaza la referencia %s', (reference, code) => {
    expect(errorsOf(transferForm, { ...validTransfer, reference })).toEqual([
      expect.objectContaining({ pointer: '/reference', code }),
    ]);
  });
});

describe('instante programado del formulario de transferencia', () => {
  // 2026-10-14 12:00 en la Ciudad de México: la ventana va de 12:10 de hoy al 12 de enero a las 12:00.
  const now = new Date('2026-10-14T18:00:00Z');

  it('TRF-27 transferForm acepta una transferencia sin instante y una con instante', () => {
    expect(errorsOf(transferForm, validTransfer)).toEqual([]);
    expect(
      errorsOf(transferForm, { ...validTransfer, scheduledFor: '2026-10-20T14:30:00-06:00' }),
    ).toEqual([]);
  });

  it.each([
    ['2026-10-20', 'solo fecha'],
    ['2026-10-20T14:30:15-06:00', 'con segundos'],
    ['2026-10-20T14:30:00', 'sin desfase'],
    ['2026-02-30T14:30:00-06:00', 'día inexistente'],
  ])('TRF-27 transferForm rechaza %s (%s) con INVALID_FORMAT', (scheduledFor) => {
    expect(errorsOf(transferForm, { ...validTransfer, scheduledFor })).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'INVALID_FORMAT' }),
    ]);
  });

  it.each([
    ['2026-10-14T12:09:00-06:00', '9 minutos'],
    ['2026-10-14T12:00:00-06:00', 'ahora'],
    ['2026-10-01T12:00:00-06:00', 'pasado'],
    ['2027-01-12T12:01:00-06:00', '90 días y un minuto'],
    ['2027-02-01T12:00:00-06:00', 'más de 90 días'],
  ])('TRF-27 transferFormAt rechaza %s (%s) con DATE_OUT_OF_RANGE', (scheduledFor) => {
    expect(errorsOf(transferFormAt(now), { ...validTransfer, scheduledFor })).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
    ]);
  });

  it.each([
    ['2026-10-14T12:10:00-06:00', '10 minutos exactos'],
    ['2026-10-14T18:10:00Z', 'lo mismo en UTC'],
    ['2026-12-01T09:00:00-06:00', 'a mitad de la ventana'],
    ['2027-01-12T12:00:00-06:00', '90 días exactos'],
  ])('TRF-27 transferFormAt acepta %s (%s)', (scheduledFor) => {
    expect(errorsOf(transferFormAt(now), { ...validTransfer, scheduledFor })).toEqual([]);
  });

  it('TRF-27 transferFormAt reporta el instante junto con los demás campos inválidos', () => {
    const errors = errorsOf(transferFormAt(now), {
      ...validTransfer,
      amount: '100.005',
      scheduledFor: '2026-10-14T12:00:00-06:00',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/amount', code: 'TOO_MANY_DECIMALS' }),
        expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
      ]),
    );
  });
});

describe('reglas de registro entre campos (CTR-13)', () => {
  const today = new Date('2026-10-14T18:00:00Z');
  const register = registerFormAt(today);

  it('CTR-13 registerFormAt acepta un registro válido', () => {
    expect(errorsOf(register, validRegister)).toEqual([]);
  });

  it('CTR-13 registerForm usa el reloj actual y acepta el registro válido', () => {
    expect(errorsOf(registerForm, validRegister)).toEqual([]);
  });

  it('CTR-13 el correo se recorta y pasa a minúsculas', () => {
    const parsed = register.parse({ ...validRegister, email: '  Ana@Example.COM ' });

    expect(parsed.email).toBe('ana@example.com');
  });

  it('CTR-11 rechaza un RFC cuyos primeros 10 caracteres no son los de la CURP, en /rfc', () => {
    // La CURP es de 1990-01-01 y el RFC de 1985-06-15.
    expect(errorsOf(register, { ...validRegister, rfc: 'PEGL850615XY2' })).toEqual([
      {
        pointer: '/rfc',
        code: 'INVALID_FORMAT',
        message: 'El RFC no coincide con tu CURP',
      },
    ]);
  });

  it('CTR-11 no repite el error de coincidencia si el RFC ya es inválido por sí solo', () => {
    expect(errorsOf(register, { ...validRegister, rfc: 'GOMC9001' })).toEqual([
      expect.objectContaining({ pointer: '/rfc', code: 'INVALID_FORMAT' }),
    ]);
  });

  // Dígito verificador de las CURP sintéticas calculado con `curpCheckDigit`.
  it.each([
    ['cumple 18 hoy', 'GOMC081014HDFNLRA', '2008-10-14', true],
    ['cumple 18 mañana', 'GOMC081015HDFNLRA', '2008-10-15', false],
    ['nació hace 17 años', 'GOMC091014HDFNLRA', '2009-10-14', false],
  ])(
    'CTR-13 la mayoría de edad se calcula con el día de la Ciudad de México: %s',
    (_n, prefix, _d, ok) => {
      const code = withCheckDigit(prefix);
      const rfcValue = `${code.slice(0, 10)}AB1`;
      const errors = errorsOf(register, { ...validRegister, curp: code, rfc: rfcValue });

      expect(errors).toEqual(
        ok ? [] : [expect.objectContaining({ pointer: '/curp', code: 'DATE_OUT_OF_RANGE' })],
      );
    },
  );

  it('CTR-13 «hoy» sale de la Ciudad de México, no de UTC', () => {
    // 2026-10-15 03:00Z sigue siendo 14 de octubre en la Ciudad de México.
    const nearMidnight = registerFormAt(new Date('2026-10-15T03:00:00Z'));
    const code = withCheckDigit('GOMC081015HDFNLRA');
    const input = { ...validRegister, curp: code, rfc: `${code.slice(0, 10)}AB1` };

    expect(errorsOf(nearMidnight, input)).toEqual([
      expect.objectContaining({ pointer: '/curp', code: 'DATE_OUT_OF_RANGE' }),
    ]);
    expect(errorsOf(registerFormAt(new Date('2026-10-15T06:00:00Z')), input)).toEqual([]);
  });

  it('CTR-13 una CURP con fecha de nacimiento futura da INVALID_DATE', () => {
    // El carácter 17 es una letra: nació en 20AA.
    const code = withCheckDigit('GOMC351014HDFNLRA');
    const input = { ...validRegister, curp: code, rfc: `${code.slice(0, 10)}AB1` };

    expect(errorsOf(register, input)).toEqual([
      expect.objectContaining({ pointer: '/curp', code: 'INVALID_DATE' }),
    ]);
  });

  it('CTR-13 quien nació un 29 de febrero cumple 18 el 1 de marzo en un año no bisiesto', () => {
    const code = withCheckDigit('GOMC080229HDFNLRA');
    const input = { ...validRegister, curp: code, rfc: `${code.slice(0, 10)}AB1` };

    expect(errorsOf(registerFormAt(new Date('2026-02-28T18:00:00Z')), input)).toHaveLength(1);
    expect(errorsOf(registerFormAt(new Date('2026-03-01T18:00:00Z')), input)).toEqual([]);
  });

  it('CTR-11 reporta a la vez el error de otro campo y el de coincidencia', () => {
    const errors = errorsOf(register, {
      ...validRegister,
      phone: '0512345678',
      rfc: 'PEGL850615XY2',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/phone', code: 'INVALID_FORMAT' }),
        expect.objectContaining({ pointer: '/rfc', code: 'INVALID_FORMAT' }),
      ]),
    );
  });

  it.each([
    ['Ana', 'una palabra'],
    ['Ana Gómez3', 'con dígito'],
    ['Ana  Gómez', 'espacios repetidos'],
  ])('CTR-13 registerForm rechaza el nombre %s (%s)', (fullName) => {
    expect(errorsOf(register, { ...validRegister, fullName })).toEqual([
      expect.objectContaining({ pointer: '/fullName', code: 'INVALID_FORMAT' }),
    ]);
  });

  it('CTR-13 registerForm exige letra y número en la contraseña', () => {
    expect(errorsOf(register, { ...validRegister, password: 'solo-letras-largas' })).toEqual([
      expect.objectContaining({ pointer: '/password', code: 'INVALID_FORMAT' }),
    ]);
  });
});
