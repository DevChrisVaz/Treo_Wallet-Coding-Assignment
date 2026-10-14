import { Button, OtpField } from 'wallet-web-ui';

export const Default = () => (
  <div className="max-w-md">
    <OtpField label="Código de 6 dígitos" />
  </div>
);

export const Filled = () => (
  <div className="max-w-md">
    <OtpField label="Código de 6 dígitos" defaultValue="482913" />
  </div>
);

export const WithHint = () => (
  <div className="max-w-md">
    <OtpField
      label="Código de 6 dígitos"
      defaultValue="1053"
      hint="Lo enviamos a tu correo. Vence en 15 minutos."
    />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <OtpField
      label="Código de 6 dígitos"
      defaultValue="4829"
      error="El código debe tener 6 dígitos"
    />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md">
    <OtpField label="Código anterior" defaultValue="105377" disabled />
  </div>
);

export const ConfirmTransfer = () => (
  <section className="grid max-w-md gap-5">
    <h2 className="text-h2 text-fg">Ingresa el código</h2>
    <p className="text-body text-fg-secondary">
      Te enviamos un código a a***@example.com. Vence a las 10:47.
    </p>
    <form className="grid gap-5">
      <OtpField label="Código de 6 dígitos" defaultValue="482913" />
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Confirmar</Button>
        <Button variant="ghost">Reenviar código</Button>
      </div>
    </form>
  </section>
);
