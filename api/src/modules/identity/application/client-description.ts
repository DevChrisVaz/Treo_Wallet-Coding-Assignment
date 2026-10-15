/** Lo que el aviso de inicio de sesión dice del cliente (IDN-18). */
export interface ClientDescription {
  readonly kind: 'app' | 'browser' | 'unknown';
  /** Frase lista para el correo: nunca contiene el `User-Agent` tal como llegó. */
  readonly text: string;
}

const UNKNOWN: ClientDescription = { kind: 'unknown', text: 'un dispositivo' };

/** Un `User-Agent` más largo que esto no es de un cliente real; se mira solo el inicio. */
const MAX_LENGTH = 512;

/** `TreoWallet-App/<versión> (<sistema>)`, el valor que fija la app (MOB-32, D10). */
const APP_TOKEN = /^TreoWallet-App\/[0-9A-Za-z.+-]{1,32} \(([a-z]{2,16})\)$/;
const APP_SYSTEMS: Readonly<Record<string, string>> = { ios: 'iOS', android: 'Android' };

/** Navegadores en orden: los derivados de Chromium también dicen "Chrome" y "Safari". */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\//, 'Opera'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

/** Sistemas en orden: iOS y Android también dicen "Mac OS X" y "Linux". */
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows NT\b/, 'Windows'],
  [/\bMac OS X\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

/**
 * Describe en palabras al cliente de un inicio de sesión a partir del `User-Agent` (D10 de
 * security-hardening). Son reglas fijas y en orden, sin dependencias: la app se reconoce solo por su
 * token propio, un navegador por su marca y su sistema, y todo lo demás es "un dispositivo". No
 * reconoce la app por el valor de `okhttp` o `CFNetwork`, que cambia con cada sistema.
 */
export function describeClient(userAgent: string | undefined): ClientDescription {
  const value = userAgent?.slice(0, MAX_LENGTH).trim();
  if (!value) return UNKNOWN;

  const app = APP_TOKEN.exec(value);
  if (app) {
    const system = APP_SYSTEMS[app[1] ?? ''];
    return { kind: 'app', text: `la app de TreoWallet${system ? ` en ${system}` : ''}` };
  }

  const browser = BROWSERS.find(([pattern]) => pattern.test(value))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(value))?.[1];
  if (!browser || !system) return UNKNOWN;
  return { kind: 'browser', text: `${browser} en ${system}` };
}
