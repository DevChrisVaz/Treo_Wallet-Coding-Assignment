import { Button, OtpField, StepActions, StepHeading } from 'wallet-web-ui';

/*
 * Título de un paso que no es el h1 de la página. Tras el rediseño solo lo usa el detalle de una
 * transferencia (`/transfers/[id]`): el h1 es "Transferencia" (AppShell) y, si sigue pendiente del
 * código, el paso se titula "Confirma con tu código". En la app toma el foco al aparecer; en un lienzo
 * con varias celdas ese foco movería el scroll, así que aquí va `focus={false}`.
 */

export const Default = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <StepHeading focus={false}>Confirma con tu código</StepHeading>
  </div>
);

/** El detalle de una transferencia de $15,000.00 que espera el código (acciones en línea). */
export const DetailPendingOtp = () => (
  <div className="grid max-w-2xl gap-5 bg-surface-canvas p-5">
    <StepHeading focus={false}>Confirma con tu código</StepHeading>
    <div className="grid justify-items-center gap-1 py-2 text-center">
      <p className="text-label text-fg-secondary">Monto</p>
      <p className="text-display text-fg tabular-nums">$15,000.00</p>
      <p className="text-body-sm text-fg-secondary">Para Luis · CLABE •••• 5678</p>
    </div>
    <form noValidate className="grid gap-5">
      <div className="grid gap-4">
        <p className="text-body text-fg">Te enviamos un código de 6 dígitos a an***@example.com.</p>
        <div className="grid gap-1 text-body-sm text-fg-secondary tabular-nums">
          <p>Vence a las 12:05.</p>
          <p>Te quedan 3 intentos.</p>
        </div>
        <OtpField label="Código de 6 dígitos" />
      </div>
      <StepActions fixed={false}>
        <Button type="submit">Confirmar</Button>
        <Button variant="ghost">Reenviar código</Button>
      </StepActions>
    </form>
  </div>
);
