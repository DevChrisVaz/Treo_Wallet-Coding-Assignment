import { TextField } from 'wallet-web-ui';

/*
 * Campos de texto sobre el lienzo, con las ayudas y los errores de las pantallas rediseñadas
 * (Concepto y Referencia con la redacción de la app móvil, R30). Los de las pantallas de marca van
 * en la hoja blanca de BrandShell.
 */

export const Default = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <TextField label="Correo" type="email" autoComplete="email" placeholder="ana@example.com" />
  </div>
);

export const WithHint = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <TextField label="Concepto" defaultValue="Renta" maxLength={40} hint="De 1 a 40 caracteres." />
  </div>
);

export const WithError = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <TextField
      label="Referencia"
      inputMode="numeric"
      defaultValue="12A"
      hint="De 1 a 7 dígitos."
      error="La referencia solo admite dígitos"
    />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md bg-surface-canvas p-5">
    <TextField label="Nombre completo" defaultValue="Ana Gómez Castillo" disabled />
  </div>
);

/** Inicio de sesión, en la hoja blanca que BrandShell pone sobre la superficie de marca. */
export const SignInForm = () => (
  <div className="max-w-[390px] bg-surface-hero pt-8">
    <form className="grid gap-4 rounded-t-lg bg-surface px-5 pt-8 pb-10">
      <TextField label="Correo" type="email" defaultValue="ana@example.com" />
      <TextField label="Contraseña" type="password" defaultValue="contraseña-segura" />
    </form>
  </div>
);
