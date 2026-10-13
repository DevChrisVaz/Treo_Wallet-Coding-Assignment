import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppNav, LogoutButton } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { loginPath, safeNextPath } from '@/lib/navigation';
import { readSessionId } from '@/lib/server/session-cookie';
import { currentSession } from '@/lib/server/session';
import { CURRENT_PATH_HEADER } from '@/proxy';

/**
 * Pantallas con sesión (WEB-22): la sesión se verifica en el servidor. Sin sesión se va a
 * `/login?next=…`; si la cookie apunta a una sesión que expiró, primero se borra la cookie (WEB-03).
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const current = await currentSession();
  if (!current) {
    const next = safeNextPath((await headers()).get(CURRENT_PATH_HEADER));
    const hadSession = readSessionId(await cookies()) !== undefined;
    redirect(
      hadSession ? `/bff/session/expired?next=${encodeURIComponent(next)}` : loginPath(next),
    );
  }

  return (
    <PageShell
      actions={
        <>
          <AppNav />
          <LogoutButton />
        </>
      }
    >
      {children}
    </PageShell>
  );
}
