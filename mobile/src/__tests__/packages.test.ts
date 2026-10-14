import { createApiClient, formatMXN } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { theme } from '@devchrisvaz/wallet-design-tokens/native';

describe('paquetes locales instalados como artefacto', () => {
  test('MOB-15 el contrato expone el cliente tipado y formatMXN', () => {
    const api = createApiClient({ baseUrl: 'http://localhost:4000' });
    expect(typeof api.GET).toBe('function');
    expect(formatMXN('1234567.89')).toBe('$1,234,567.89');
  });

  test('DSG-01 el paquete de diseño expone el tema nativo por el subpath ./native', () => {
    expect(theme.colors.action.primary).toBe('#1C4B42');
    expect(theme.typography.body.fontFamily).toBe('WorkSans_400Regular');
    expect(problemMessage('INSUFFICIENT_FUNDS')).toBe(
      'No tienes saldo suficiente para esta transferencia.',
    );
  });
});
