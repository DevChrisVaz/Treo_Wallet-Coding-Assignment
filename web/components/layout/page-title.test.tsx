import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusPageTitle } from './page-title';
import { MAIN_CONTENT_ID } from './SkipLink';

/**
 * Los dos h1 de AppShell (AppHeader en teléfono y TopBar en el dashboard; CSS oculta uno) y el
 * `main` enfocable. jsdom no tiene `checkVisibility` ni CSS: sin cajas (`getClientRects`) un elemento
 * cuenta como oculto, igual que uno con `display: none` en un navegador.
 */
function mountShell({ dashboardTitleFocusable = true } = {}) {
  document.body.innerHTML = `
    <header><h1 id="app-title" tabindex="-1">Transferencias programadas</h1></header>
    <header><h1 id="dashboard-title"${dashboardTitleFocusable ? ' tabindex="-1"' : ''}>Transferencias programadas</h1></header>
    <main id="${MAIN_CONTENT_ID}" tabindex="-1"></main>`;
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  return {
    app: byId('app-title'),
    dashboard: byId('dashboard-title'),
    main: byId(MAIN_CONTENT_ID),
  };
}

/** El elemento tiene una caja en la página (no está dentro de algo con `display: none`). */
function laidOut(element: HTMLElement) {
  vi.spyOn(element, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 100, 32)] as never);
}

afterEach(() => {
  document.body.innerHTML = '';
  delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
});

describe('focusPageTitle', () => {
  it('WEB-23 con checkVisibility, el foco va al h1 que el navegador muestra', () => {
    const { dashboard } = mountShell();
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) {
        return this.id === 'dashboard-title';
      },
    });
    focusPageTitle();
    expect(dashboard).toHaveFocus();
  });

  it('WEB-23 sin checkVisibility (navegadores anteriores), el foco va al h1 que tiene cajas, no al oculto', () => {
    const { dashboard } = mountShell();
    laidOut(dashboard);
    focusPageTitle();
    expect(dashboard).toHaveFocus();
  });

  it('WEB-23 sin un h1 visible, el foco va al contenido (main)', () => {
    const { main } = mountShell();
    focusPageTitle();
    expect(main).toHaveFocus();
  });

  it('WEB-23 si el h1 visible no toma el foco, el foco va al contenido (main)', () => {
    const { dashboard, main } = mountShell({ dashboardTitleFocusable: false });
    laidOut(dashboard);
    focusPageTitle();
    expect(main).toHaveFocus();
  });
});
