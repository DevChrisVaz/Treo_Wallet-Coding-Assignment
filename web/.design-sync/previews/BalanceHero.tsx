import { BalanceHero, QuickActions } from 'wallet-web-ui';

/*
 * Hero del saldo (WEB-28, DSG-13): total en grande con los centavos más chicos y lo disponible hoy
 * en lima. El tamaño del monto baja un nivel cuando el saldo es muy largo (heroAmountSize).
 */

const actions = (
  <QuickActions
    actions={[
      { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
      { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
    ]}
  />
);

export const Default = () => (
  <div className="max-w-[390px]">
    <BalanceHero total="35000.00" available="31500.00" />
  </div>
);

export const WithActions = () => (
  <div className="max-w-[390px]">
    <BalanceHero total="35000.00" available="31500.00" actions={actions} />
  </div>
);

/** $1,234,567,890.00 sigue en una línea en un teléfono de 390 px. */
export const LargeBalance = () => (
  <div className="max-w-[350px]">
    <BalanceHero total="1234567890.00" available="50000.00" actions={actions} />
  </div>
);
