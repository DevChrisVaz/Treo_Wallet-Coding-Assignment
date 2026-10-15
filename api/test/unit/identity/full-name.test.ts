import { describe, expect, it } from 'vitest';
import { composeFullName } from '../../../src/modules/identity/domain/full-name.js';

describe('composeFullName', () => {
  it('IDN-02 une nombres, apellido paterno y apellido materno con un espacio', () => {
    expect(
      composeFullName({
        firstNames: 'José Luis',
        paternalSurname: 'Gómez',
        maternalSurname: 'Cruz',
      }),
    ).toBe('José Luis Gómez Cruz');
  });

  it.each([undefined, null, ''])(
    'IDN-02 sin apellido materno (%j) no deja espacios sobrantes',
    (maternalSurname) => {
      expect(
        composeFullName({ firstNames: 'Ana', paternalSurname: 'Pérez', maternalSurname }),
      ).toBe('Ana Pérez');
    },
  );
});
