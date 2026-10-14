import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MovementRecord } from '../../../src/modules/movements/application/ports.js';
import type { StatementHeader } from '../../../src/modules/statements/application/ports.js';
import { StatementPeriod } from '../../../src/modules/statements/domain/statement-period.js';
import {
  StatementSummary,
  type ReconciledSummary,
} from '../../../src/modules/statements/domain/statement-summary.js';
import {
  PdfKitStatementRenderer,
  STATEMENT_COLUMNS,
  WORK_SANS,
} from '../../../src/modules/statements/infrastructure/pdfkit-statement-renderer.js';
import type { MovementType } from '../../../src/modules/transfers/domain/ledger.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { linesOf, pdfItems, pdfPages } from '../../helpers/pdf.js';

const renderer = new PdfKitStatementRenderer();
// 14 de octubre de 2026, 12:00 en la Ciudad de México.
const NOW = '2026-10-14T18:00:00.000Z';
const ROW_START = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4} [0-9]{2}:[0-9]{2} /;

function header(period = '2026-09'): StatementHeader {
  return {
    account: {
      id: '7b1f0a52-3c1e-4d8e-9a55-2f7d1c3b9e10',
      name: 'Principal',
      clabe: '999180000000000015',
      holderName: 'Ana Gómez Cruz',
    },
    period: StatementPeriod.parse(period, new FakeClock(NOW)),
  };
}

let nextId = 1;
function row(
  type: MovementType,
  amountCents: bigint,
  balanceAfterCents: bigint,
  occurredAt: string,
  extra: Partial<MovementRecord> = {},
): MovementRecord {
  nextId += 1;
  return {
    id: String(nextId),
    type,
    amountCents,
    balanceAfterCents,
    occurredAt,
    transferId: '0b6c2d8e-1f3a-4c5b-8d7e-9f0a1b2c3d4e',
    concept: 'Pago',
    reference: 1,
    counterparty: type === 'DEPOSIT' ? null : { name: 'Luis', clabeLast4: '0031' },
    ...extra,
  };
}

/** Renderiza como lo hace el caso de uso: tandas al documento y el resumen al final. */
async function render(
  rows: readonly MovementRecord[],
  openingCents: bigint,
  options: { period?: string; batch?: number } = {},
): Promise<{ bytes: Uint8Array; summary: ReconciledSummary }> {
  const document = renderer.begin(header(options.period));
  const summary = StatementSummary.open(openingCents);
  const size = options.batch ?? 1_000;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    for (const entry of batch) summary.add(entry);
    document.addRows(batch);
  }
  const closed = summary.close();
  return { bytes: await document.finish(closed), summary: closed };
}

function tableRows(pages: readonly string[]): string[] {
  return pages.flatMap((page) => linesOf(page).filter((line) => ROW_START.test(line)));
}

const september = [
  row('TRANSFER_IN', 50_000n, 150_000n, '2026-09-05T16:00:00.000000Z', {
    concept: 'Renta de septiembre',
    reference: 1234567,
  }),
  row('TRANSFER_OUT', -15_000n, 135_000n, '2026-09-20T01:15:00.000000Z', {
    concept: 'Cena',
    reference: 42,
  }),
];

