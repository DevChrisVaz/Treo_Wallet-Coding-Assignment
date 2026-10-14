import { MAIN_CONTENT_ID } from './SkipLink';

/**
 * Visible para la persona. Sin `checkVisibility` (Chrome < 105, Firefox < 106, Safari < 17.4), un
 * elemento con `display: none`, o dentro de uno, no tiene cajas: `getClientRects()` queda vacío.
 */
function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility()
    : element.getClientRects().length > 0;
}

/**
 * Lleva el foco al título visible de la página (WEB-23): AppShell tiene un h1 por forma (AppHeader en
 * teléfono, TopBar en el dashboard) y CSS oculta el otro. Sirve cuando el control enfocado desaparece,
 * como el botón de una fila que se quitó. Sin h1 visible, o si el h1 no toma el foco, el foco va al
 * contenido (`main`).
 */
export function focusPageTitle(): void {
  const title = [...document.querySelectorAll<HTMLElement>('h1')].find(isVisible);
  title?.focus();
  if (title && document.activeElement === title) return;
  document.getElementById(MAIN_CONTENT_ID)?.focus();
}
