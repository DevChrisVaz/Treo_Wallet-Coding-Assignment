/** Doble de `fetch`: registra cada petición y responde según la función provista. */
export function fakeFetch(respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return respond(request);
  };
  return { fetch, requests };
}

/** `AccountsOverview` completo, con todos los campos que define el contrato. */
export const accountsOverview = {
  accounts: [
    {
      id: '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f',
      name: 'Principal',
      clabe: '032180000118359719',
      balance: '25000.00',
      currency: 'MXN',
      createdAt: '2026-10-01T15:00:00.000Z',
    },
  ],
  dailyLimit: {
    limit: '50000.00',
    used: '1500.00',
    remaining: '48500.00',
    resetsAt: '2026-10-14T06:00:00.000Z',
    timeZone: 'America/Mexico_City',
  },
} as const;
