export interface WordmarkProps {
  variant?: 'full' | 'compact';
  /** `inverse` sobre superficies oscuras (navegación lateral, pantallas de marca). */
  tone?: 'default' | 'inverse';
  /**
   * `brand`: el completo en `h1`, el tamaño del Wordmark completo de la app móvil, para la superficie
   * de marca (BrandShell, WEB-25/WEB-31). Por omisión, `h2` (encabezados de la app).
   */
  size?: 'default' | 'brand';
  className?: string;
}

/**
 * Logotipo de texto "TreoWallet": "Treo" en tinta y "Wallet" en verde de acción (DSG-02). Completo en
 * `h2` (`h1` con `size="brand"`) y compacto en `h3`.
 */
export function Wordmark({
  variant = 'full',
  tone = 'default',
  size = 'default',
  className = '',
}: WordmarkProps) {
  const text = variant === 'compact' ? 'text-h3' : size === 'brand' ? 'text-h1' : 'text-h2';
  const inverse = tone === 'inverse';
  return (
    <span className={`${text} font-semibold ${className}`.trim()}>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-fg'}>Treo</span>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-action'}>Wallet</span>
    </span>
  );
}
