import { theme } from '@devchrisvaz/wallet-design-tokens';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto para insertarlo en el HTML de un correo. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

const COLORS = theme.colors;

/** Work Sans si el cliente la tiene; si no, la fuente del sistema (los correos no cargan fuentes web). */
const FONT = `'Work Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/** Párrafo de cuerpo (16/24). */
export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: ${COLORS.text.primary};">${escapeHtml(text)}</p>`;
}

/** Código de un solo uso, grande y separado del texto para que se lea y se copie bien. */
export function codeBlock(code: string): string {
  return (
    `<div style="margin: 0 0 16px; padding: 16px; text-align: center; background: ${COLORS.surface.brand}; ` +
    `border-radius: 9px; font-family: ${MONO}; font-size: 28px; line-height: 36px; font-weight: 600; ` +
    `letter-spacing: 6px; color: ${COLORS.action.primary};">${escapeHtml(code)}</div>`
  );
}

/** Filas etiqueta/valor (monto, destino, fecha…) en una tabla con separadores finos. */
export function detailRows(rows: ReadonlyArray<readonly [label: string, value: string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 8px 12px 8px 0; border-top: 1px solid ${COLORS.border.default}; ` +
        `font-size: 14px; line-height: 20px; color: ${COLORS.text.secondary}; vertical-align: top;">${escapeHtml(label)}</td>` +
        `<td style="padding: 8px 0; border-top: 1px solid ${COLORS.border.default}; font-size: 14px; ` +
        `line-height: 20px; font-weight: 500; color: ${COLORS.text.primary}; text-align: right; vertical-align: top;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px; border-collapse: collapse;">${cells}</table>`;
}

/** Recuadro de aviso con el color del estado (éxito, atención o peligro). */
export function noticeBox(kind: 'success' | 'warning' | 'danger', text: string): string {
  const { fg, bg } = COLORS.status[kind];
  return (
    `<div style="margin: 0 0 16px; padding: 12px 16px; background: ${bg}; border-radius: 9px; ` +
    `font-size: 14px; line-height: 20px; font-weight: 500; color: ${fg};">${escapeHtml(text)}</div>`
  );
}

/** Envoltura HTML común a todos los correos: banda de marca, tarjeta blanca y pie. */
export function layout(title: string, bodyHtml: string, preheader?: string): string {
  const hidden = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">${escapeHtml(preheader)}</div>`
    : '';
  return [
    '<!doctype html>',
    '<html lang="es-MX"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light"><title>',
    escapeHtml(title),
    `</title></head><body style="margin: 0; padding: 0; background: ${COLORS.surface.canvas}; font-family: ${FONT};">`,
    hidden,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.surface.canvas};"><tr><td align="center" style="padding: 24px 16px;">`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">',
    `<tr><td style="padding: 20px 24px; background: ${COLORS.surface.hero}; border-radius: 16px 16px 0 0; font-size: 22px; line-height: 28px; font-weight: 600; color: ${COLORS.text.onInverse};">`,
    `Treo<span style="color: ${COLORS.accent.onDark};">Wallet</span></td></tr>`,
    `<tr><td style="padding: 24px; background: ${COLORS.surface.default}; border: 1px solid ${COLORS.border.default}; border-top: 0; border-radius: 0 0 9px 9px;">`,
    `<h1 style="margin: 0 0 16px; font-size: 20px; line-height: 28px; font-weight: 500; color: ${COLORS.text.primary};">${escapeHtml(title)}</h1>`,
    bodyHtml,
    '</td></tr>',
    `<tr><td style="padding: 16px 24px 0; font-size: 12px; line-height: 16px; color: ${COLORS.text.muted}; text-align: center;">TreoWallet · Este es un correo automático.</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');
}
