import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { formatMXN } from '@devchrisvaz/wallet-contract';
import { movementType, theme } from '@devchrisvaz/wallet-design-tokens';
import PDFDocument from 'pdfkit';
import { BUSINESS_TIME_ZONE } from '../../../shared/business-day.js';
import { Money } from '../../../shared/money.js';
import type { MovementRecord } from '../../movements/application/ports.js';
import type { MovementType } from '../../transfers/domain/ledger.js';
import type {
  StatementDocument,
  StatementHeader,
  StatementRenderer,
} from '../application/ports.js';
import type { ReconciledSummary } from '../domain/statement-summary.js';
import { sfntFromWoff } from './woff.js';

const require = createRequire(import.meta.url);

/**
 * Work Sans de `@fontsource/work-sans` (SIL OFL 1.1; su `LICENSE` viaja con el paquete). Se usa el
 * WOFF del subconjunto latino, que cubre español y la puntuación general ("•", "…"): fontkit
 * falla al recortar los glifos compuestos del WOFF2 de este paquete. El renderizador lo convierte
 * una vez a TrueType (`sfntFromWoff`).
 */
export const WORK_SANS = {
  regular: require.resolve('@fontsource/work-sans/files/work-sans-latin-400-normal.woff'),
  semibold: require.resolve('@fontsource/work-sans/files/work-sans-latin-600-normal.woff'),
  license: require.resolve('@fontsource/work-sans/LICENSE'),
} as const;

/** Etiquetas del paquete de diseño (DSG-10): falla al compilar si falta un tipo. */
const TYPE_LABELS = movementType satisfies Record<MovementType, { readonly label: string }>;
const COLORS = theme.colors;

// Carta vertical (612 × 792 pt) con márgenes de 36 pt (D7).
const MARGIN = 36;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = 540;
/** Límite inferior de la tabla; debajo van la leyenda y el número de página. */
const TABLE_BOTTOM = 742;
const HEADER_ROW_HEIGHT = 16;
/** Altura fija: la paginación es predecible y nada se desborda. */
const ROW_HEIGHT = 22;
const SUMMARY_ROW_HEIGHT = 15;

/** Columnas de la tabla, con su posición absoluta en la página. */
export const STATEMENT_COLUMNS = {
  date: { x: 36, width: 68, title: 'Fecha', align: 'left' },
  type: { x: 108, width: 84, title: 'Tipo', align: 'left' },
  description: { x: 196, width: 164, title: 'Descripción', align: 'left' },
  debit: { x: 364, width: 68, title: 'Cargo', align: 'right' },
  credit: { x: 436, width: 68, title: 'Abono', align: 'right' },
  balance: { x: 508, width: 68, title: 'Saldo', align: 'right' },
} as const;

