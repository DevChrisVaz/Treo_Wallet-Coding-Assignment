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
  'bluetooth',
  'accelerometer',
  'gyroscope',
  'magnetometer',
  'midi',
  'display-capture',
];

/**
 * Headers de seguridad que no dependen de la petición (WEB-38, D7 de security-hardening). Van en
 * `headers()` de `next.config` porque el proxy no corre en `/bff/*` ni en `/_next/*`.
 *
 * - `Referrer-Policy` es `strict-origin-when-cross-origin` y no `no-referrer`: con `no-referrer` el
 *   navegador manda `Origin: null` en los POST del mismo origen y las Server Actions, que comparan
 *   `Origin` con `Host` (WEB-06), rechazarían toda mutación.
 * - HSTS solo con HTTPS (`secure`): por HTTP en local fijaría `localhost` a HTTPS en el navegador. Sin
 *   `preload`, que es una decisión de dominio difícil de revertir.
 */
export function securityHeaders({ secure }: { secure: boolean }): HeaderEntry[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: DISABLED_FEATURES.map((name) => `${name}=()`).join(', ') },
    ...(secure
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
      : []),
  ];
}
