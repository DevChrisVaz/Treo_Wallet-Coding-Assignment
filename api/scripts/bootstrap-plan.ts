/**
 * Decide dónde se ejecuta `db/bootstrap.sql` (PLT-14). Es una función pura: `psql` y Docker se
 * consultan por medio de `BootstrapProbe`, así que las pruebas no necesitan ninguno de los dos.
 *
 * El respaldo sin `psql` usa `docker compose exec postgres psql`, que ignora el host y el puerto de
 * `BOOTSTRAP_DATABASE_URL` y actúa sobre el proyecto de compose que `api/` resuelva (`treo-api`, el
 * mismo en cualquier copia del repositorio). Por eso solo se acepta si la URL apunta a esta máquina
 * y a un puerto que el servicio `postgres` de compose publica; en cualquier otro caso se rechaza.
 */

export type BootstrapPlan =
  { kind: 'psql' } | { kind: 'compose'; user: string } | { kind: 'refuse'; message: string };

export interface BootstrapProbe {
  psqlAvailable(): boolean;
  /** Puertos del host que publica el servicio `postgres` de compose; vacío si no está en marcha. */
  composePorts(): number[];
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const POSTGRES_DEFAULT_PORT = 5432;

/** Lee la salida de `docker compose port postgres 5432`: una línea `host:puerto` por publicación. */
export function parseComposePorts(output: string): number[] {
  const ports = new Set<number>();
  for (const line of output.split(/\r?\n/)) {
    const match = /:(\d{1,5})$/.exec(line.trim());
    const port = match ? Number(match[1]) : 0;
    if (port > 0 && port <= 65535) ports.add(port);
  }
  return [...ports];
}

function refuse(lines: string[]): BootstrapPlan {
  return { kind: 'refuse', message: lines.join('\n') };
}

export function planBootstrap(bootstrapUrl: string, probe: BootstrapProbe): BootstrapPlan {
  if (probe.psqlAvailable()) return { kind: 'psql' };

  let url: URL;
  try {
    url = new URL(bootstrapUrl);
  } catch {
    // No se repite el texto de la URL: podría traer la contraseña.
    return refuse([
      'BOOTSTRAP_DATABASE_URL no es una URL válida (postgres://usuario:clave@host:puerto/base).',
    ]);
  }

  // Se muestra la URL sin contraseña.
  const shown = new URL(url);
  shown.password = '';
  const target = shown.toString();
  const port = Number(url.port || POSTGRES_DEFAULT_PORT);
  const fix = [
    'Opciones:',
    '  - instalar psql (el script lo usa y se conecta a la URL tal cual), o',
    '  - apuntar BOOTSTRAP_DATABASE_URL al servicio de docker compose de /api.',
  ];

  if (!LOCAL_HOSTS.has(url.hostname)) {
    return refuse([
      `Sin psql, db:bootstrap solo puede usar el contenedor de docker compose de /api, y la URL ${target} apunta a otro equipo (${url.hostname}).`,
      'No se ejecutó nada.',
      ...fix,
    ]);
  }

  const published = probe.composePorts();
  if (published.length === 0) {
    return refuse([
      'Sin psql, db:bootstrap usa el servicio postgres de docker compose, y no está en marcha o Docker no responde.',
      'No se ejecutó nada. Levántalo con `docker compose up -d --wait` desde /api, o instala psql.',
    ]);
  }

  if (!published.includes(port)) {
    return refuse([
      `BOOTSTRAP_DATABASE_URL (${target}) apunta al puerto ${port}, pero el servicio postgres de docker compose publica ${published.join(', ')}.`,
      'Sin psql, el respaldo ejecutaría el script en ese contenedor y no en el servidor de la URL. No se ejecutó nada.',
      ...fix,
    ]);
  }

  return { kind: 'compose', user: decodeURIComponent(url.username) || 'postgres' };
}
