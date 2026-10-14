import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(WEB, path));
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** Archivos que nombra cada `url(...)` de una hoja, resueltos desde la carpeta de la hoja. */
function fontUrls(cssPath: string): string[] {
  const css = read(cssPath).toString('utf8');
  return [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((match) =>
    resolve(dirname(join(WEB, cssPath)), match[1] ?? ''),
  );
}

describe('Work Sans versionada', () => {
  it('DSG-05 la app sirve con next/font/local el archivo de Work Sans del repositorio, no uno descargado', () => {
    const layout = read('app/layout.tsx').toString('utf8');
    expect(layout).toContain("from 'next/font/local'");
    expect(layout).not.toContain('next/font/google');
    expect(layout).toContain("src: './fonts/WorkSans-latin.woff2'");
    // WOFF2 (firma "wOF2") y su licencia junto al archivo (OFL 1.1).
    expect(read('app/fonts/WorkSans-latin.woff2').subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(read('app/fonts/OFL.txt').toString('utf8')).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
    );
  });

  it('WEB-25 el lienzo de design-sync usa el mismo archivo de Work Sans que la app, sin Google Fonts', () => {
    const appFont = sha256(read('app/fonts/WorkSans-latin.woff2'));
    const canvasFonts = fontUrls('.design-sync/fonts.css');
    expect(canvasFonts.length).toBeGreaterThan(0);
    for (const file of canvasFonts) expect(sha256(readFileSync(file))).toBe(appFont);
    expect(read('.design-sync/tailwind.css').toString('utf8')).not.toContain(
      'fonts.googleapis.com',
    );
  });
});
