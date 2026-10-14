import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Lectura de los PDF que genera la API, con unpdf (build de PDF.js sin worker ni canvas). Cada
 * llamada recibe una copia de los bytes: PDF.js transfiere el buffer que se le entrega.
 */

/** Texto de cada página; los textos de un mismo renglón visual quedan en la misma línea. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const { text } = await extractText(new Uint8Array(bytes));
  return text;
}

/** Texto plano de una página en líneas, sin líneas vacías. */
export function linesOf(page: string): string[] {
  return page
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export interface PdfItem {
  /** Página, desde 1. */
  readonly page: number;
  readonly text: string;
  /** Esquina inferior izquierda, en puntos desde la esquina inferior izquierda de la página. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Cada fragmento de texto con su posición, para comprobar en qué columna quedó. */
export async function pdfItems(bytes: Uint8Array): Promise<PdfItem[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const items: PdfItem[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      items.push({
        page: number,
        text: item.str,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
        width: item.width,
      });
    }
  }
  await pdf.loadingTask.destroy();
  return items;
}
