import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { useServices } from '@/app-services';
import { StartupLoading } from '@/navigation/root-navigator';
import { logout } from '@/session/logout';

import { LockScreen } from './lock-screen';

/**
 * Tiempo en segundo plano a partir del cual se vuelve a pedir la biometría (MOB-25, diseño D4).
 * Una ausencia más corta, como contestar un mensaje, no la pide.
 */
export const LOCK_AFTER_MS = 60_000;

/**
 * - `checking`: lee la preferencia y el refresh al arrancar.
 * - `locked`: arranque bloqueado; la navegación aún no se monta y la sesión no se restaura.
 * - `open`: la navegación está montada.
 * - `relocked`: volvió de segundo plano; la pantalla de bloqueo cubre la navegación sin desmontarla.
 */
type GateState = 'checking' | 'locked' | 'open' | 'relocked';

interface UnlockGateProps {
  /** La navegación raíz, que restaura la sesión al montarse (MOB-02). */
  children: ReactNode;
  /** Reloj en milisegundos; las pruebas lo sustituyen. */
  now?: () => number;
}

/**
 * Puerta de desbloqueo (MOB-25, diseño D2 y D4). Al arrancar lee, sin ninguna petición a la API, la
 * preferencia y si hay un refresh guardado. Con el desbloqueo activo y un refresh, muestra la
 * pantalla de bloqueo y monta la navegación (que restaura la sesión) solo después del éxito
 * biométrico; si no, deja pasar y la sesión se restaura como siempre. Después, si la app vuelve a
 * estar activa tras 60 segundos o más en segundo plano, cubre la navegación con la pantalla de
 * bloqueo.
 */
export function UnlockGate({ children, now = Date.now }: UnlockGateProps) {
  const { session, api, unlockPreference } = useServices();
  const [state, setState] = useState<GateState>('checking');
  const backgroundSince = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([unlockPreference.load(), session.readRefreshToken()]).then(
      ([preference, refreshToken]) => {
        if (active) setState(preference === 'enabled' && refreshToken ? 'locked' : 'open');
      },
    );
    return () => {
      active = false;
    };
  }, [session, unlockPreference]);

  // "Usar mi contraseña" o biometría retirada (MOB-26): cuando la sesión ya se borró, la pantalla de
  // bloqueo se retira y la navegación muestra el inicio de sesión. Al arrancar, la navegación se
  // monta hasta este momento, así que ya no encuentra un refresh que renovar.
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getSnapshot().status !== 'signedOut') return;
        setState((current) => (current === 'locked' || current === 'relocked' ? 'open' : current));
      }),
    [session],
  );

  // Solo `background` cuenta: iOS emite `inactive` al abrir el centro de control. La decisión es
  // síncrona (preferencia y sesión en memoria), así que el bloqueo entra en el mismo render que
  // retira la pantalla de privacidad (MOB-16) y ningún saldo queda a la vista entre ambas.
  const onAppStateChange = useEffectEvent((next: AppStateStatus) => {
    if (next === 'background') {
      backgroundSince.current = now();
      return;
    }
    if (next !== 'active') return;
    const since = backgroundSince.current;
    backgroundSince.current = null;
    if (since === null || now() - since < LOCK_AFTER_MS) return;
    if (unlockPreference.getSnapshot() !== 'enabled') return;
    if (session.getSnapshot().status !== 'signedIn') return;
    setState((current) => (current === 'open' ? 'relocked' : current));
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => onAppStateChange(next));
    return () => subscription.remove();
  }, []);

  if (state === 'checking') return <StartupLoading />;

  const lockScreen = (
    <LockScreen onUnlock={() => setState('open')} onSignOut={() => void logout(session, api)} />
  );
  if (state === 'locked') return lockScreen;

  // La navegación queda siempre en la misma posición del árbol para no perder la pantalla en la
  // que estaba la persona; bajo la pantalla de bloqueo, oculta también a los lectores de pantalla.
  const relocked = state === 'relocked';
  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        importantForAccessibility={relocked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={relocked}
      >
        {children}
      </View>
      {relocked ? <View style={StyleSheet.absoluteFill}>{lockScreen}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
