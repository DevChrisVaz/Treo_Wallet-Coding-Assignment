import { act, render } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { AppProviders, createServices } from '@/app-services';
import { createFakeApi } from '@/test-utils/fake-api';
import { TEST_BASE_URL, TEST_TOKENS } from '@/test-utils/render-app';

import { SCREEN_CAPTURE_KEY, useScreenCaptureProtection } from '../screen-capture';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));

function Probe() {
  useScreenCaptureProtection();
  return null;
}

async function setup() {
  const services = createServices(TEST_BASE_URL, createFakeApi().fetch, { testing: true });
  await render(
    <AppProviders baseUrl={TEST_BASE_URL} services={services}>
      <Probe />
    </AppProviders>,
  );
  return services;
}

describe('bloqueo de capturas con sesión', () => {
  test('MOB-16 mientras hay sesión impide capturas y la miniatura del selector de apps', async () => {
    const services = await setup();
    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();

    await act(async () => services.session.start(TEST_TOKENS));

    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith(SCREEN_CAPTURE_KEY);
  });

  test('MOB-16 al cerrar sesión vuelve a permitir capturas', async () => {
    const services = await setup();
    await act(async () => services.session.start(TEST_TOKENS));
    await act(async () => services.session.clear('logout'));
    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith(SCREEN_CAPTURE_KEY);
  });

  test('MOB-16 si el sistema no permite el bloqueo, la app sigue funcionando', async () => {
    jest
      .mocked(ScreenCapture.preventScreenCaptureAsync)
      .mockRejectedValueOnce(new Error('No disponible'));
    const services = await setup();
    await act(async () => services.session.start(TEST_TOKENS));
    expect(services.session.getSnapshot().status).toBe('signedIn');
  });
});
