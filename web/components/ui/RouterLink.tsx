'use client';

import {
  createContext,
  createElement,
  useContext,
  type AnchorHTMLAttributes,
  type ComponentType,
} from 'react';

export type RouterLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
};

export type LinkComponent = ComponentType<RouterLinkProps>;

const LinkContext = createContext<LinkComponent | null>(null);

/** Ruta de esta misma web: empieza con `/`, sin `//` ni `/\` (otro origen para el navegador). */
const INTERNAL_HREF = /^\/(?![/\\])/;

/**
 * La app monta aquí `next/link` (AppFrame) para navegar sin recargar la página ni perder la caché
 * de TanStack Query. Sin proveedor (lienzos de design-sync, pruebas del kit) es un `<a>` normal.
 */
export const RouterLinkProvider = LinkContext.Provider;

/**
 * Enlace interno del kit: pestañas, navegación lateral, acciones rápidas y botones de icono. Solo las
 * rutas internas pasan por el enlace de la app; `https:`, `mailto:`, `tel:` y `#…` son `<a>` normales.
 */
export function RouterLink({ href, children, ...props }: RouterLinkProps) {
  const Component = useContext(LinkContext);
  // El enlace de la app es un componente fijo del proveedor (NextLink en AppFrame), no uno creado
  // en este render: se monta con createElement.
  return Component && INTERNAL_HREF.test(href) ? (
    createElement(Component, { ...props, href }, children)
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
