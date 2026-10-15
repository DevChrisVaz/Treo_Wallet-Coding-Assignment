export interface HeaderEntry {
  key: string;
  value: string;
}

/** Capacidades del navegador que la web no usa: un script inyectado no puede pedirlas. */
const DISABLED_FEATURES = [
  'camera',
  'microphone',
  'geolocation',
  'payment',
  'usb',
  'serial',
  'accelerometer',
  'gyroscope',
  'magnetometer',
  'midi',
  'display-capture',
];

/**
 * Valor de `Strict-Transport-Security` (WEB-38). Solo con HTTPS: por HTTP en local fijaría
 * `localhost` a HTTPS en el navegador. Sin `preload`, que es una decisión de dominio difícil de
 * revertir. Lo envía `proxy.ts` según `SESSION_COOKIE_SECURE` **en tiempo de ejecución**: `headers()`
 * de `next.config` se evalúa en `next build` y queda fijo en `routes-manifest.json`, y un build
 * hecho sin esa variable no debe decidir si el servidor que arranca después manda HSTS.
 */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';

/**
 * Headers de seguridad que no dependen de la configuración ni de la petición (WEB-38, D7 de
 * security-hardening). Van en `headers()` de `next.config` porque el proxy no corre en `/bff/*` ni en
 * `/_next/*`.
 *
 * - `Referrer-Policy` es `strict-origin-when-cross-origin` y no `no-referrer`: con `no-referrer` el
 *   navegador manda `Origin: null` en los POST del mismo origen y las Server Actions, que comparan
 *   `Origin` con `Host` (WEB-06), rechazarían toda mutación.
 * - `Permissions-Policy` lista solo funciones que Chromium reconoce: una desconocida (como
 *   `bluetooth`) registra un error en la consola de cada página. `security-headers.spec.ts` falla si
 *   aparece uno.
 */
export function securityHeaders(): HeaderEntry[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: DISABLED_FEATURES.map((name) => `${name}=()`).join(', ') },
  ];
}
