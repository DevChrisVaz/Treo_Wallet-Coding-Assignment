import { inflateSync } from 'node:zlib';

const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'
const WOFF_HEADER_SIZE = 44;
const WOFF_ENTRY_SIZE = 20;
const SFNT_HEADER_SIZE = 12;
const SFNT_ENTRY_SIZE = 16;

const padded = (length: number) => (length + 3) & ~3;

/**
 * Convierte una fuente WOFF 1.0 a la fuente TrueType/OpenType (sfnt) que lleva dentro: copia el
 * directorio de tablas y descomprime con zlib las que vienen comprimidas.
 *
 * PDFKit lee WOFF, pero fontkit descomprime la tabla cada vez que la consulta: con 5,000 renglones
 * eso era casi todo el tiempo de generación. Descomprimirla una vez al arrancar la API lo evita y
 * conserva las fuentes del paquete npm, con su licencia, sin versionar binarios.
 */
export function sfntFromWoff(woff: Buffer): Buffer {
  if (woff.length < WOFF_HEADER_SIZE || woff.readUInt32BE(0) !== WOFF_SIGNATURE) {
    throw new Error('La fuente no es WOFF 1.0');
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = Array.from({ length: numTables }, (_, index) => {
    const entry = WOFF_HEADER_SIZE + index * WOFF_ENTRY_SIZE;
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const stored = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(stored) : stored;
    if (data.length !== origLength) throw new Error('Tabla WOFF con longitud inesperada');
    return {
      tag: woff.readUInt32BE(entry),
      checksum: woff.readUInt32BE(entry + 16),
      data,
    };
  });

  // Encabezado sfnt: searchRange, entrySelector y rangeShift como los define el formato.
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  let offset = SFNT_HEADER_SIZE + numTables * SFNT_ENTRY_SIZE;
  const size = tables.reduce((total, table) => total + padded(table.data.length), offset);
  const sfnt = Buffer.alloc(size);
  sfnt.writeUInt32BE(flavor, 0);
  sfnt.writeUInt16BE(numTables, 4);
  sfnt.writeUInt16BE(searchRange, 6);
  sfnt.writeUInt16BE(entrySelector, 8);
  sfnt.writeUInt16BE(numTables * 16 - searchRange, 10);
  tables.forEach((table, index) => {
    const record = SFNT_HEADER_SIZE + index * SFNT_ENTRY_SIZE;
    sfnt.writeUInt32BE(table.tag, record);
    sfnt.writeUInt32BE(table.checksum, record + 4);
    sfnt.writeUInt32BE(offset, record + 8);
    sfnt.writeUInt32BE(table.data.length, record + 12);
    table.data.copy(sfnt, offset);
    offset += padded(table.data.length);
  });
  return sfnt;
}
