#!/usr/bin/env node
// Verifica la distribución local (DSG-01): un proyecto nuevo instala el paquete con "file:<ruta>"
// e install-links=true, sin credenciales, y recibe una copia (no un enlace simbólico) que funciona
// sin instalar dependencias de runtime. Uso: node scripts/verify-install.mjs [directorio]
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const packageDir = resolve(process.argv[2] ?? '.');
const consumer = mkdtempSync(join(tmpdir(), 'wallet-design-tokens-consumer-'));
const packageName = '@devchrisvaz/wallet-design-tokens';
const failures = [];

try {
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'verify-install',
      private: true,
      dependencies: { [packageName]: `file:${packageDir}` },
    }),
  );
  writeFileSync(join(consumer, '.npmrc'), 'install-links=true\n');
  const emptyUserConfig = join(consumer, 'empty-user.npmrc');
  writeFileSync(emptyUserConfig, '');
  const env = { ...process.env, npm_config_userconfig: emptyUserConfig };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;

  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: consumer,
    env,
    encoding: 'utf8',
  });
  if (install.status !== 0) failures.push(`npm install falló:\n${install.stderr}`);

  const installed = join(consumer, 'node_modules', packageName);
  if (!existsSync(installed)) {
    failures.push('el paquete no quedó instalado');
  } else {
    if (lstatSync(installed).isSymbolicLink()) {
      failures.push('el paquete es un enlace simbólico a la carpeta design-tokens, no una copia');
    }
    const others = readdirSync(join(consumer, 'node_modules')).filter(
      (entry) => !entry.startsWith('.') && entry !== '@devchrisvaz',
    );
    if (others.length > 0) failures.push(`se instalaron dependencias: ${others.join(', ')}`);

    const requireFromConsumer = createRequire(join(consumer, 'package.json'));
    if (requireFromConsumer(packageName).theme.colors.action.primary !== '#1C4B42') {
      failures.push('el paquete instalado no funciona');
    }
    if (!requireFromConsumer(`${packageName}/native`).theme.typography) {
      failures.push('el subpath ./native no funciona');
    }
    for (const sheet of ['tokens.css', 'tailwind.css']) {
      try {
        requireFromConsumer.resolve(`${packageName}/${sheet}`);
      } catch {
        failures.push(`el subpath ./${sheet} no se resuelve`);
      }
    }
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`verify:install falló:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('El paquete se instala como copia, sin credenciales ni dependencias de runtime.');
