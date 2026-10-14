import { MAIN_CONTENT_ID } from './SkipLink';

/** Visible para la persona; jsdom no tiene `checkVisibility` (ni CSS), así que ahí cuenta como visible. */
function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

/**
 * Lleva el foco al título visible de la página (WEB-23): AppShell tiene un h1 por forma (AppHeader en
 * teléfono, TopBar en el dashboard) y CSS oculta el otro. Sirve cuando el control enfocado desaparece,
 * como el botón de una fila que se quitó. Sin h1 visible, el foco va al contenido (`main`).
 */
export function focusPageTitle(): void {
  const title = [...document.querySelectorAll<HTMLElement>('h1')].find(isVisible);
  (title ?? document.getElementById(MAIN_CONTENT_ID))?.focus();
}
