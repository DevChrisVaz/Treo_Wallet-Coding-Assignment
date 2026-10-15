'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface SessionUser {
  /** Nombre completo de la persona titular (`User.fullName`). */
  name: string;
  email: string;
}

const SessionUserContext = createContext<SessionUser | null>(null);

/** Persona de la sesión, que el layout del servidor entrega a `AppFrame` (WEB-22). */
export function SessionUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return <SessionUserContext value={user}>{children}</SessionUserContext>;
}

/** La persona de la sesión; `null` en una pantalla renderizada sola, sin `AppFrame`. */
export function useSessionUser(): SessionUser | null {
  return useContext(SessionUserContext);
}
