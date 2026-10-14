import { QuickActions } from 'wallet-web-ui';

/*
 * Acciones rápidas del hero (WEB-28): solo van sobre superficies oscuras (bg-surface-hero); el
 * icono es lima y el anillo de foco también (R13).
 */

export const OnHero = () => (
  <div className="max-w-[390px] rounded-lg bg-surface-hero p-6">
    <QuickActions
      actions={[
        { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
        { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
      ]}
    />
  </div>
);

/** WEB-35: Inicio ofrece también "Recibir" (flecha entrante), después de "Transferir". */
export const WithReceive = () => (
  <div className="max-w-[390px] rounded-lg bg-surface-hero p-6">
    <QuickActions
      actions={[
        { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
        { key: 'r', label: 'Recibir', icon: 'moneyIn', onClick: () => undefined },
        { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
      ]}
    />
  </div>
);

export const ThreeActions = () => (
  <div className="max-w-[390px] rounded-lg bg-surface-hero p-6">
    <QuickActions
      actions={[
        { key: 't', label: 'Transferir', icon: 'transfer', href: '#' },
        { key: 'm', label: 'Movimientos', icon: 'movements', href: '#' },
        { key: 'b', label: 'Beneficiarios', icon: 'beneficiaries', href: '#' },
      ]}
    />
  </div>
);
