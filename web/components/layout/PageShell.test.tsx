import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAIN_CONTENT_ID, PageShell, SkipLink } from './PageShell';

describe('SkipLink', () => {
  it('WEB-23 "Saltar al contenido" apunta al contenido principal y se muestra al recibir foco', () => {
    const html = renderToStaticMarkup(<SkipLink />);
    expect(html).toContain(`href="#${MAIN_CONTENT_ID}"`);
    expect(html).toContain('Saltar al contenido');
    expect(html).toMatch(/class="[^"]*sr-only[^"]*focus:not-sr-only/);
  });
});

describe('PageShell', () => {
  it('WEB-23 DSG-02 tiene un encabezado con el Wordmark y un main enfocable como destino del salto', () => {
    const html = renderToStaticMarkup(
      <PageShell actions={<button type="button">Cerrar sesión</button>}>
        <p>Contenido</p>
      </PageShell>,
    );
    expect(html).toMatch(
      /<header[^>]*>[\s\S]*Treo[\s\S]*Wallet[\s\S]*Cerrar sesión[\s\S]*<\/header>/,
    );
    expect(html).toMatch(new RegExp(`<main[^>]*id="${MAIN_CONTENT_ID}"[^>]*tabindex="-1"`));
    expect(html).toMatch(/<main[^>]*>[\s\S]*Contenido[\s\S]*<\/main>/);
  });
});
