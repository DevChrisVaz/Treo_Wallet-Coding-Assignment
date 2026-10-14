import { Button, InlineAlert, TextField } from 'wallet-web-ui';

/* Alertas sobre el lienzo de la app, con los textos de las pantallas rediseñadas. */

export const Danger = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <InlineAlert tone="danger" title="Saldo insuficiente">
      <p>No tienes saldo suficiente para esta transferencia.</p>
      <p>Saldo disponible en Principal: $25,000.00</p>
    </InlineAlert>
  </div>
);

export const Warning = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <InlineAlert tone="warning" title="No pudimos confirmar el estado de tu transferencia">
      Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces.
    </InlineAlert>
  </div>
);

export const Success = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <InlineAlert tone="success">Te enviamos un código nuevo.</InlineAlert>
  </div>
);

export const Info = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <InlineAlert tone="info" title="Tu sesión expiró">
      Inicia sesión de nuevo para continuar.
    </InlineAlert>
  </div>
);

export const MessageOnly = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <InlineAlert tone="danger">El correo o la contraseña no coinciden.</InlineAlert>
  </div>
);

/**
 * El formulario de inicio de sesión con el aviso de sesión expirada, en la hoja blanca que BrandShell
 * pone sobre la superficie de marca.
 */
export const SignInExpired = () => (
  <div className="max-w-[390px] bg-surface-hero pt-8">
    <form className="grid gap-5 rounded-t-lg bg-surface px-5 pt-8 pb-10">
      <InlineAlert tone="info" title="Tu sesión expiró">
        Inicia sesión de nuevo para continuar.
      </InlineAlert>
      <TextField label="Correo" type="email" defaultValue="ana@example.com" />
      <TextField label="Contraseña" type="password" />
      <Button type="submit" className="w-full">
        Iniciar sesión
      </Button>
    </form>
  </div>
);
