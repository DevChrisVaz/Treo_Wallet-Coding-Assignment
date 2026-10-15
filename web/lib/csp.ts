export interface CspOptions {
  nonce: string;
  /** `next dev`: React necesita `eval` para reconstruir pilas de llamadas. */
  development: boolean;
  /** Con HTTPS (`SESSION_COOKIE_SECURE`): con HTTP en local rompería la carga de los recursos. */
  secure: boolean;
}

/**
 * Content-Security-Policy de las páginas (WEB-39, D6 de security-hardening). Sin `unsafe-inline` en
 * los scripts: solo corren los de la propia web y los que llevan el nonce de la petición, y
 * `strict-dynamic` deja que estos carguen los suyos (los chunks de Next.js). Los estilos también
 * llevan nonce.
 *
 * Cuando se cargue el script de CAPTCHA de AWS WAF en `/register` (docs/aws-deploy.md, sección 6),
 * `script-src` y `connect-src` necesitarán el origen que indique la documentación de AWS.
 */
export function contentSecurityPolicy({ nonce, development, secure }: CspOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(secure ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** Nonce de una petición: 16 bytes aleatorios en base64 (la guía de Next.js usa un UUID en base64). */
export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}
