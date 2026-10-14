export interface WordmarkProps {
  variant?: 'full' | 'compact';
  /** `inverse` sobre superficies oscuras (navegación lateral, pantallas de marca). */
  tone?: 'default' | 'inverse';
  className?: string;
}

/**
 * Logotipo de texto "TreoWallet": "Treo" en tinta y "Wallet" en verde de acción (DSG-02). Completo en
 * `h1` y compacto en `h3`, los mismos tamaños que en la app móvil (WEB-25).
 */
export function Wordmark({ variant = 'full', tone = 'default', className = '' }: WordmarkProps) {
  const size = variant === 'compact' ? 'text-h3' : 'text-h1';
  const inverse = tone === 'inverse';
  return (
    <span className={`${size} font-semibold ${className}`.trim()}>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-fg'}>Treo</span>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-action'}>Wallet</span>
    </span>
  );
}
