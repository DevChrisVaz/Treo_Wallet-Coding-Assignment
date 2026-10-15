import { Icon } from 'wallet-web-ui';

/*
 * Iconos de línea del sistema (DSG-15, Lucide): un concepto por nombre. Son decorativos salvo que
 * lleven `label`.
 */

const CONCEPTS = [
  'home',
  'movements',
  'transfer',
  'beneficiaries',
  'logout',
  'moneyIn',
  'moneyOut',
  'deposit',
  'ownTransfer',
  'success',
  'error',
  'warning',
  'info',
  'close',
  'back',
  'forward',
  'expand',
  'filter',
  'account',
] as const;

export const AllConcepts = () => (
  <ul className="grid max-w-xl grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4">
    {CONCEPTS.map((name) => (
      <li key={name} className="flex items-center gap-2 text-caption text-fg-secondary">
        <Icon name={name} className="text-fg" />
        {name}
      </li>
    ))}
  </ul>
);

/** Glifos de interfaz que aún no son conceptos del paquete de tokens (DSG-15): buscar, copiar, confirmar y selector. */
const EXTRAS = ['search', 'copy', 'check', 'selector'] as const;

export const InterfaceGlyphs = () => (
  <ul className="grid max-w-xl grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4">
    {EXTRAS.map((name) => (
      <li key={name} className="flex items-center gap-2 text-caption text-fg-secondary">
        <Icon name={name} className="text-fg" />
        {name}
      </li>
    ))}
  </ul>
);

export const Sizes = () => (
  <div className="flex items-end gap-6 text-fg">
    <Icon name="transfer" size="sm" />
    <Icon name="transfer" size="md" />
    <Icon name="transfer" size="lg" />
  </div>
);

/** Con `label` el icono se anuncia (role="img"); va en el color del texto que lo rodea. */
export const Labelled = () => (
  <p className="flex items-center gap-2 text-body text-success">
    <Icon name="success" label="Completada" />
    Transferencia completada
  </p>
);
