import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { allowedOriginHosts, parseServerEnv } from './lib/config';

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
    experimental: {
      serverActions: {
        // Las Server Actions comparan Origin con Host; detrás de un proxy se permiten estos hosts.
        allowedOrigins: allowedOriginHosts(env.allowedOrigins),
      },
    },
  };
}
