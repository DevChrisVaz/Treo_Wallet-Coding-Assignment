'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType } from 'react';

export type RouterLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
};

export type LinkComponent = ComponentType<RouterLinkProps>;

const LinkContext = createContext<LinkComponent | null>(null);

/**
 * La app monta aquí `next/link` (AppFrame) para navegar sin recargar la página ni perder la caché
 * de TanStack Query. Sin proveedor (lienzos de design-sync, pruebas del kit) es un `<a>` normal.
 */
export const RouterLinkProvider = LinkContext.Provider;

/** Enlace interno del kit: pestañas, navegación lateral, acciones rápidas y botones de icono. */
export function RouterLink({ children, ...props }: RouterLinkProps) {
  const Component = useContext(LinkContext);
  // El enlace llega del proveedor y es un componente fijo del módulo (NextLink en AppFrame): no se
  // crea en cada render, así que React conserva el enlace entre renders.
  // eslint-disable-next-line react-hooks/static-components
  return Component ? <Component {...props}>{children}</Component> : <a {...props}>{children}</a>;
}
