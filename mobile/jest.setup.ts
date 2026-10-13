import { resetAppState } from './src/test-utils/app-state';
import { netInfoMock, secureStoreMock } from './src/test-utils/native-mocks';

// Cada prueba empieza con el almacenamiento seguro vacío, con conexión y con la app activa.
beforeEach(() => {
  secureStoreMock.reset();
  netInfoMock.reset();
  resetAppState();
});
