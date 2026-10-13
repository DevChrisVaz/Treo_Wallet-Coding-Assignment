import { resetAppState } from './src/test-utils/app-state';
import { netInfoMock, secureStoreMock } from './src/test-utils/native-mocks';

// En Jest, los módulos nativos de Expo devuelven undefined: expo-crypto genera UUID v4 reales con
// el crypto de Node, como lo haría el dispositivo.
jest.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

// Cada prueba empieza con el almacenamiento seguro vacío, con conexión y con la app activa.
beforeEach(() => {
  secureStoreMock.reset();
  netInfoMock.reset();
  resetAppState();
});
