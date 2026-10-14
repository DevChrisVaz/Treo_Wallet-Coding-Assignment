import { Receipt, View, theme } from 'wallet-mobile-ui';

// Lienzo de la app a ancho de teléfono. El comprobante muestra el origen como "Principal · •••• 9719"
// con `fromAccountClabe`, como en el último paso del flujo.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};
const principalClabe = '646180157000009719';

const completed = {
  id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
    displayName: 'Luis',
    clabeLast4: '5678',
  },
  amount: '1250.00',
  concept: 'Renta',
  reference: '1',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  createdAt: '2026-10-13T16:41:00Z',
  completedAt: '2026-10-13T16:42:00Z',
};

export const Completed = () => (
  <View style={frame}>
    <Receipt
      transfer={completed}
      fromAccountName="Principal"
      fromAccountClabe={principalClabe}
    />
  </View>
);

export const OwnAccountTransfer = () => (
  <View style={frame}>
    <Receipt
      transfer={{
        ...completed,
        id: '8a2d3b9f-6b1c-4d5f-0b6a-9f1e2d3c4b5a',
        kind: 'OWN',
        destination: {
          type: 'OWN_ACCOUNT',
          accountId: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52',
          beneficiaryId: null,
          displayName: 'Ahorro',
          clabeLast4: '1234',
        },
        amount: '3000.00',
        concept: 'Ahorro quincenal',
        reference: '15',
      }}
      fromAccountName="Principal"
      fromAccountClabe={principalClabe}
    />
  </View>
);

export const Rejected = () => (
  <View style={frame}>
    <Receipt
      transfer={{
        ...completed,
        id: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b',
        status: 'REJECTED',
        amount: '60000.00',
        concept: 'Pago de auto',
        reference: '22',
        completedAt: null,
        rejectionReason: 'DAILY_LIMIT_EXCEEDED',
      }}
      fromAccountName="Principal"
      fromAccountClabe={principalClabe}
    />
  </View>
);

// Bonus (MOB-23): una programada de la web, $1,000.00 a Luis para el 20 de octubre; "Programada" en
// el tono informativo, sin error.
const scheduled = {
  ...completed,
  id: '9a3b5c7d-2e4f-4a6b-8c0d-1e3f5a7b9c2d',
  status: 'SCHEDULED' as const,
  amount: '1000.00',
  scheduledFor: '2026-10-20T20:30:00Z',
  cancelledAt: null,
  createdAt: '2026-10-13T16:50:00Z',
  completedAt: null,
};

export const Scheduled = () => (
  <View style={frame}>
    <Receipt
      transfer={scheduled}
      fromAccountName="Principal"
      fromAccountClabe={principalClabe}
    />
  </View>
);

// Bonus (MOB-23): la misma, cancelada en la web; "Cancelada" en el tono neutro.
export const Cancelled = () => (
  <View style={frame}>
    <Receipt
      transfer={{ ...scheduled, status: 'CANCELLED', cancelledAt: '2026-10-14T15:00:00Z' }}
      fromAccountName="Principal"
      fromAccountClabe={principalClabe}
    />
  </View>
);

// MOB-13: sin referencia (null) la fila "Referencia" no se muestra. Diseño objetivo: el campo del contrato
// pasa a `string | null` con la nueva versión; el comprobante ya oculta la fila.
export const WithoutReference = () => (
  <View style={frame}>
    <Receipt
      transfer={{ ...completed, concept: 'Despensa', reference: null }}
      fromAccountName="Principal"
    />
  </View>
);
