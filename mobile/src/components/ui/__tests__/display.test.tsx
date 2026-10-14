import type { Movement, Transfer } from '@devchrisvaz/wallet-contract';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, View } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { theme } from '@/theme';

import {
  AccountCard,
  Avatar,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  MovementRow,
  Receipt,
  Skeleton,
  StatusBadge,
} from '..';

const movement = (overrides: Partial<Movement>): Movement => ({
  id: 'm1',
  type: 'TRANSFER_OUT',
  amount: '-150.00',
  balanceAfter: '24850.00',
  concept: 'Despensa',
  reference: '1',
  counterparty: { name: 'Mamá', clabeLast4: '1234' },
  transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  occurredAt: '2026-10-13T01:05:00Z',
  ...overrides,
});

describe('AccountCard', () => {
  test('DSG-09 muestra nombre, CLABE enmascarada y saldo con formatMXN y dígitos tabulares', async () => {
    await render(<AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" />);
    expect(screen.getByText('Principal')).toBeOnTheScreen();
    expect(screen.getByText('CLABE •••• 9719')).toHaveStyle({ fontVariant: ['tabular-nums'] });
    expect(screen.queryByText(/646180157000009719/)).toBeNull();
    expect(screen.getByText('$25,000.00')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });
});

describe('MovementRow', () => {
  test('DSG-09 una salida muestra −$150.00 en tinta, con su etiqueta, contraparte y saldo', async () => {
    await render(<MovementRow movement={movement({})} />);
    expect(screen.getByText('Transferencia enviada')).toBeOnTheScreen();
    expect(screen.getByText('Mamá · Despensa')).toBeOnTheScreen();
    expect(screen.getByText('−$150.00')).toHaveStyle({
      color: theme.colors.money.out,
      fontVariant: ['tabular-nums'],
    });
    expect(screen.getByText('Saldo $24,850.00')).toBeOnTheScreen();
  });

  test.each([false, true])(
    'MOB-06 los lectores de pantalla oyen la fecha completa y la referencia (timeOnly: %s)',
    async (timeOnly) => {
      await render(<MovementRow movement={movement({})} timeOnly={timeOnly} />);
      expect(screen.getByLabelText('12 oct, 19:05 · Ref. 1')).toBeOnTheScreen();
      expect(screen.queryByLabelText('12 oct, 19:05')).toBeNull();
    },
  );

  test('MOB-06 por omisión muestra la fecha completa y la referencia, con borde inferior', async () => {
    await render(<MovementRow movement={movement({})} />);
    expect(screen.getByText('12 oct, 19:05 · Ref. 1')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-row')).toHaveStyle({
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.default,
    });
  });

  test('MOB-20 con timeOnly muestra hora, referencia y saldo, con avatar por tipo y sin borde', async () => {
    await render(<MovementRow movement={movement({})} timeOnly />);
    expect(screen.getByText('19:05 · Ref. 1')).toBeOnTheScreen();
    expect(screen.getByText('Saldo $24,850.00')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-avatar', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('movement-row')).not.toHaveStyle({ borderBottomWidth: 1 });
  });

  test('DSG-10 un depósito de la Tesorería (sin contraparte) muestra +$ en verde', async () => {
    await render(
      <MovementRow
        movement={movement({
          type: 'DEPOSIT',
          amount: '25000.00',
          balanceAfter: '25000.00',
          concept: 'Depósito inicial',
          counterparty: null,
        })}
      />,
    );
    expect(screen.getByText('Depósito')).toBeOnTheScreen();
    expect(screen.getByText('Depósito inicial')).toBeOnTheScreen();
    expect(screen.getByText('+$25,000.00')).toHaveStyle({ color: theme.colors.money.in });
  });
});

describe('StatusBadge', () => {
  test('DSG-10 PENDING_OTP usa el tono de aviso y la etiqueta "Pendiente de código"', async () => {
    await render(<StatusBadge status="PENDING_OTP" />);
    const label = screen.getByText('Pendiente de código');
    expect(label).toHaveStyle({ color: theme.colors.status.warning.fg });
    expect(screen.getByTestId('status-badge')).toHaveStyle({
      backgroundColor: theme.colors.status.warning.bg,
      borderRadius: theme.radius.pill,
    });
  });
});

describe('InlineAlert', () => {
  test('DSG-11 un error se anuncia como alerta con el tono de error', async () => {
    await render(<InlineAlert tone="danger" message="No tienes saldo suficiente." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ backgroundColor: theme.colors.status.danger.bg });
    expect(alert).toHaveProp('accessibilityLiveRegion', 'assertive');
    expect(screen.getByText('No tienes saldo suficiente.')).toHaveStyle({
      color: theme.colors.status.danger.fg,
    });
  });

  test('DSG-15 la alerta de error lleva su icono, decorativo', async () => {
    await render(<InlineAlert tone="danger" message="No tienes saldo suficiente." />);
    expect(screen.getByTestId('inline-alert-icon', { includeHiddenElements: true })).toBeTruthy();
  });

  test('DSG-11 un aviso informativo se anuncia sin interrumpir', async () => {
    await render(<InlineAlert tone="info" message="Te enviamos un código." />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('inline-alert')).toHaveProp('accessibilityLiveRegion', 'polite');
  });
});

describe('EmptyState', () => {
  test('DSG-11 muestra título, ayuda y una acción', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        title="Sin movimientos"
        description="Aquí verás tus depósitos y transferencias."
        action={{ label: 'Actualizar', onPress }}
      />,
    );
    expect(screen.getByText('Sin movimientos')).toBeOnTheScreen();
    expect(screen.getByText('Aquí verás tus depósitos y transferencias.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeOnTheScreen();
  });
});

describe('Skeleton', () => {
  test('DSG-06 está oculto para lectores de pantalla y pulsa con movimiento normal', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(<Skeleton variant="card" />);
    await act(async () => {});
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(loop).toHaveBeenCalled();
  });

  test('DSG-06 con movimiento reducido no se anima', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const loop = jest.spyOn(Animated, 'loop');
    await render(<Skeleton variant="line" />);
    await act(async () => {});
    expect(loop).not.toHaveBeenCalled();
  });
});

