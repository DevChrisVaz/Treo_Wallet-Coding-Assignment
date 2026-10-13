import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as tokens from '../src/index';
// @ts-expect-error módulo .mjs sin tipos: es un script de generación, no parte del paquete
import { renderPreviewHtml } from '../scripts/render-preview.mjs';

const html: string = renderPreviewHtml(tokens, tokens.renderTokensCss(tokens.theme));

describe('referencia visual', () => {
  it('DSG-11 muestra cada token de color con su valor', () => {
    for (const { name, path } of tokens.cssColorTokens) {
      expect(html).toContain(`--dt-${name}`);
      expect(html).toContain(tokens.resolveToken(tokens.theme, path));
    }
  });

  it('DSG-04 muestra el contraste de cada par declarado', () => {
    const ratio = tokens
      .contrastRatio(tokens.theme.colors.text.onAction, tokens.theme.colors.action.primary)
      .toFixed(2);
    expect(html).toContain(ratio);
    expect(html.match(/data-pair=/g)).toHaveLength(tokens.contrastPairs.length);
  });

  it('DSG-11 incluye el logotipo de texto, las insignias de estado y los mensajes', () => {
    expect(html).toContain('Treo<span');
    for (const { label } of Object.values(tokens.transferStatus)) expect(html).toContain(label);
    expect(html).toContain(tokens.problemMessage('INSUFFICIENT_FUNDS'));
  });

  it('DSG-08 el archivo generado está al día con la fuente', () => {
    expect(readFileSync(resolve(__dirname, '../preview/index.html'), 'utf8')).toBe(html);
  });
});
