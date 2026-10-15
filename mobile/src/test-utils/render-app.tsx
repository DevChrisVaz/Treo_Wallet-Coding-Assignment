/**
 * Renderiza pantallas reales dentro de Expo Router con los servicios de la app y la API simulada.
 * Con `signedIn`, la sesión empieza iniciada (access token en memoria) sin pasar por el arranque.
 */
import type { TokenPair } from '@devchrisvaz/wallet-contract';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { AppProviders, createServices } from '@/app-services';

import type { FakeApi } from './fake-api';

export const TEST_BASE_URL = 'http://192.168.1.50:4000';

export const TEST_TOKENS: TokenPair = {
  tokenType: 'Bearer',
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

interface RenderAppOptions {
  fake: FakeApi;
  routes: Record<string, ComponentType>;
  initialUrl?: string;
  signedIn?: boolean;
  /** Prepara el almacenamiento seguro tras iniciar la sesión (por ejemplo, un cierre previo de la app). */
  seed?: () => void | Promise<void>;
}

export async function renderApp({
  fake,
  routes,
  initialUrl = '/',
  signedIn = true,
  seed,
}: RenderAppOptions) {
  const services = createServices(TEST_BASE_URL, fake.fetch, { testing: true });
  if (signedIn) await services.session.start(TEST_TOKENS);
  await seed?.();
  const router = renderRouter(
    {
      _layout: () => (
        <AppProviders baseUrl={TEST_BASE_URL} services={services}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      ),
      ...routes,
    },
    { initialUrl },
  );
  await router;
  return { services, router };
}
