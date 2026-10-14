import { Button, ListSection, Receipt, StepActions, buttonClasses } from 'wallet-web-ui';

/*
 * Acciones de un paso del flujo (WEB-30). `Fixed`: en teléfono quedan fijas abajo, con borde
 * superior, como el `footer` de Screen en la app móvil, y el espaciador reserva su alto para que no
 * tapen lo último del paso (que queda a 20 px del pie). El marco hace de ventana de teléfono (390 de
 * ancho; 640 de alto para que quepa en la captura): su `transform` contiene lo fijo y su `pb-6` es el
 * margen inferior de `main` en el flujo, que el espaciador descuenta. Desde 1024 px las acciones van en línea, debajo del paso. `Inline` (`fixed={false}`):
 * en páginas con pestañas, como el detalle de una transferencia.
 */

const transfer = {
  id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
    displayName: 'Luis Pérez Ramírez',
    clabeLast4: '5678',
  },
  amount: '1250.00',
  concept: 'Renta',
  reference: '1',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  scheduledFor: null,
  cancelledAt: null,
  createdAt: '2026-10-13T18:00:00Z',
  completedAt: '2026-10-13T18:00:01Z',
};
const fromAccount = { name: 'Principal', clabe: '646180157000009719' };

/** El paso de revisión con "Enviar" y "Editar" apiladas, fijas abajo. */
export const Fixed = () => (
  <div className="h-[640px] max-w-[390px] overflow-y-auto bg-surface-canvas px-5 pt-5 pb-6 [transform:translateZ(0)]">
    <div className="grid content-start gap-5">
      <div className="grid justify-items-center gap-1 py-2 text-center">
        <p className="text-label text-fg-secondary">Monto</p>
        <p className="text-display text-fg tabular-nums">$1,250.00</p>
      </div>
      <ListSection>
        <dl className="divide-y divide-border">
          {[
            ['Desde', 'Principal · •••• 9719'],
            ['Para', 'Luis · •••• 5678'],
            ['Concepto', 'Renta'],
            ['Referencia', '1'],
          ].map(([term, value]) => (
            <div key={term} className="flex min-h-11 items-center justify-between gap-4 py-3">
              <dt className="text-body-sm text-fg-secondary">{term}</dt>
              <dd className="text-right text-label text-balance text-fg tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </ListSection>
      <StepActions stacked>
        <Button>Enviar</Button>
        <Button variant="ghost">Editar</Button>
      </StepActions>
    </div>
  </div>
);

export const Inline = () => (
  <div className="max-w-[390px] bg-surface-canvas p-5">
    <div className="grid gap-5">
      <Receipt transfer={transfer} fromAccount={fromAccount} />
      <StepActions fixed={false}>
        <a href="#" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </a>
      </StepActions>
    </div>
  </div>
);
