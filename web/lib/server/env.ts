import 'server-only';
import { parseServerEnv, type ServerEnv } from '@/lib/config';

/** Configuración validada del servidor. Se lee en cada uso para respetar el entorno vigente. */
export function serverEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
