import { IconButton } from './Icon';
import { Stepper } from './Stepper';

export interface FlowHeaderProps {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  closeHref: string;
}

/**
 * Encabezado del flujo de transferencia: cerrar, título y pasos (WEB-30). Va dentro del contenido
 * de AppShell, que da el margen lateral (20 px en teléfono, como en la app móvil, WEB-25); en el
 * dashboard baja a la altura del título de TopBar.
 */
export function FlowHeader({ title, step, total, stepLabel, closeHref }: FlowHeaderProps) {
  return (
    <header className="grid gap-4 pt-4 pb-2 dashboard:pt-8">
      <div className="flex items-center gap-2">
        <IconButton
          icon="close"
          label="Salir de la transferencia"
          href={closeHref}
          className="-ml-3"
        />
        <h1 className="text-h3 text-fg">{title}</h1>
      </div>
      <Stepper current={step} total={total} label={stepLabel} />
    </header>
  );
}
