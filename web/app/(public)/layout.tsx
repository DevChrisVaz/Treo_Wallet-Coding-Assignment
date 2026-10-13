import { PageShell } from '@/components/layout/PageShell';

/** Pantallas sin sesión: inicio de sesión, registro y verificación de correo. */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <PageShell>
      <div className="mx-auto grid w-full max-w-md gap-6">{children}</div>
    </PageShell>
  );
}
