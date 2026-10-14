import { resetAppState } from './src/test-utils/app-state';
import { localAuthMock, netInfoMock, secureStoreMock } from './src/test-utils/native-mocks';

// En Jest, los módulos nativos de Expo devuelven undefined: expo-crypto genera UUID v4 reales con
// el crypto de Node, como lo haría el dispositivo.
jest.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

// Cada prueba empieza con el almacenamiento seguro vacío, con conexión, con la app activa y con
// una huella registrada cuyo diálogo tiene éxito.
beforeEach(() => {
  secureStoreMock.reset();
  netInfoMock.reset();
  localAuthMock.reset();
  resetAppState();
});
