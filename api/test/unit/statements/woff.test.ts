import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { WORK_SANS } from '../../../src/modules/statements/infrastructure/pdfkit-statement-renderer.js';
import { sfntFromWoff } from '../../../src/modules/statements/infrastructure/woff.js';

describe('HIS-12 Work Sans sin descomprimir en cada consulta', () => {
  it.each([
    ['Regular', WORK_SANS.regular],
    ['SemiBold', WORK_SANS.semibold],
  ])(
    'HIS-12 el WOFF %s se convierte a TrueType con todas sus tablas descomprimidas',
    (_name, path) => {
      const woff = readFileSync(path);
      const sfnt = sfntFromWoff(woff);
      const numTables = woff.readUInt16BE(12);
      expect(sfnt.readUInt32BE(0)).toBe(woff.readUInt32BE(4)); // mismo flavor (0x00010000)
      expect(sfnt.readUInt16BE(4)).toBe(numTables);
      // `totalSfntSize` del encabezado WOFF es el tamaño de la fuente original.
      expect(sfnt.length).toBe(woff.readUInt32BE(16));
      for (let index = 0; index < numTables; index++) {
        const entry = 44 + index * 20;
        const record = 12 + index * 16;
        expect(sfnt.readUInt32BE(record)).toBe(woff.readUInt32BE(entry)); // etiqueta
        expect(sfnt.readUInt32BE(record + 12)).toBe(woff.readUInt32BE(entry + 12)); // longitud
      }
    },
  );

  it('HIS-12 rechaza lo que no es WOFF 1.0, como el WOFF2 del mismo paquete', () => {
    const woff2 = readFileSync(
      createRequire(import.meta.url).resolve(
        '@fontsource/work-sans/files/work-sans-latin-400-normal.woff2',
      ),
    );
    expect(() => sfntFromWoff(woff2)).toThrow('La fuente no es WOFF 1.0');
  });
});
