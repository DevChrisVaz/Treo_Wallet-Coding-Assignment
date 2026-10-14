import { Button, OtpField, StepActions } from 'wallet-web-ui';

/* Campo del código de 6 dígitos sobre el lienzo, con los textos del paso "Código" y de la verificación. */

export const Default = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <OtpField label="Código de 6 dígitos" />
  </div>
);

export const Filled = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <OtpField label="Código de 6 dígitos" defaultValue="482913" />
  </div>
);

export const WithHint = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <OtpField
      label="Código de 6 dígitos"
      defaultValue="1053"
      hint="Lo enviamos a tu correo. Vence en 15 minutos."
    />
  </div>
);

export const WithError = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <OtpField
      label="Código de 6 dígitos"
      defaultValue="4829"
      error="El código debe tener 6 dígitos"
    />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <OtpField label="Código anterior" defaultValue="105377" disabled />
  </div>
);

/**
 * El paso "Código" del flujo: el aviso, los datos y el campo en su pila; las acciones a la distancia
 * del paso. En teléfono las acciones van fijas abajo (StepActions); aquí, en línea.
 */
export const ConfirmTransfer = () => (
  <form noValidate className="grid max-w-md gap-5 bg-surface-canvas p-5">
    <div className="grid gap-4">
      <p className="text-body text-fg">Te enviamos un código de 6 dígitos a an***@example.com.</p>
      <div className="grid gap-1 text-body-sm text-fg-secondary tabular-nums">
        <p>Vence a las 12:05.</p>
        <p>Te quedan 3 intentos.</p>
      </div>
      <OtpField label="Código de 6 dígitos" defaultValue="482913" />
    </div>
    <StepActions fixed={false}>
      <Button type="submit">Confirmar</Button>
      <Button variant="ghost">Reenviar código</Button>
    </StepActions>
  </form>
);
