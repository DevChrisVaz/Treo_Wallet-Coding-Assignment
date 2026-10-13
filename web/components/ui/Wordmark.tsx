export interface WordmarkProps {
  variant?: 'full' | 'compact';
  className?: string;
}

/** Logotipo de texto "TreoWallet": "Treo" en tinta y "Wallet" en verde de acción (DSG-02). */
export function Wordmark({ variant = 'full', className = '' }: WordmarkProps) {
  const size = variant === 'compact' ? 'text-h3' : 'text-h2';
  return (
    <span className={`${size} font-semibold ${className}`.trim()}>
      <span className="text-fg">Treo</span>
      <span className="text-action">Wallet</span>
    </span>
  );
}