describe('DailyLimitMeter', () => {
  test('DSG-11 muestra lo que queda hoy y expone el avance como valor accesible', async () => {
    await render(
      <DailyLimitMeter
        dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }}
      />,
    );
    expect(screen.getByText('Te quedan $31,500.00 hoy')).toHaveStyle({
      color: theme.colors.text.secondary,
    });
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAccessibilityValue({ min: 0, max: 100, now: 37 });
    expect(screen.getByTestId('daily-limit-fill')).toHaveStyle({
      width: '37%',
      backgroundColor: theme.colors.accent.brand,
    });
  });
});

describe('Receipt', () => {
  const transfer: Transfer = {
    id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    status: 'COMPLETED',
    kind: 'THIRD_PARTY',
    fromAccountId: 'a1',
    destination: {
      type: 'BENEFICIARY',
      accountId: null,
      beneficiaryId: 'b1',
      displayName: 'Luis',
      clabeLast4: '5678',
    },
    amount: '1500.00',
    concept: 'Renta',
    reference: '1234567',
    requiresOtp: false,
    otp: null,
    rejectionReason: null,
    failureReason: null,
    createdAt: '2026-10-13T16:41:00Z',
    completedAt: '2026-10-13T16:42:00Z',
  };

  test('DSG-11 muestra estado, monto, origen, destino, concepto, referencia, fecha y folio', async () => {
    await render(<Receipt transfer={transfer} fromAccountName="Principal" />);
    expect(screen.getByText('Completada')).toBeOnTheScreen();
    expect(screen.getByText('$1,500.00')).toBeOnTheScreen();
    expect(screen.getByText('Principal')).toBeOnTheScreen();
    expect(screen.getByText('Luis · •••• 5678')).toBeOnTheScreen();
    expect(screen.getByText('Renta')).toBeOnTheScreen();
    expect(screen.getByText('1234567')).toBeOnTheScreen();
    expect(screen.getByText('13 oct 2026, 10:42')).toBeOnTheScreen();
    expect(screen.getByText(transfer.id)).toBeOnTheScreen();
  });

  test('MOB-13 con la CLABE de origen, el origen lleva su terminación como en la revisión', async () => {
    await render(
      <Receipt
        transfer={transfer}
        fromAccountName="Principal"
        fromAccountClabe="646180157000009719"
      />,
    );
    expect(screen.getByText('Principal · •••• 9719')).toBeOnTheScreen();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  test.each([
    ['COMPLETED', 'success', 'success'],
    ['FAILED', 'neutral', 'error'],
    ['REJECTED', 'neutral', 'error'],
    ['PENDING_OTP', 'neutral', 'warning'],
    ['EXPIRED', 'neutral', 'info'],
  ] as const)(
    'MOB-13 el icono del comprobante sigue el tono del estado %s (avatar %s, icono %s)',
    async (status, tone, icon) => {
      // El avatar renderizado debe ser idéntico al de la tabla: mismo tono e icono.
      await render(<Receipt transfer={{ ...transfer, status }} />);
      const actual = JSON.stringify(
        (screen.toJSON() as ReactTestRendererJSON).children
          ?.filter((child): child is ReactTestRendererJSON => typeof child !== 'string')
          .find((child) => child.props.testID === 'receipt-avatar'),
      );
      await screen.unmount();
      await render(
        <View testID="receipt-avatar">
          <Avatar size="lg" tone={tone} icon={icon} />
        </View>,
      );
      expect(actual).toBe(JSON.stringify(screen.toJSON()));
    },
  );
});
