import { DailyLimitMeter } from 'wallet-web-ui';

const base = {
  limit: '50000.00',
  resetsAt: '2026-10-14T06:00:00.000Z',
  timeZone: 'America/Mexico_City' as const,
};

export const Default = () => (
  <div className="max-w-md">
    <DailyLimitMeter dailyLimit={{ ...base, used: '12000.00', remaining: '38000.00' }} />
  </div>
);

export const Unused = () => (
  <div className="max-w-md">
    <DailyLimitMeter dailyLimit={{ ...base, used: '0.00', remaining: '50000.00' }} />
  </div>
);

export const NearlyReached = () => (
  <div className="max-w-md">
    <DailyLimitMeter dailyLimit={{ ...base, used: '46500.00', remaining: '3500.00' }} />
  </div>
);

export const Reached = () => (
  <div className="max-w-md">
    <DailyLimitMeter dailyLimit={{ ...base, used: '50000.00', remaining: '0.00' }} />
  </div>
);

export const OverviewSection = () => (
  <section aria-labelledby="daily-limit-title" className="grid max-w-xl gap-3">
    <h2 id="daily-limit-title" className="text-h3">
      Límite diario de transferencias
    </h2>
    <DailyLimitMeter dailyLimit={{ ...base, used: '12000.00', remaining: '38000.00' }} />
  </section>
);
