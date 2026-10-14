import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { scheduledTransfersKey } from '@/lib/client/scheduled-transfers';
import { renderWithClient, testQueryClient } from '@/test/support/render';
import {
  ScheduledOutcome,
  ScheduleField,
  scheduledSendText,
  type ScheduleWhen,
} from './ScheduleField';

// 14 de octubre de 2026, 12:00 en la Ciudad de México.
const NOW = new Date('2026-10-14T18:00:00.000Z');

interface Values {
  when: ScheduleWhen;
  scheduledFor: string;
}

/** Formulario mínimo que registra el control como lo hará el de transferencia. */
function Harness({ error }: { error?: string }) {
  const { register, control } = useForm<Values>({
    defaultValues: { when: 'NOW', scheduledFor: '' },
  });
  const when = useWatch({ control, name: 'when' });
  return (
    <form>
      <ScheduleField
        when={when}
        whenField={register('when')}
        dateField={register('scheduledFor')}
        error={error}
      />
    </form>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ScheduleField', () => {
  it('WEB-33 ofrece "Cuándo" con "Ahora" elegido por defecto y sin fecha', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Cuándo' });
    expect(group).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Ahora' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Programar' })).not.toBeChecked();
    expect(screen.queryByLabelText('Fecha de envío')).not.toBeInTheDocument();
  });

  it('WEB-33 al elegir "Programar" el 14 de octubre de 2026 la fecha admite del 15 de octubre de 2026 al 12 de enero de 2027', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('radio', { name: 'Programar' }));

    const date = screen.getByLabelText('Fecha de envío');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveAttribute('min', '2026-10-15');
    expect(date).toHaveAttribute('max', '2027-01-12');
    expect(date).toHaveAccessibleDescription(
      'Entre el 15 de octubre de 2026 y el 12 de enero de 2027.',
    );
  });

  it('WEB-33 con `now` (lienzos con el reloj fijo) el rango sale de esa fecha y no del reloj', () => {
    vi.setSystemTime(new Date('2024-05-15T12:00:00.000Z'));
    const field = (name: string) => ({
      name,
      onChange: async () => undefined,
      onBlur: async () => undefined,
      ref: () => undefined,
    });
    render(
      <ScheduleField
        when="SCHEDULED"
        whenField={field('when')}
        dateField={field('scheduledFor')}
        now={new Date('2026-10-13T18:00:00.000Z')}
      />,
    );
    const date = screen.getByLabelText('Fecha de envío');
    expect(date).toHaveAttribute('min', '2026-10-14');
    expect(date).toHaveAttribute('max', '2027-01-11');
    expect(date).toHaveAccessibleDescription(
      'Entre el 14 de octubre de 2026 y el 11 de enero de 2027.',
    );
  });

  it('WEB-33 el rango sale del día de la Ciudad de México, no del día UTC', async () => {
    // 23:30 del 14 de octubre en la Ciudad de México; en UTC ya es el 15.
    vi.setSystemTime(new Date('2026-10-15T05:30:00.000Z'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('radio', { name: 'Programar' }));

    expect(screen.getByLabelText('Fecha de envío')).toHaveAttribute('min', '2026-10-15');
  });

  it('WEB-33 volver a "Ahora" oculta la fecha', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    await user.click(screen.getByRole('radio', { name: 'Ahora' }));
    expect(screen.queryByLabelText('Fecha de envío')).not.toBeInTheDocument();
  });

  it('WEB-33 WEB-23 muestra el error junto a la fecha y la marca como inválida', async () => {
    const user = userEvent.setup();
    render(<Harness error="Elige una fecha entre mañana y 90 días después de hoy" />);
    await user.click(screen.getByRole('radio', { name: 'Programar' }));

    const date = screen.getByLabelText('Fecha de envío');
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription(
      expect.stringContaining('Elige una fecha entre mañana y 90 días después de hoy'),
    );
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('scheduledSendText', () => {
  it('WEB-33 la revisión dice "Se enviará el" con la fecha en palabras', () => {
    expect(scheduledSendText('2026-10-20')).toBe('Se enviará el 20 de octubre de 2026');
  });
});

describe('ScheduledOutcome', () => {
  it('WEB-33 indica la fecha y enlaza a la página de programadas', () => {
    renderWithClient(<ScheduledOutcome scheduledFor="2026-10-20" />);
    expect(screen.getByText(/Se enviará el 20 de octubre de 2026\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'tus transferencias programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
  });

  it('WEB-33 DSG-17 es el aviso informativo del kit, con el tono de la insignia "Programada"', () => {
    const { container } = renderWithClient(<ScheduledOutcome scheduledFor="2026-10-20" />);
    const note = container.firstElementChild as HTMLElement;
    expect(note).toHaveClass('bg-info-soft', 'text-info');
    expect(note).toHaveTextContent(
      'Se enviará el 20 de octubre de 2026. Puedes cancelarla antes de esa fecha en tus transferencias programadas.',
    );
    expect(note.querySelector('svg.lucide-info')).not.toBeNull();
  });

  it('WEB-23 no tiene rol vivo: el foco del título del paso ya anuncia el resultado, sin duplicarlo', () => {
    renderWithClient(<ScheduledOutcome scheduledFor="2026-10-20" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('WEB-34 la lista de programadas en caché se vuelve a consultar', () => {
    const client = testQueryClient();
    client.setQueryData(scheduledTransfersKey, { items: [] });
    renderWithClient(<ScheduledOutcome scheduledFor="2026-10-20" />, { client });
    expect(client.getQueryState(scheduledTransfersKey)?.isInvalidated).toBe(true);
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderWithClient(<ScheduledOutcome scheduledFor="2026-10-20" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
