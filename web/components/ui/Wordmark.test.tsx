import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('DSG-02 muestra "TreoWallet" con "Treo" en tinta y "Wallet" en verde de acción', () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toMatch(/<span[^>]*class="[^"]*text-fg[^"]*"[^>]*>Treo<\/span>/);
    expect(html).toMatch(/<span[^>]*class="[^"]*text-action[^"]*"[^>]*>Wallet<\/span>/);
    expect(html).toContain('font-semibold');
  });

  it('DSG-11 la variante compacta usa un tamaño menor que la completa', () => {
    expect(renderToStaticMarkup(<Wordmark />)).toContain('text-h2');
    expect(renderToStaticMarkup(<Wordmark variant="compact" />)).toContain('text-h3');
  });

  it('WEB-25 en la superficie de marca el completo usa h1, como el Wordmark completo de la app móvil', () => {
    expect(renderToStaticMarkup(<Wordmark size="brand" />)).toContain('text-h1');
    expect(renderToStaticMarkup(<Wordmark size="brand" />)).not.toContain('text-h2');
    // El compacto no cambia de tamaño.
    expect(renderToStaticMarkup(<Wordmark variant="compact" size="brand" />)).toContain('text-h3');
  });

  it('DSG-13 la variante inversa usa el texto sobre superficie invertida', () => {
    const { container } = render(<Wordmark tone="inverse" />);
    expect(container.querySelectorAll('.text-fg-on-inverse')).toHaveLength(2);
  });
});
