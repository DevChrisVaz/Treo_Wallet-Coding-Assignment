/** Destino del enlace "Saltar al contenido". */
export const MAIN_CONTENT_ID = 'contenido';

/** Primer elemento enfocable de cada página: visible solo al recibir foco con el teclado (WEB-23). */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-pill focus:bg-action focus:px-6 focus:py-3 focus:text-label focus:text-fg-on-action"
    >
      Saltar al contenido
    </a>
  );
}
