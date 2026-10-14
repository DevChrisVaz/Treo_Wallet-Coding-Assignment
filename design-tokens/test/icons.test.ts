import { describe, expect, it } from 'vitest';
import { iconConcepts, iconNames, movementIcon, movementType, toneIcon } from '../src/index';

describe('mapa de iconos', () => {
  it('DSG-15 cubre los doce conceptos de la especificación', () => {
    for (const concept of ['home', 'movements', 'transfer', 'beneficiaries', 'logout', 'moneyIn', 'moneyOut', 'deposit', 'ownTransfer', 'success', 'error', 'warning'] as const) {
      expect(iconConcepts).toContain(concept);
    }
  });

  it('DSG-15 cada concepto tiene un nombre de Lucide en PascalCase', () => {
    for (const concept of iconConcepts) expect(iconNames[concept]).toMatch(/^[A-Z][A-Za-z0-9]*$/);
  });

  it('DSG-15 cada tipo de movimiento tiene su icono', () => {
    expect(Object.keys(movementIcon).sort()).toEqual(Object.keys(movementType).sort());
    expect(movementIcon.TRANSFER_IN).toBe('moneyIn');
    expect(movementIcon.DEPOSIT).toBe('deposit');
  });

  it('DSG-15 el error usa el icono de error', () => {
    expect(toneIcon.danger).toBe('error');
  });
});
