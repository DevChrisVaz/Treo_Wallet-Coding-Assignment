/**
 * URL base de la API (MOB-17). Se configura con `EXPO_PUBLIC_API_URL` (Expo la incorpora al bundle)
 * para apuntar a la API local por la IP de la red sin cambiar código.
 */
export type ApiUrlConfig =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'invalid'; value: string };

// Sin `URL`: su implementación en React Native es incompleta. Esquema http(s), host (nombre, IPv4
// o IPv6 entre corchetes), puerto opcional y ruta opcional, sin consulta ni fragmento.
const HTTP_URL =
  /^https?:\/\/([A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*|\[[0-9A-Fa-f:.]+\])(:\d{1,5})?(\/[^\s?#]*)?$/;

export function parseApiUrl(value: string | undefined): ApiUrlConfig {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return { ok: false, reason: 'missing' };
  if (!HTTP_URL.test(trimmed)) return { ok: false, reason: 'invalid', value: trimmed };
  return { ok: true, baseUrl: trimmed.replace(/\/+$/, '') };
}

export function readApiUrl(): ApiUrlConfig {
  // Acceso directo y completo: Expo solo sustituye `process.env.EXPO_PUBLIC_*` escrito así.
  return parseApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