type Column = (typeof STATEMENT_COLUMNS)[keyof typeof STATEMENT_COLUMNS];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** `dd/mm/aaaa hh:mm` en la Ciudad de México, armado por partes para no depender del locale. */
function mexicoCityDateTime(instant: Date): string {
  const parts = Object.fromEntries(
    wallClock.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Monto sin signo en es-MX ("$1,250.50"), desde centavos y sin floats. */
function mxn(cents: bigint): string {
  return formatMXN(Money.fromCents(cents < 0n ? -cents : cents).toDecimalString());
}

/** "1 al 30 de septiembre de 2026", o "1 al 14 de octubre de 2026 (parcial)". */
function periodText({ period }: StatementHeader): string {
  const [year, month] = period.value.split('-').map(Number) as [number, number];
  const first = Number(period.firstDay.slice(8));
  const last = Number(period.lastDay.slice(8));
  const text = `${first} al ${last} de ${MONTHS[month - 1]} de ${year}`;
  return period.partial ? `${text} (parcial)` : text;
}

/** Segunda línea del renglón: contraparte con los últimos 4 dígitos y referencia. */
function detailParts(record: MovementRecord): { name: string | null; suffix: string } {
  // Sin referencia (HIS-12) no se imprime esa parte: ni "null" ni "Referencia 0".
  const reference = record.reference === null ? null : `Referencia ${record.reference}`;
  if (!record.counterparty) return { name: null, suffix: reference ?? '' };
  const clabe = record.counterparty.clabeLast4 ? ` •••• ${record.counterparty.clabeLast4}` : '';
  return {
    name: record.counterparty.name,
    suffix: `${clabe}${reference ? ` · ${reference}` : ''}`,
  };
}

/** Las dos fuentes ya convertidas a TrueType. */
interface Fonts {
  readonly regular: Buffer;
  readonly semibold: Buffer;
}

class PdfKitStatementDocument implements StatementDocument {
  private readonly doc: PDFKit.PDFDocument;
  private readonly bytes: Promise<Buffer>;
  private readonly summaryTop: number;
  private y: number;
  private rows = 0;

  constructor(
    private readonly header: StatementHeader,
    fonts: Fonts,
  ) {
    // Sin `font`: PDFKit crea Helvetica por defecto, pero solo escribe las fuentes que se usan.
    this.doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      bufferPages: true,
      lang: 'es-MX',
      info: {
        Title: `Estado de cuenta ${header.period.value}`,
        Author: 'TreoWallet',
        // La fecha del documento es la de generación: el mismo contenido produce los mismos bytes.
        CreationDate: header.period.generatedAt,
      },
    });
    this.doc.registerFont('Regular', fonts.regular);
    this.doc.registerFont('SemiBold', fonts.semibold);
    const chunks: Buffer[] = [];
    this.bytes = new Promise((resolve, reject) => {
      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
    });
    this.summaryTop = this.drawFirstPage();
    // El resumen se escribe al final (sus cifras se conocen al cerrar), en este espacio reservado.
    this.y = this.summaryTop + 4 * SUMMARY_ROW_HEIGHT + 24;
    this.drawTableHeader();
  }

  addRows(rows: readonly MovementRecord[]): void {
    for (const record of rows) {
      if (this.y + ROW_HEIGHT > TABLE_BOTTOM) {
        this.doc.addPage();
        this.y = MARGIN;
        this.drawTableHeader();
      }
      this.drawRow(record);
      this.y += ROW_HEIGHT;
      this.rows += 1;
    }
  }

  async finish(summary: ReconciledSummary): Promise<Uint8Array> {
    if (this.rows === 0) {
      this.doc
        .font('Regular')
        .fontSize(8.5)
        .fillColor(COLORS.text.secondary)
        .text('Sin movimientos en el periodo', MARGIN, this.y + 8, {
          width: CONTENT_WIDTH,
          lineBreak: false,
        });
    }
    this.doc.switchToPage(0);
    this.drawSummary(summary);
    this.drawFooters();
    this.doc.end();
    return this.bytes;
  }

  /** Marca, título y datos de la cuenta; devuelve dónde empieza el recuadro del resumen. */
  private drawFirstPage(): number {
    const { doc, header } = this;
    doc
      .font('SemiBold')
      .fontSize(20)
      .fillColor(COLORS.action.primary)
      .text('TreoWallet', MARGIN, MARGIN, { lineBreak: false });
    doc
      .fontSize(13)
      .fillColor(COLORS.text.primary)
      .text('Estado de cuenta', MARGIN, MARGIN + 30, { lineBreak: false });
    const data: [string, string][] = [
      ['Titular', header.account.holderName],
      ['Cuenta', header.account.name],
      ['CLABE', header.account.clabe],
      ['Periodo', periodText(header)],
    ];
    let y = MARGIN + 56;
    doc.font('Regular').fontSize(8.5);
    for (const [label, value] of data) {
      doc.fillColor(COLORS.text.secondary).text(label, MARGIN, y, { lineBreak: false });
      doc
        .fillColor(COLORS.text.primary)
        .text(this.fit(value, CONTENT_WIDTH - 64), MARGIN + 64, y, { lineBreak: false });
      y += 13;
    }
    doc
      .fillColor(COLORS.text.secondary)
      .text(
        `Generado el ${mexicoCityDateTime(header.period.generatedAt)} (hora de la Ciudad de México)`,
        MARGIN,
        y + 2,
        { lineBreak: false },
      );
    return y + 24;
  }

  private drawSummary(summary: ReconciledSummary): void {
    const { doc } = this;
    const width = 260;
    const top = this.summaryTop;
    doc
      .rect(MARGIN, top, width, 4 * SUMMARY_ROW_HEIGHT + 10)
      .fillAndStroke(COLORS.surface.subtle, COLORS.border.default);
    const lines: [string, bigint, boolean][] = [
      ['Saldo inicial', summary.openingCents, false],
      ['Abonos', summary.creditsCents, false],
      ['Cargos', summary.debitsCents, false],
      ['Saldo final', summary.closingCents, true],
    ];
    let y = top + 7;
    for (const [label, cents, strong] of lines) {
      doc
        .font(strong ? 'SemiBold' : 'Regular')
        .fontSize(9)
        .fillColor(COLORS.text.primary)
        .text(label, MARGIN + 10, y, { lineBreak: false })
        .text(mxn(cents), MARGIN + 10, y, { width: width - 20, align: 'right', lineBreak: false });
      y += SUMMARY_ROW_HEIGHT;
    }
  }

  private drawTableHeader(): void {
    const { doc } = this;
    doc.rect(MARGIN, this.y, CONTENT_WIDTH, HEADER_ROW_HEIGHT).fill(COLORS.surface.brand);
    doc.font('SemiBold').fontSize(7.5).fillColor(COLORS.text.primary);
    for (const column of Object.values(STATEMENT_COLUMNS)) {
      this.cell(column.title, column, this.y + 4);
    }
    this.y += HEADER_ROW_HEIGHT;
  }

  private drawRow(record: MovementRecord): void {
    const { doc } = this;
    const first = this.y + 4;
    doc.font('Regular').fontSize(7.5).fillColor(COLORS.text.primary);
    this.cell(mexicoCityDateTime(new Date(record.occurredAt)), STATEMENT_COLUMNS.date, first);
    this.cell(TYPE_LABELS[record.type].label, STATEMENT_COLUMNS.type, first);
    this.cell(record.concept, STATEMENT_COLUMNS.description, first);
    const amountColumn =
      record.amountCents < 0n ? STATEMENT_COLUMNS.debit : STATEMENT_COLUMNS.credit;
    this.cell(mxn(record.amountCents), amountColumn, first);
    this.cell(mxn(record.balanceAfterCents), STATEMENT_COLUMNS.balance, first);

    // Segunda línea, más pequeña: se recorta el nombre, nunca los dígitos ni la referencia.
    doc.fontSize(6.5).fillColor(COLORS.text.secondary);
    const { name, suffix } = detailParts(record);
    const width = STATEMENT_COLUMNS.description.width;
    const detail =
      name === null ? suffix : this.fit(name, width - doc.widthOfString(suffix)) + suffix;
    this.cell(detail, STATEMENT_COLUMNS.description, this.y + 13);

    doc
      .moveTo(MARGIN, this.y + ROW_HEIGHT)
      .lineTo(MARGIN + CONTENT_WIDTH, this.y + ROW_HEIGHT)
      .lineWidth(0.5)
      .stroke(COLORS.border.default);
  }

  /** Texto de una celda en una sola línea, recortado con "…" si no cabe. */
  private cell(text: string, column: Column, y: number): void {
    this.doc.text(this.fit(text, column.width), column.x, y, {
      width: column.width,
      align: column.align,
      lineBreak: false,
    });
  }

  /** El texto tal cual si cabe en `width` con la fuente actual; si no, el prefijo más largo + "…". */
  private fit(text: string, width: number): string {
    if (this.doc.widthOfString(text) <= width) return text;
    let low = 0;
    let high = text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.doc.widthOfString(`${text.slice(0, middle).trimEnd()}…`) <= width) low = middle;
      else high = middle - 1;
    }
    return `${text.slice(0, low).trimEnd()}…`;
  }

  /** "Página X de Y" y la leyenda en todas las páginas, ya con el total conocido (D7). */
  private drawFooters(): void {
    const { doc } = this;
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      // El pie va dentro del margen inferior: sin esto, PDFKit agregaría una página.
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Regular')
        .fontSize(7)
        .fillColor(COLORS.text.secondary)
        .text('Documento informativo; no es un comprobante fiscal.', MARGIN, PAGE_HEIGHT - 32, {
          lineBreak: false,
        })
        .text(`Página ${index + 1} de ${range.count}`, MARGIN, PAGE_HEIGHT - 22, {
          width: CONTENT_WIDTH,
          align: 'right',
          lineBreak: false,
        });
      doc.page.margins.bottom = bottom;
    }
  }
}

/**
 * Estado de cuenta en PDF con PDFKit (D1, D6, D7): carta vertical, Work Sans incrustada, marca en
 * el color de acción del sistema de diseño, etiquetas de tipo del paquete de diseño y montos con
 * `formatMXN`. El documento se arma en memoria con `bufferPages` para escribir al final el resumen
 * (en el espacio reservado de la primera página) y "Página X de Y" en cada página.
 */
export class PdfKitStatementRenderer implements StatementRenderer {
  private readonly fonts: Fonts = {
    regular: sfntFromWoff(readFileSync(WORK_SANS.regular)),
    semibold: sfntFromWoff(readFileSync(WORK_SANS.semibold)),
  };

  begin(header: StatementHeader): StatementDocument {
    return new PdfKitStatementDocument(header, this.fonts);
  }
}
