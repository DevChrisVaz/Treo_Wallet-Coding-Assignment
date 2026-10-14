import { describe, expect, it } from 'vitest';
import { iconConcepts, navDestinations } from '../src/index';

describe('destinos de navegación', () => {
  it('DSG-17 web y móvil comparten etiquetas e iconos', () => {
    expect(navDestinations).toEqual({
      home: { label: 'Inicio', icon: 'home' },
      movements: { label: 'Movimientos', icon: 'movements' },
      transfer: { label: 'Transferir', icon: 'transfer' },
      beneficiaries: { label: 'Beneficiarios', icon: 'beneficiaries' },
    });
    for (const { icon } of Object.values(navDestinations)) expect(iconConcepts).toContain(icon);
  });
});
