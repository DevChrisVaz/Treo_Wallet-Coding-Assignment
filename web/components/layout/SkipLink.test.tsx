import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';

describe('SkipLink', () => {
  it('WEB-23 "Saltar al contenido" apunta al contenido principal y se muestra al recibir foco', () => {
    const html = renderToStaticMarkup(<SkipLink />);
    expect(html).toContain(`href="#${MAIN_CONTENT_ID}"`);
    expect(html).toContain('Saltar al contenido');
    expect(html).toMatch(/class="[^"]*sr-only[^"]*focus:not-sr-only/);
  });
});
