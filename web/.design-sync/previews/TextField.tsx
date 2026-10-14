import { TextField } from 'wallet-web-ui';

export const Default = () => (
  <div className="max-w-md">
    <TextField
      label="Correo electrónico"
      type="email"
      autoComplete="email"
      placeholder="ana@example.com"
    />
  </div>
);

export const WithHint = () => (
  <div className="max-w-md">
    <TextField
      label="Concepto"
      defaultValue="Renta de octubre"
      maxLength={40}
      hint="Hasta 40 caracteres. Lo verá quien recibe la transferencia."
    />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <TextField
      label="Referencia"
      inputMode="numeric"
      defaultValue="12A"
      error="Escribe de 1 a 7 dígitos."
    />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md">
    <TextField label="Nombre completo" defaultValue="Ana Gómez Castillo" disabled />
  </div>
);

export const SignInForm = () => (
  <form className="grid max-w-md gap-4">
    <TextField label="Correo electrónico" type="email" defaultValue="ana@example.com" />
    <TextField
      label="Contraseña"
      type="password"
      defaultValue="contraseña-segura"
      hint="Al menos 12 caracteres."
    />
  </form>
);
