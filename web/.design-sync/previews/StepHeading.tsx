import { Button, InlineAlert, OtpField, Receipt, StepHeading, buttonClasses } from 'wallet-web-ui';

/*
 * En la app el título toma el foco al cambiar de paso. En un lienzo con varias celdas ese foco
 * movería el scroll, así que aquí se pasa `focus={false}`.
 */

function SummaryRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className="text-body text-fg sm:col-span-2">{children}</dd>
    </div>
  );
}

export const Default = () => <StepHeading focus={false}>Confirma la transferencia</StepHeading>;

export const ConfirmStep = () => (
  <section aria-labelledby="confirm-title" className="grid max-w-xl gap-5">
    <StepHeading id="confirm-title" focus={false}>
      Confirma la transferencia
    </StepHeading>
    <dl className="rounded-lg bg-surface p-6 shadow-card">
      <SummaryRow term="Monto">
        <span className="text-h3 tabular-nums">$5,000.00</span>
      </SummaryRow>
      <SummaryRow term="Origen">Principal •••• 9719</SummaryRow>
      <SummaryRow term="Destino">Luis •••• 9735</SummaryRow>
      <SummaryRow term="Concepto">Renta de octubre</SummaryRow>
      <SummaryRow term="Referencia">1024</SummaryRow>
    </dl>
    <div className="flex flex-wrap gap-3">
      <Button>Enviar</Button>
      <Button variant="secondary">Editar</Button>
    </div>
  </section>
);

export const OtpStep = () => (
  <section aria-labelledby="otp-title" className="grid max-w-xl gap-5">
    <StepHeading id="otp-title" focus={false}>
      Ingresa el código
    </StepHeading>
    <p className="text-body text-fg-secondary">
      Te enviamos un código a an***@example.com. Vence a las 10:52.
    </p>
    <form noValidate className="grid gap-5">
      <OtpField label="Código de 6 dígitos" defaultValue="482915" />
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Confirmar</Button>
        <Button variant="ghost">Reenviar código</Button>
      </div>
    </form>
  </section>
);

export const ReceiptStep = () => (
  <section aria-labelledby="receipt-step-title" className="grid max-w-xl gap-5">
    <StepHeading id="receipt-step-title" focus={false}>
      Transferencia enviada
    </StepHeading>
    <Receipt
      transfer={{
        id: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
        status: 'COMPLETED',
        kind: 'THIRD_PARTY',
        fromAccountId: '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a',
        destination: {
          type: 'BENEFICIARY',
          accountId: null,
          beneficiaryId: '2d9f8b7a-6e5d-4c4b-8a39-8b7a6f5e4d3c',
          displayName: 'Luis',
          clabeLast4: '9735',
        },
        amount: '5000.00',
        concept: 'Renta de octubre',
        reference: '1024',
        requiresOtp: false,
        otp: null,
        rejectionReason: null,
        failureReason: null,
        createdAt: '2026-10-13T16:42:00.000Z',
        completedAt: '2026-10-13T16:42:01.000Z',
      }}
      fromAccount={{ name: 'Principal', clabe: '032180000118359719' }}
    />
    <div className="flex flex-wrap gap-3">
      <a href="#" className={buttonClasses('secondary')}>
        Ver mis cuentas
      </a>
      <Button variant="ghost">Hacer otra transferencia</Button>
    </div>
  </section>
);

export const EndedStep = () => (
  <section aria-labelledby="ended-title" className="grid max-w-xl gap-5">
    <StepHeading id="ended-title" focus={false}>
      La transferencia no se realizó
    </StepHeading>
    <InlineAlert tone="danger" title="Superaste tu límite diario">
      Esta transferencia supera lo que te queda del límite de hoy. Hoy puedes enviar hasta
      $3,500.00.
    </InlineAlert>
    <div>
      <Button>Iniciar una nueva transferencia</Button>
    </div>
  </section>
);
