import { AccountCard, DailyLimitMeter, buttonClasses } from 'wallet-web-ui';

const principal = { name: 'Principal', clabe: '032180000118359719', balance: '25000.00' };
const ahorro = { name: 'Ahorro', clabe: '032180000118359722', balance: '10000.00' };

const dailyLimit = {
  limit: '50000.00',
  used: '12000.00',
  remaining: '38000.00',
  resetsAt: '2026-10-14T06:00:00.000Z',
  timeZone: 'America/Mexico_City' as const,
};

export const Default = () => (
  <div className="max-w-md">
    <AccountCard account={principal}>
      <a
        href="#"
        aria-label="Ver movimientos de Principal"
        className={buttonClasses('secondary')}
      >
        Ver movimientos
      </a>
      <a href="#" aria-label="Transferir desde Principal" className={buttonClasses('ghost')}>
        Transferir
      </a>
    </AccountCard>
  </div>
);

export const WithoutActions = () => (
  <div className="max-w-md">
    <AccountCard account={ahorro} />
  </div>
);

export const Selected = () => (
  <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
    <AccountCard account={principal} />
    <AccountCard account={ahorro} selected />
  </div>
);

export const AccountsOverview = () => (
  <div className="grid max-w-3xl gap-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1">Tus cuentas</h1>
      <a href="#" className={buttonClasses('primary')}>
        Nueva transferencia
      </a>
    </div>
    <section aria-labelledby="overview-daily-limit" className="grid gap-3">
      <h2 id="overview-daily-limit" className="text-h3">
        Límite diario de transferencias
      </h2>
      <DailyLimitMeter dailyLimit={dailyLimit} />
    </section>
    <section aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2">
      {[principal, ahorro].map((account) => (
        <AccountCard key={account.name} account={account}>
          <a
            href="#"
            aria-label={`Ver movimientos de ${account.name}`}
            className={buttonClasses('secondary')}
          >
            Ver movimientos
          </a>
          <a
            href="#"
            aria-label={`Transferir desde ${account.name}`}
            className={buttonClasses('ghost')}
          >
            Transferir
          </a>
        </AccountCard>
      ))}
    </section>
  </div>
);
