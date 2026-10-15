import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { allowedOriginHosts, parseServerEnv } from './lib/config';
import { securityHeaders } from './lib/security-headers';

/**
 * Valida el entorno al arrancar (`next dev` y `next start`): una variable inválida detiene el
 * proceso. En el build (y en `next typegen`) `API_BASE_URL` todavía no es obligatoria, porque el
 * servidor la lee en cada petición; el resto se valida igual.
 */
export default function nextConfig(phase: string): NextConfig {
  const env = parseServerEnv(process.env, {
    requireApiBaseUrl: phase === PHASE_PRODUCTION_BUILD ? false : undefined,
  });

  return {
    poweredByHeader: false,
    // `next dev` escribe un AGENTS.md cuando detecta un agente de IA; el proyecto no lo versiona.
    agentRules: false,
    // En desarrollo, Next.js registra los argumentos de cada Server Action: contraseñas, códigos
    // OTP y montos terminarían en los logs.
    logging: { serverFunctions: false },
    // Headers de seguridad en toda respuesta, también `/bff/*` y `/_next/*`, que el proxy no toca
    // (WEB-38). La política de contenido (WEB-39) y HSTS dependen de la petición o de la configuración en
    // ejecución, y viven en `proxy.ts`: `headers()` se evalúa en el build.
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders() }];
    },
    experimental: {
      serverActions: {
        // Las Server Actions comparan Origin con Host; detrás de un proxy se permiten estos hosts.
        allowedOrigins: allowedOriginHosts(env.allowedOrigins),
      },
    },
  };
}
