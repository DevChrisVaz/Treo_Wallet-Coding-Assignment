import { BrandShell, Button, InlineAlert, TextField } from 'wallet-web-ui';

/*
 * Estructura de las pantallas públicas (WEB-31): verde arriba y hoja blanca abajo en la forma de
 * app; panel dividido en el dashboard. El título es el h1 de la página. Las pantallas completas
 * (Login, Register, VerifyEmail) están en AppShell.
 */

export const Default = () => (
  <BrandShell title="Inicia sesión">
    <form noValidate className="grid gap-5">
      <TextField label="Correo" type="email" autoComplete="email" />
      <Button type="submit">Continuar</Button>
    </form>
  </BrandShell>
);

/** Con un aviso arriba del formulario (por ejemplo, la sesión expiró). */
export const WithNotice = () => (
  <BrandShell title="Inicia sesión">
    <InlineAlert tone="info" title="Tu sesión expiró">
      Inicia sesión de nuevo para continuar.
    </InlineAlert>
    <form noValidate className="grid gap-5">
      <TextField label="Correo" type="email" autoComplete="email" defaultValue="ana@example.com" />
      <TextField label="Contraseña" type="password" autoComplete="current-password" />
      <Button type="submit">Iniciar sesión</Button>
    </form>
  </BrandShell>
);
