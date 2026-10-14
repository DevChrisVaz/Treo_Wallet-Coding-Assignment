import { Button, InlineAlert, TextField } from 'wallet-web-ui';

export const Danger = () => (
  <div className="max-w-xl">
    <InlineAlert tone="danger" title="Saldo insuficiente">
      <p>No tienes saldo suficiente para esta transferencia.</p>
      <p>Saldo disponible en Principal: $25,000.00</p>
    </InlineAlert>
  </div>
);

export const Warning = () => (
  <div className="max-w-xl">
    <InlineAlert tone="warning" title="No pudimos enviarte el código">
      Pide uno nuevo con &quot;Reenviar código&quot;.
    </InlineAlert>
  </div>
);

export const Success = () => (
  <div className="max-w-xl">
    <InlineAlert tone="success">Te enviamos un código nuevo.</InlineAlert>
  </div>
);

export const Info = () => (
  <div className="max-w-xl">
    <InlineAlert tone="info" title="Tu sesión expiró">
      Inicia sesión de nuevo para continuar.
    </InlineAlert>
  </div>
);

export const MessageOnly = () => (
  <div className="max-w-xl">
    <InlineAlert tone="danger">El correo o la contraseña no coinciden.</InlineAlert>
  </div>
);

export const SignInExpired = () => (
  <form className="grid max-w-md gap-5">
    <InlineAlert tone="info" title="Tu sesión expiró">
      Inicia sesión de nuevo para continuar.
    </InlineAlert>
    <TextField label="Correo" type="email" defaultValue="ana@example.com" />
    <TextField label="Contraseña" type="password" />
    <div>
      <Button type="submit">Iniciar sesión</Button>
    </div>
  </form>
);
