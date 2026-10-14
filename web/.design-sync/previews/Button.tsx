import { Button } from 'wallet-web-ui';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Continuar</Button>
    <Button variant="secondary">Ver movimientos</Button>
    <Button variant="ghost">Cancelar</Button>
    <Button variant="destructive">Eliminar beneficiario</Button>
  </div>
);

export const Loading = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button loading>Transferir</Button>
    <Button variant="secondary" loading loadingLabel="Reenviando…">
      Reenviar código
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Continuar</Button>
    <Button variant="secondary" disabled>
      Ver movimientos
    </Button>
  </div>
);

export const FormActions = () => (
  <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
    <Button variant="ghost">Regresar</Button>
    <Button type="submit">Confirmar transferencia</Button>
  </div>
);
