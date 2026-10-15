import { describe, expect, it } from 'vitest';
import {
  parseComposePorts,
  planBootstrap,
  type BootstrapProbe,
} from '../../../scripts/bootstrap-plan.js';

const URL_5433 = 'postgres://postgres:s3cret-pass@localhost:5433/postgres';

/** Sondas falsas: ni `psql` ni Docker se tocan. `ports` es lo que publica el servicio de compose. */
function probe(options: { psql: boolean; ports?: number[] }): BootstrapProbe & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    psqlAvailable: () => {
      calls.push('psql');
      return options.psql;
    },
    composePorts: () => {
      calls.push('compose');
      return options.ports ?? [];
    },
  };
}

describe('PLT-14 respaldo seguro de db:bootstrap', () => {
  it('PLT-14 con psql instalado se conecta a la URL, sea cual sea su host, sin consultar compose', () => {
    for (const url of [
      URL_5433,
      'postgres://postgres:x@db.example.com:5432/postgres',
      'postgres://postgres:x@localhost:5443/postgres',
    ]) {
      const sondas = probe({ psql: true, ports: [5433] });
      expect(planBootstrap(url, sondas)).toEqual({ kind: 'psql' });
      expect(sondas.calls).toEqual(['psql']);
    }
  });

  it('PLT-14 sin psql y con el puerto que publica compose, corre en el contenedor con el usuario de la URL', () => {
    expect(planBootstrap(URL_5433, probe({ psql: false, ports: [5433] }))).toEqual({
      kind: 'compose',
      user: 'postgres',
    });
  });

  it('PLT-14 sin psql y con un puerto distinto al de compose, se niega y nombra la URL y el puerto de compose', () => {
    const plan = planBootstrap(
      'postgres://postgres:s3cret-pass@localhost:5443/postgres',
      probe({ psql: false, ports: [5433] }),
    );
    expect(plan.kind).toBe('refuse');
    if (plan.kind !== 'refuse') return;
    expect(plan.message).toContain('postgres://postgres@localhost:5443/postgres');
    expect(plan.message).toContain('5433');
    expect(plan.message).toMatch(/psql/);
  });

  it('PLT-14 el mensaje de rechazo nunca incluye la contraseña de la URL', () => {
    for (const ports of [[5433], []]) {
      const plan = planBootstrap(
        'postgres://postgres:s3cret-pass@localhost:5443/postgres',
        probe({ psql: false, ports }),
      );
      expect(plan.kind).toBe('refuse');
      if (plan.kind === 'refuse') expect(plan.message).not.toContain('s3cret-pass');
    }
    const remote = planBootstrap(
      'postgres://postgres:s3cret-pass@db.example.com:5432/postgres',
      probe({ psql: false }),
    );
    expect(remote.kind === 'refuse' && remote.message).not.toContain('s3cret-pass');
  });

  it('PLT-14 sin psql y con un host que no es de esta máquina, se niega sin consultar compose', () => {
    for (const host of ['db.example.com', '10.0.0.5', '192.168.1.20', 'localhost.example.com']) {
      const sondas = probe({ psql: false, ports: [5432] });
      const plan = planBootstrap(`postgres://postgres:x@${host}:5432/postgres`, sondas);
      expect(plan.kind, host).toBe('refuse');
      expect(sondas.calls, host).toEqual(['psql']);
    }
  });

  it('PLT-14 sin psql acepta localhost, 127.0.0.1, ::1 y [::1] como host local', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(
        planBootstrap(
          `postgres://postgres:x@${host}:5433/postgres`,
          probe({ psql: false, ports: [5433] }),
        ),
        host,
      ).toEqual({ kind: 'compose', user: 'postgres' });
    }
  });

  it('PLT-14 una URL sin puerto cuenta como el 5432', () => {
    const url = 'postgres://postgres:x@localhost/postgres';
    expect(planBootstrap(url, probe({ psql: false, ports: [5432] })).kind).toBe('compose');
    expect(planBootstrap(url, probe({ psql: false, ports: [5433] })).kind).toBe('refuse');
  });

  it('PLT-14 sin psql y con compose apagado se niega y dice que hay que levantarlo o instalar psql', () => {
    const plan = planBootstrap(URL_5433, probe({ psql: false, ports: [] }));
    expect(plan.kind).toBe('refuse');
    if (plan.kind !== 'refuse') return;
    expect(plan.message).toMatch(/docker compose up/);
    expect(plan.message).toMatch(/psql/);
  });

  it('PLT-14 con varios puertos publicados (IPv4 e IPv6) basta con que uno sea el de la URL', () => {
    expect(planBootstrap(URL_5433, probe({ psql: false, ports: [5433, 5434] })).kind).toBe(
      'compose',
    );
    expect(planBootstrap(URL_5433, probe({ psql: false, ports: [5434, 5435] })).kind).toBe(
      'refuse',
    );
  });

  it('PLT-14 el usuario de la URL se decodifica y, si falta, es postgres', () => {
    expect(
      planBootstrap(
        'postgres://su%40per:x@localhost:5433/postgres',
        probe({ psql: false, ports: [5433] }),
      ),
    ).toEqual({ kind: 'compose', user: 'su@per' });
    expect(
      planBootstrap('postgres://localhost:5433/postgres', probe({ psql: false, ports: [5433] })),
    ).toEqual({ kind: 'compose', user: 'postgres' });
  });

  it('PLT-14 una URL ilegible se niega sin psql, sin repetir su contenido', () => {
    const plan = planBootstrap(
      'no es una url con s3cret-pass',
      probe({ psql: false, ports: [5433] }),
    );
    expect(plan.kind).toBe('refuse');
    if (plan.kind === 'refuse') expect(plan.message).not.toContain('s3cret-pass');
  });
});

describe('PLT-14 salida de docker compose port', () => {
  it('PLT-14 lee los puertos de las líneas IPv4 e IPv6 y descarta lo demás', () => {
    expect(parseComposePorts('0.0.0.0:5433\n[::]:5433\n')).toEqual([5433]);
    expect(parseComposePorts('127.0.0.1:5443\r\n')).toEqual([5443]);
    expect(parseComposePorts('0.0.0.0:5433\n0.0.0.0:6000')).toEqual([5433, 6000]);
    expect(parseComposePorts('')).toEqual([]);
    expect(parseComposePorts('no hay puerto\n:0\n')).toEqual([]);
  });
});