describe('HIS-12 documento PDF del estado de cuenta', () => {
  it('HIS-12 es un PDF con la marca, el titular, la cuenta, la CLABE completa, el periodo y la hora de generación', async () => {
    const { bytes } = await render(september, 100_000n);
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    const [first = ''] = await pdfPages(bytes);
    const lines = linesOf(first);
    expect(lines[0]).toContain('TreoWallet');
    expect(first).toContain('Estado de cuenta');
    expect(lines).toContain('Titular Ana Gómez Cruz');
    expect(lines).toContain('Cuenta Principal');
    expect(lines).toContain('CLABE 999180000000000015');
    expect(lines).toContain('Periodo 1 al 30 de septiembre de 2026');
    expect(lines).toContain('Generado el 14/10/2026 12:00 (hora de la Ciudad de México)');
  });

  it('HIS-12 el mes en curso se identifica como parcial y llega al día de generación', async () => {
    const { bytes } = await render([], 0n, { period: '2026-10' });
    const [first = ''] = await pdfPages(bytes);
    expect(linesOf(first)).toContain('Periodo 1 al 14 de octubre de 2026 (parcial)');
  });

  it('HIS-12 cerró agosto con 1000.00, recibió 500.00 y envió 150.00: resumen en es-MX y 2 renglones en orden', async () => {
    const { bytes } = await render(september, 100_000n);
    const pages = await pdfPages(bytes);
    const lines = linesOf(pages[0] ?? '');
    expect(lines).toContain('Saldo inicial $1,000.00');
    expect(lines).toContain('Abonos $500.00');
    expect(lines).toContain('Cargos $150.00');
    expect(lines).toContain('Saldo final $1,350.00');
    expect(tableRows(pages)).toEqual([
      '05/09/2026 10:00 Transferencia recibida Renta de septiembre $500.00 $1,500.00',
      '19/09/2026 19:15 Transferencia enviada Cena $150.00 $1,350.00',
    ]);
  });

  it('HIS-12 un abono de 1250.5 se muestra "$1,250.50" en la columna de abono con la de cargo vacía', async () => {
    const deposit = row('DEPOSIT', 125_050n, 125_050n, '2026-09-15T18:00:00.000000Z');
    const { bytes } = await render([deposit], 0n);
    const items = await pdfItems(bytes);
    const date = items.find((item) => item.text.startsWith('15/09/2026 12:00'));
    if (!date) throw new Error('No está el renglón del depósito');
    const sameRow = items.filter((item) => item.page === 1 && Math.abs(item.y - date.y) < 0.5);
    const inColumn = (key: keyof typeof STATEMENT_COLUMNS) => {
      const column = STATEMENT_COLUMNS[key];
      return sameRow
        .filter(
          (item) =>
            item.x >= column.x - 0.5 && item.x + item.width <= column.x + column.width + 0.5,
        )
        .map((item) => item.text);
    };
    expect(inColumn('credit')).toEqual(['$1,250.50']);
    expect(inColumn('debit')).toEqual([]);
    expect(inColumn('balance')).toEqual(['$1,250.50']);
  });

  it('HIS-12 un cargo va sin signo en la columna de cargo, con la de abono vacía', async () => {
    const out = row('OWN_TRANSFER_OUT', -15_000n, 85_000n, '2026-09-15T18:00:00.000000Z');
    const { bytes } = await render([out], 100_000n);
    const items = await pdfItems(bytes);
    const date = items.find((item) => item.text.startsWith('15/09/2026 12:00'));
    if (!date) throw new Error('No está el renglón');
    const sameRow = items.filter((item) => item.page === 1 && Math.abs(item.y - date.y) < 0.5);
    const debit = STATEMENT_COLUMNS.debit;
    const credit = STATEMENT_COLUMNS.credit;
    expect(
      sameRow
        .filter((item) => item.x >= debit.x && item.x < debit.x + debit.width)
        .map((i) => i.text),
    ).toEqual(['$150.00']);
    expect(
      sameRow.filter((item) => item.x >= credit.x && item.x < credit.x + credit.width),
    ).toEqual([]);
    expect(sameRow.map((item) => item.text).join(' ')).not.toContain('-$');
  });

  it('HIS-12 cada renglón lleva fecha y hora de CDMX, etiqueta del paquete de diseño, concepto, contraparte y referencia', async () => {
    const rows = [
      row('DEPOSIT', 100_000n, 100_000n, '2026-09-01T06:00:00.000000Z', { concept: 'Nómina' }),
      row('OWN_TRANSFER_IN', 1_000n, 101_000n, '2026-09-10T18:00:00.000000Z', {
        counterparty: { name: 'Ahorro', clabeLast4: '0023' },
      }),
      row('OWN_TRANSFER_OUT', -1_000n, 100_000n, '2026-09-11T18:00:00.000000Z', {
        counterparty: { name: 'Ahorro', clabeLast4: '0023' },
      }),
      row('TRANSFER_IN', 1_000n, 101_000n, '2026-09-12T18:00:00.000000Z'),
      // 23:30 del 30 de septiembre en CDMX = 05:30 UTC del 1 de octubre.
      row('TRANSFER_OUT', -1_000n, 100_000n, '2026-10-01T05:30:00.000000Z', {
        reference: 1234567,
      }),
    ];
    const { bytes } = await render(rows, 0n);
    const pages = await pdfPages(bytes);
    expect(tableRows(pages).map((line) => line.slice(0, 16))).toEqual([
      '01/09/2026 00:00',
      '10/09/2026 12:00',
      '11/09/2026 12:00',
      '12/09/2026 12:00',
      '30/09/2026 23:30',
    ]);
    const text = pages.join('\n');
    for (const label of [
      'Depósito',
      'Traspaso recibido',
      'Traspaso enviado',
      'Transferencia recibida',
      'Transferencia enviada',
    ]) {
      expect(text).toContain(label);
    }
    const lines = linesOf(pages[0] ?? '');
    expect(lines).toContain('Referencia 1');
    expect(lines).toContain('Ahorro •••• 0023 · Referencia 1');
    expect(lines).toContain('Luis •••• 0031 · Referencia 1234567');
  });

  it('HIS-12 un mes sin movimientos muestra el resumen y "Sin movimientos en el periodo"', async () => {
    const { bytes } = await render([], 25_000n);
    const pages = await pdfPages(bytes);
    expect(pages).toHaveLength(1);
    const lines = linesOf(pages[0] ?? '');
    expect(lines).toContain('Saldo inicial $250.00');
    expect(lines).toContain('Abonos $0.00');
    expect(lines).toContain('Cargos $0.00');
    expect(lines).toContain('Saldo final $250.00');
    expect(lines).toContain('Sin movimientos en el periodo');
    expect(lines).toContain('Fecha Tipo Descripción Cargo Abono Saldo');
    expect(tableRows(pages)).toEqual([]);
  });

  it('HIS-12 con muchos renglones cada página repite los encabezados, "Página X de Y" y la leyenda', async () => {
    const rows: MovementRecord[] = [];
    for (let i = 0; i < 150; i++) {
      const at = new Date(Date.UTC(2026, 8, 2, 12, 0, i)).toISOString().replace('Z', '000Z');
      rows.push(row('TRANSFER_IN', 100n, 100n * BigInt(i + 1), at));
    }
    const { bytes } = await render(rows, 0n, { batch: 7 });
    const pages = await pdfPages(bytes);
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((page, index) => {
      const lines = linesOf(page);
      expect(lines).toContain('Fecha Tipo Descripción Cargo Abono Saldo');
      expect(lines).toContain(`Página ${index + 1} de ${pages.length}`);
      expect(lines).toContain('Documento informativo; no es un comprobante fiscal.');
    });
    expect(linesOf(pages.at(-1) ?? '')).toContain(`Página ${pages.length} de ${pages.length}`);
    expect(tableRows(pages)).toHaveLength(150);
  });

  it('HIS-12 un concepto o una contraparte que no caben se truncan con "…" sin cambiar la altura del renglón', async () => {
    const long = 'Pago de la renta del departamento de la colonia Roma Norte';
    const rows = [
      row('TRANSFER_OUT', -100n, 900n, '2026-09-10T18:00:00.000000Z', {
        concept: long.slice(0, 40),
        counterparty: {
          name: 'María Fernanda de los Ángeles Villaseñor Castañeda Montiel',
          clabeLast4: '0031',
        },
      }),
      row('TRANSFER_OUT', -100n, 800n, '2026-09-11T18:00:00.000000Z'),
      row('TRANSFER_OUT', -100n, 700n, '2026-09-12T18:00:00.000000Z'),
    ];
    const { bytes } = await render(rows, 1_000n);
    const items = await pdfItems(bytes);
    const dates = items.filter((item) => /^1[0-2]\/09\/2026/.test(item.text));
    expect(dates).toHaveLength(3);
    const [a, b, c] = dates.map((item) => item.y) as [number, number, number];
    expect(a - b).toBeCloseTo(b - c, 3);
    const text = (await pdfPages(bytes)).join('\n');
    expect(text).toContain('…');
    expect(text).not.toContain('Montiel');
  });

  it('HIS-12 incrusta Work Sans (Regular y SemiBold) del paquete de fuentes, que trae su licencia OFL', async () => {
    const { bytes } = await render(september, 100_000n);
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw).toMatch(/\/BaseFont \/[A-Z]{6}\+WorkSans-Regular/);
    expect(raw).toMatch(/\/BaseFont \/[A-Z]{6}\+WorkSans-SemiBold/);
    expect(raw).toContain('/FontFile2');
    expect(raw).not.toContain('/Helvetica');
    expect(WORK_SANS.regular).toMatch(
      /@fontsource\/work-sans\/files\/work-sans-latin-400-normal\.woff$/,
    );
    expect(WORK_SANS.semibold).toMatch(
      /@fontsource\/work-sans\/files\/work-sans-latin-600-normal\.woff$/,
    );
    expect(readFileSync(WORK_SANS.license, 'utf8')).toContain('SIL Open Font License, Version 1.1');
  });
});
