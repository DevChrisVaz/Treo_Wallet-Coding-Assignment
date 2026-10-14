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

/** Envoltura HTML mínima y común a todos los correos. */
export function layout(title: string, bodyHtml: string): string {
  return [
    '<!doctype html>',
    '<html lang="es-MX"><head><meta charset="utf-8"><title>',
    escapeHtml(title),
    '</title></head><body style="font-family: sans-serif; color: #1f2937;">',
    bodyHtml,
    '<p style="color: #6b7280; font-size: 12px;">Billetera · Este es un correo automático.</p>',
    '</body></html>',
  ].join('');
}
