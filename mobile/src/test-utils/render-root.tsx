/**
 * Renderiza la raíz de la app como `app/_layout.tsx` (pantalla de privacidad, servicios, puerta de
 * desbloqueo y navegación raíz) con la API simulada, un reloj controlable y las pantallas reales de
 * inicio de sesión y de saldo. La sesión arranca como en el dispositivo: desde lo guardado en el
 * almacenamiento seguro simulado.
 */
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppProviders, createServices } from '@/app-services';
import { PrivacyGuard } from '@/components/privacy-guard';
import { HomeScreen } from '@/features/accounts/home-screen';
import { LoginScreen } from '@/features/auth/login-screen';
import { UnlockGate } from '@/features/unlock/unlock-gate';
import { RootNavigator } from '@/navigation/root-navigator';

import type { FakeApi } from './fake-api';
import { TEST_BASE_URL } from './render-app';

/** Reloj de la app en milisegundos; `advance` simula el paso del tiempo. */
export function createClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number): void {
      current += ms;
    },
  };
}

interface RenderRootOptions {
  fake: FakeApi;
  clock?: ReturnType<typeof createClock>;
}

export async function renderRoot({ fake, clock = createClock() }: RenderRootOptions) {
  const services = createServices(TEST_BASE_URL, fake.fetch, { testing: true });
  const router = renderRouter(
    {
      _layout: () => (
        <PrivacyGuard>
          <AppProviders baseUrl={TEST_BASE_URL} services={services}>
            <UnlockGate now={clock.now}>
              <RootNavigator />
            </UnlockGate>
          </AppProviders>
        </PrivacyGuard>
      ),
      login: LoginScreen,
      '(app)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(app)/index': HomeScreen,
      '(app)/accounts/[accountId]': () => <Text>Movimientos de la cuenta</Text>,
    },
    { initialUrl: '/' },
  );
  await router;
  return { services, router, clock };
}
