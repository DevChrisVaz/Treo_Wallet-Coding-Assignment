export interface SkeletonProps {
  variant?: 'line' | 'card';
  className?: string;
}

const VARIANTS = {
  line: 'h-4 w-full rounded-sm',
  card: 'h-36 w-full rounded-md',
} as const;

/** Esqueleto de carga: oculto para lectores de pantalla y sin pulso con movimiento reducido. */
export function Skeleton({ variant = 'line', className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-border motion-reduce:animate-none ${VARIANTS[variant]} ${className}`.trim()}
    />
  );
}
